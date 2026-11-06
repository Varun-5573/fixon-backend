import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:math';
import '../../utils/constants.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late IO.Socket _socket;
  List<Map<String, dynamic>> _messages = [];
  final TextEditingController _textCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  bool _isLoading = true;
  Timer? _refreshTimer;

  String _userId   = 'guest';
  String _userName = 'Customer';

  /// Generate a unique client-side message ID for deduplication
  String _newClientId() =>
      'C${DateTime.now().millisecondsSinceEpoch}${Random().nextInt(99999)}';

  @override
  void initState() {
    super.initState();
    _initUser();
  }

  /// Load real user from SharedPreferences (set during login/register)
  Future<void> _initUser() async {
    try {
      final prefs    = await SharedPreferences.getInstance();
      final userJson = prefs.getString('fixon_user');
      if (userJson != null) {
        final user = jsonDecode(userJson) as Map<String, dynamic>;
        _userId   = user['_id']?.toString()  ?? 'guest';
        _userName = user['name']?.toString() ?? 'Customer';
      }
    } catch (e) {
      debugPrint('⚠️ Could not load user: $e');
    }

    await _loadInitialMessages();
    _connectSocket();

    // Poll every 10s so admin replies always show even if socket drops
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _loadInitialMessages(silent: true);
    });
  }

  Future<void> _loadInitialMessages({bool silent = false}) async {
    try {
      final res = await http
          .get(Uri.parse('$kBaseUrl/api/chat/all'))
          .timeout(const Duration(seconds: 45));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        if (data['success'] == true && data['messages'] != null) {
          final all      = List<Map<String, dynamic>>.from(data['messages'] as List);
          final filtered = all.where((m) {
            final sender   = m['senderId']?.toString()   ?? '';
            final receiver = m['receiverId']?.toString() ?? '';
            final type     = m['senderType']?.toString() ?? '';
            return sender == _userId ||
                receiver == _userId ||
                (type == 'bot' && receiver == _userId);
          }).toList();

          if (mounted) {
            setState(() {
              // Merge: keep any unsaved optimistic messages not yet returned by server
              final serverIds = filtered
                  .where((m) => m['_id'] != null)
                  .map((m) => m['_id'].toString())
                  .toSet();
              final optimistic = _messages.where(
                (m) => m['_id'] == null || !serverIds.contains(m['_id'].toString()),
              ).toList();
              _messages  = [...filtered, ...optimistic];
              if (!silent) _isLoading = false;
            });
            _scrollToBottom();
            return;
          }
        }
      }
    } catch (e) {
      debugPrint('⚠️ Chat load error: $e');
    }

    // First time or no messages → show welcome bot message
    if (mounted) {
      setState(() {
        if (_messages.isEmpty) {
          _messages = [
            {
              'senderId'  : 'bot',
              'receiverId': _userId,
              'message'   : '👋 Hello $_userName! Welcome to FixoN Support. '
                  'How can I help you today? Ask me about bookings, payments, or services!',
              'senderType': 'bot',
              'createdAt' : DateTime.now().toIso8601String(),
            }
          ];
        }
        _isLoading = false;
      });
    }
  }

  void _connectSocket() {
    _socket = IO.io(
      kBaseUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .enableReconnection()
          .build(),
    );

    _socket.onConnect((_) {
      debugPrint('✅ Chat socket connected');
      _socket.emit('customer_join', {'userId': _userId, 'name': _userName});
    });

    _socket.on('receive_message', (data) {
      if (!mounted) return;
      final msgMap   = Map<String, dynamic>.from(data as Map);
      final sender   = msgMap['senderId']?.toString()   ?? '';
      final receiver = msgMap['receiverId']?.toString() ?? '';
      final type     = msgMap['senderType']?.toString() ?? '';

      if (sender == _userId ||
          receiver == _userId ||
          (type == 'bot' && receiver == _userId)) {

        setState(() {
          // Deduplicate: skip if _id already in list
          final incomingId = msgMap['_id']?.toString() ?? '';
          final clientId   = msgMap['clientId']?.toString() ?? '';

          final alreadyExists = _messages.any((m) {
            if (incomingId.isNotEmpty && m['_id']?.toString() == incomingId) return true;
            if (clientId.isNotEmpty   && m['clientId']?.toString() == clientId) return true;
            return false;
          });

          if (!alreadyExists) {
            _messages.add(msgMap);
          }
        });
        _scrollToBottom();
      }
    });

    _socket.connect();
  }

  void _scrollToBottom() {
    if (!_scrollCtrl.hasClients) return;
    Future.delayed(const Duration(milliseconds: 150), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final txt = _textCtrl.text.trim();
    if (txt.isEmpty) return;
    _textCtrl.clear();

    final clientId = _newClientId();

    final msgObj = {
      'clientId'  : clientId,
      'senderId'  : _userId,
      'receiverId': 'admin',
      'message'   : txt,
      'senderType': 'customer',
      'name'      : _userName,
      'createdAt' : DateTime.now().toIso8601String(),
    };

    // Add optimistically to UI immediately
    setState(() => _messages.add(msgObj));
    _scrollToBottom();

    // Send ONLY via socket (removes duplicate HTTP + socket problem)
    try {
      if (_socket.connected) {
        _socket.emit('send_message', msgObj);
      } else {
        // Fallback to HTTP if socket not connected
        await http.post(
          Uri.parse('$kBaseUrl/api/chat/send'),
          headers: kHeaders,
          body: jsonEncode(msgObj),
        ).timeout(const Duration(seconds: 45));
      }
    } catch (e) {
      debugPrint('Send error: $e');
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _socket.dispose();
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.card,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Stack(children: [
              Container(
                width: 38, height: 38,
                decoration: BoxDecoration(gradient: AppColors.primaryGradient, shape: BoxShape.circle),
                child: const Center(child: Text('💬', style: TextStyle(fontSize: 18))),
              ),
              Positioned(
                right: 0, bottom: 0,
                child: Container(
                  width: 12, height: 12,
                  decoration: BoxDecoration(
                    color: AppColors.success, shape: BoxShape.circle,
                    border: Border.all(color: AppColors.card, width: 2),
                  ),
                ),
              ),
            ]),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Support Chat',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
              Text('Real-time • Admin + AI support',
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
            ]),
          ],
        ),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Column(children: [
              Expanded(
                child: _messages.isEmpty
                    ? Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          const Text('💬', style: TextStyle(fontSize: 48)),
                          const SizedBox(height: 12),
                          Text('No messages yet',
                              style: GoogleFonts.outfit(fontSize: 16, color: AppColors.textSub)),
                          const SizedBox(height: 4),
                          Text('Send a message to start chatting!',
                              style: GoogleFonts.inter(fontSize: 13, color: AppColors.textDim)),
                        ]),
                      )
                    : ListView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                        itemCount: _messages.length,
                        itemBuilder: (ctx, i) {
                          final m = _messages[i];
                          return _buildBubble(m, m['senderId'] == _userId);
                        },
                      ),
              ),

              // ── Input bar ──────────────────────────────────────────
              Container(
                padding: EdgeInsets.only(
                    left: 16, right: 16,
                    bottom: MediaQuery.of(context).padding.bottom + 16,
                    top: 12),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  border: Border(top: BorderSide(color: AppColors.border)),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, -3))],
                ),
                child: Row(children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                          color: AppColors.card2,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: AppColors.border)),
                      child: TextField(
                        controller: _textCtrl,
                        style: TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Type your message...',
                          hintStyle: TextStyle(color: AppColors.textSub),
                          border: InputBorder.none,
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: _sendMessage,
                    child: Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 4))],
                      ),
                      child: Icon(Icons.send_rounded, color: Colors.white, size: 22),
                    ),
                  ),
                ]),
              ),
            ]),
    );
  }

  Widget _buildBubble(Map<String, dynamic> msg, bool isMe) {
    final t = msg['createdAt'] != null ? DateTime.tryParse(msg['createdAt'].toString()) : null;
    final timeStr = t != null
        ? '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}'
        : '';
    final isBot  = msg['senderType'] == 'bot';
    final isAdmin = msg['senderType'] == 'admin';

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                color: isBot
                    ? AppColors.secondary.withValues(alpha: 0.2)
                    : isAdmin
                        ? AppColors.primary.withValues(alpha: 0.2)
                        : AppColors.card2,
                shape: BoxShape.circle,
              ),
              child: Center(child: Text(isBot ? '🤖' : isAdmin ? '👑' : '🎧', style: TextStyle(fontSize: 14))),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.only(
                  topLeft:    const Radius.circular(16),
                  topRight:   const Radius.circular(16),
                  bottomLeft:  Radius.circular(isMe ? 16 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 16),
                ),
                gradient: isMe ? AppColors.primaryGradient : null,
                color: isMe ? null : AppColors.card2,
                border: isMe ? null : Border.all(color: AppColors.border),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (isBot)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('AI Assistant',
                        style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.secondary)),
                  ),
                if (isAdmin)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('Support Team',
                        style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  ),
                Text(msg['message']?.toString() ?? '',
                    style: GoogleFonts.inter(fontSize: 14, color: Colors.white, height: 1.4)),
                const SizedBox(height: 4),
                Text(timeStr,
                    style: GoogleFonts.inter(fontSize: 10, color: isMe ? Colors.white70 : AppColors.textSub)),
              ]),
            ),
          ),
          if (isMe) ...[
            const SizedBox(width: 8),
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                  color: AppColors.card2, shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border)),
              child: const Center(child: Text('👤', style: TextStyle(fontSize: 14))),
            ),
          ],
        ],
      ),
    );
  }
}
