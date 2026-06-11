import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../utils/constants.dart';

class BookingProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _bookings = [];
  bool _loading = false;

  // Real-time sync
  IO.Socket? _socket;
  Timer? _pollTimer;
  String? _currentUserId;
  String? _currentToken;

  List<Map<String, dynamic>> get bookings => _bookings;
  bool get loading => _loading;

  final List<Map<String, dynamic>> _demoBookings = [
    {
      '_id': 'b1',
      'service': 'Plumbing Repair',
      'status': 'ongoing',
      'price': 499,
      'scheduledTime': DateTime.now().toIso8601String(),
      'location': {'address': '12 MG Road, Hyderabad'},
      'workerId': {'name': 'Varun', 'phone': '9999999999', 'rating': 4.9},
    },
    {
      '_id': 'b2',
      'service': 'Deep Cleaning',
      'status': 'completed',
      'price': 1299,
      'scheduledTime': DateTime.now().subtract(const Duration(days: 2)).toIso8601String(),
      'location': {'address': '45 Banjara Hills, Hyderabad'},
      'workerId': {'name': 'Bunny', 'phone': '7777777777', 'rating': 4.7},
    },
    {
      '_id': 'b3',
      'service': 'AC Repair',
      'status': 'pending',
      'price': 799,
      'scheduledTime': DateTime.now().add(const Duration(hours: 3)).toIso8601String(),
      'location': {'address': '78 Jubilee Hills, Hyderabad'},
      'workerId': null,
    },
  ];

  /// Fetch bookings + start real-time sync via Socket.IO + polling
  Future<void> fetchBookings(String token, {String? userId}) async {
    _currentToken = token;
    _currentUserId = userId;

    _loading = true;
    notifyListeners();

    await _doFetch();

    // Start real-time listeners if not already running
    _startSocketSync();
    _startPolling();
  }

  Future<void> _doFetch() async {
    try {
      final url = (_currentUserId != null && _currentUserId!.isNotEmpty)
          ? '$kBaseUrl/api/bookings/user/$_currentUserId'
          : '$kBaseUrl/api/bookings';

      final res = await http
          .get(
            Uri.parse(url),
            headers: {
              'Authorization': 'Bearer $_currentToken',
              'Content-Type': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        if (data['success'] == true) {
          _bookings = List<Map<String, dynamic>>.from(
            (data['bookings'] as List? ?? [])
                .map((b) => Map<String, dynamic>.from(b as Map)),
          );
          _loading = false;
          notifyListeners();
          return;
        }
      }
    } catch (e) {
      debugPrint('⚠️ fetchBookings error: $e');
    }
    // Fallback to demo data when server unreachable
    if (_bookings.isEmpty) _bookings = _demoBookings;
    _loading = false;
    notifyListeners();
  }

  /// Socket.IO: listen for booking_update events emitted by admin panel
  void _startSocketSync() {
    if (_socket != null) return; // Already connected
    try {
      _socket = IO.io(kBaseUrl, <String, dynamic>{
        'transports': ['websocket'],
        'autoConnect': true,
      });

      _socket!.on('connect', (_) {
        debugPrint('🔌 BookingProvider: Socket connected');
        _socket!.emit('customer_join', {'userId': _currentUserId});
      });

      // Admin panel emits 'booking_update' on every status change
      _socket!.on('booking_update', (data) {
        debugPrint('📡 booking_update received: $data');
        try {
          final payload = data is Map ? Map<String, dynamic>.from(data) : null;
          if (payload == null) return;

          final updatedBooking = payload['booking'] as Map?;
          if (updatedBooking != null) {
            applyBookingUpdate(Map<String, dynamic>.from(updatedBooking));
          } else {
            _doFetch(); // Fallback: re-fetch all
          }
        } catch (e) {
          debugPrint('⚠️ Socket update parse error: $e');
          _doFetch();
        }
      });

      _socket!.on('disconnect', (_) => debugPrint('🔌 BookingProvider: Socket disconnected'));
    } catch (e) {
      debugPrint('⚠️ Socket init error: $e');
    }
  }

  /// Periodic polling every 15s as fallback when socket misses events
  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) => _doFetch());
  }

  /// Applies a single booking update in-place → instant UI refresh
  void applyBookingUpdate(Map<String, dynamic> updatedBooking) {
    final id = updatedBooking['_id']?.toString();
    if (id == null) return;

    // Only apply if it belongs to current user
    final bookingUserId = (updatedBooking['userId'] is Map)
        ? updatedBooking['userId']['_id']?.toString()
        : updatedBooking['userId']?.toString();

    if (_currentUserId != null &&
        bookingUserId != null &&
        bookingUserId != _currentUserId) return;

    final idx = _bookings.indexWhere((b) => b['_id']?.toString() == id);
    if (idx != -1) {
      _bookings[idx] = Map<String, dynamic>.from(updatedBooking);
    }
    notifyListeners();
  }

  /// Stop socket and polling (call on logout)
  void stopSync() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  @override
  void dispose() {
    stopSync();
    super.dispose();
  }

  Future<bool> createBooking(
      Map<String, dynamic> bookingData, String token) async {
    try {
      final res = await http
          .post(
            Uri.parse('$kBaseUrl/api/bookings'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(bookingData),
          )
          .timeout(const Duration(seconds: 8));
      final data = jsonDecode(res.body) as Map<String, dynamic>;

      if (data['success'] == true) {
        _bookings.insert(0, data['booking'] ?? {
          '_id': 'BK${DateTime.now().millisecondsSinceEpoch}',
          ...bookingData,
          'status': 'pending',
          'workerId': null,
        });
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('⚠️ createBooking error: $e');
    }

    // Offline / Demo mode fallback
    _bookings.insert(0, {
      '_id': 'offline_${DateTime.now().millisecondsSinceEpoch}',
      ...bookingData,
      'status': 'pending',
      'workerId': null,
    });
    notifyListeners();
    return true;
  }
}
