import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class WorkerChatScreen extends StatefulWidget {
  final String workerId;
  final String workerName;
  final String workerCategory;

  const WorkerChatScreen({
    super.key,
    required this.workerId,
    required this.workerName,
    required this.workerCategory,
  });

  @override
  State<WorkerChatScreen> createState() => _WorkerChatScreenState();
}

class _WorkerChatScreenState extends State<WorkerChatScreen> {
  final TextEditingController _msgCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  String get _myId =>
      context.read<AuthProvider>().user?['_id'] ?? 'guest';
  String get _myName =>
      context.read<AuthProvider>().user?['name'] ?? 'Customer';

  Future<void> _loadMessages() async {
    setState(() => _loading = true);
    try {
      final res = await http.get(
        Uri.parse(
            '$kBaseUrl/api/chat/private-messages?userA=$_myId&userB=${widget.workerId}'),
      );
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        setState(() => _messages =
            List<Map<String, dynamic>>.from(data['messages']));
      }
    } catch (_) {}
    setState(() => _loading = false);
    _scrollToBottom();
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    _msgCtrl.clear();

    final tempMsg = {
      'senderId': _myId,
      'receiverId': widget.workerId,
      'message': text,
      'senderType': 'customer',
      'senderName': _myName,
      'createdAt': DateTime.now().toIso8601String(),
    };

    setState(() {
      _messages.add(tempMsg);
      _sending = true;
    });
    _scrollToBottom();

    try {
      await http.post(
        Uri.parse('$kBaseUrl/api/chat/send-private'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'senderId': _myId,
          'receiverId': widget.workerId,
          'message': text,
          'senderType': 'customer',
          'senderName': _myName,
        }),
      );
    } catch (_) {}
    setState(() => _sending = false);
  }

  Future<void> _sendImageMessage() async {
    final picker = ImagePicker();
    final picked =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 60);
    if (picked == null) return;

    final bytes = await File(picked.path).readAsBytes();
    final base64Img = 'data:image/jpeg;base64,${base64Encode(bytes)}';

    final tempMsg = {
      'senderId': _myId,
      'receiverId': widget.workerId,
      'message': '[📸 Photo shared]',
      'attachmentUrl': base64Img,
      'senderType': 'customer',
      'senderName': _myName,
      'createdAt': DateTime.now().toIso8601String(),
    };

    setState(() => _messages.add(tempMsg));
    _scrollToBottom();

    try {
      await http.post(
        Uri.parse('$kBaseUrl/api/chat/send-private'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'senderId': _myId,
          'receiverId': widget.workerId,
          'message': '[📸 Photo shared]',
          'attachmentUrl': base64Img,
          'senderType': 'customer',
          'senderName': _myName,
        }),
      );
    } catch (_) {}
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, color: AppColors.text, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: AppColors.primaryGradient,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                widget.workerName[0].toUpperCase(),
                style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Colors.white),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(widget.workerName,
                style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text)),
            Row(children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: Color(0xFF10B981),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 4),
              Text('Online · ${widget.workerCategory}',
                  style: GoogleFonts.inter(
                      fontSize: 11, color: AppColors.success)),
            ]),
          ]),
        ]),
        actions: [
          IconButton(
            icon: Icon(Icons.call_outlined, color: AppColors.primary),
            onPressed: () {},
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Messages
          Expanded(
            child: _loading
                ? Center(
                    child: CircularProgressIndicator(color: AppColors.primary))
                : _messages.isEmpty
                    ? _buildEmptyState()
                    : ListView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (_, i) =>
                            _buildBubble(_messages[i]),
                      ),
          ),

          // Input Bar
          Container(
            padding: EdgeInsets.fromLTRB(
                16, 12, 16, MediaQuery.of(context).viewInsets.bottom + 16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(children: [
              GestureDetector(
                onTap: _sendImageMessage,
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(Icons.image_outlined,
                      color: AppColors.primary, size: 20),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: TextField(
                    controller: _msgCtrl,
                    style: GoogleFonts.inter(
                        fontSize: 14, color: AppColors.text),
                    decoration: InputDecoration(
                      hintText: 'Type a message...',
                      hintStyle: GoogleFonts.inter(
                          fontSize: 14, color: AppColors.textSub),
                      border: InputBorder.none,
                    ),
                    maxLines: null,
                    textCapitalization: TextCapitalization.sentences,
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: _sending ? null : _sendMessage,
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _sending ? Icons.hourglass_empty : Icons.send_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _buildBubble(Map<String, dynamic> msg) {
    final isMine = msg['senderId'] == _myId;
    final time = _formatTime(msg['createdAt'] ?? '');
    final hasAttachment = (msg['attachmentUrl'] ?? '').isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  widget.workerName[0].toUpperCase(),
                  style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white),
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          ConstrainedBox(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72),
            child: Container(
              padding: EdgeInsets.all(hasAttachment ? 4 : 12),
              decoration: BoxDecoration(
                color: isMine ? AppColors.primary : AppColors.card,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isMine ? 16 : 4),
                  bottomRight: Radius.circular(isMine ? 4 : 16),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (hasAttachment && msg['attachmentUrl'].startsWith('data:'))
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.memory(
                        base64Decode(
                            msg['attachmentUrl'].split(',').last),
                        width: 200,
                        height: 160,
                        fit: BoxFit.cover,
                      ),
                    ),
                  if (msg['message'] != '[📸 Photo shared]' || !hasAttachment)
                    Padding(
                      padding: EdgeInsets.all(hasAttachment ? 8 : 0),
                      child: Text(
                        msg['message'] ?? '',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: isMine ? Colors.white : AppColors.text,
                          height: 1.4,
                        ),
                      ),
                    ),
                  Padding(
                    padding: EdgeInsets.only(
                        top: 4,
                        left: hasAttachment ? 8 : 0,
                        right: hasAttachment ? 8 : 0,
                        bottom: hasAttachment ? 6 : 0),
                    child: Text(
                      time,
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        color: isMine
                            ? Colors.white60
                            : AppColors.textSub,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isMine) const SizedBox(width: 4),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child:
                Icon(Icons.chat_bubble_outline, color: AppColors.primary, size: 36),
          ),
          const SizedBox(height: 16),
          Text('Start Chatting',
              style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
          const SizedBox(height: 6),
          Text('Send a message to ${widget.workerName}',
              style: GoogleFonts.inter(
                  fontSize: 13, color: AppColors.textSub)),
        ],
      ),
    );
  }

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour < 12 ? 'AM' : 'PM';
      return '$h:$m $ampm';
    } catch (_) {
      return '';
    }
  }
}
