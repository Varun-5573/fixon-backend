import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class BookingProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _bookings = [];
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = false;

  BookingProvider() {
    _loadCachedData();
  }

  Future<void> _loadCachedData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final bookingsStr = prefs.getString('cached_bookings');
      final notifsStr = prefs.getString('cached_notifications');
      
      if (bookingsStr != null) {
        _bookings = List<Map<String, dynamic>>.from(jsonDecode(bookingsStr) as List);
      }
      if (notifsStr != null) {
        _notifications = List<Map<String, dynamic>>.from(jsonDecode(notifsStr) as List);
      }
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading cached booking/notif data: $e');
    }
  }

  Future<void> _saveCachedBookings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_bookings', jsonEncode(_bookings));
    } catch (e) {
      debugPrint('Error saving cached bookings: $e');
    }
  }

  Future<void> _saveCachedNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_notifications', jsonEncode(_notifications));
    } catch (e) {
      debugPrint('Error saving cached notifications: $e');
    }
  }

  // Real-time sync
  IO.Socket? _socket;
  Timer? _pollTimer;
  String? _currentUserId;
  String? _currentToken;

  List<Map<String, dynamic>> get bookings => _bookings;
  List<Map<String, dynamic>> get notifications => _notifications;
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

  final List<Map<String, dynamic>> _demoNotifications = [
    {'_id': 'n1', 'icon': '🎉', 'title': 'Booking Confirmed!', 'body': 'Your Plumbing Repair is confirmed. Worker assigned.', 'time': '2 min ago', 'type': 'booking', 'unread': true},
    {'_id': 'n2', 'icon': '💰', 'title': 'Payment Received', 'body': '₹499 payment successful for Plumbing service.', 'time': '1 hour ago', 'type': 'payment', 'unread': true},
    {'_id': 'n3', 'icon': '🎁', 'title': 'Special Offer!', 'body': 'Get 25% off on your next booking. Use code SUMMER25', 'time': '3 hours ago', 'type': 'promo', 'unread': false},
    {'_id': 'n4', 'icon': '⭐', 'title': 'Rate Your Service', 'body': 'How was your cleaning service? Share your experience!', 'time': 'Yesterday', 'type': 'feedback', 'unread': false},
  ];

  Future<void> fetchNotifications() async {
    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/notifications'),
        headers: {
          ...kHeaders,
          'Authorization': 'Bearer $_currentToken',
        },
      ).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        if (data['success'] == true) {
          final list = data['notifications'] as List? ?? [];
          final fresh = list.map((n) {
            final map = Map<String, dynamic>.from(n as Map);
            if (!map.containsKey('unread')) map['unread'] = true;
            return map;
          }).toList();

          final seenKeys = <String>{};
          final deduplicated = <Map<String, dynamic>>[];
          for (final n in fresh) {
            final key = (n['_id'] ?? n['id'])?.toString() ??
                '${n['title']}_${n['message'] ?? n['body']}';
            if (seenKeys.contains(key)) continue;
            seenKeys.add(key);
            deduplicated.add(n);
          }

          _notifications = deduplicated;
          _saveCachedNotifications();
          notifyListeners();
          return;
        }
      }
    } catch (e) {
      debugPrint('⚠️ fetchNotifications error: $e');
    }

    if (_notifications.isEmpty) {
      _notifications = List<Map<String, dynamic>>.from(_demoNotifications);
    }
    notifyListeners();
  }

  void _addNotification(Map<String, dynamic> payload) {
    final notifId = (payload['_id'] ?? payload['id'])?.toString();
    if (notifId != null && notifId.isNotEmpty) {
      final exists = _notifications.any((n) => (n['_id'] ?? n['id'])?.toString() == notifId);
      if (exists) return; // Prevent duplicate notification
    } else {
      final title = payload['title']?.toString();
      final body = (payload['message'] ?? payload['body'])?.toString();
      final exists = _notifications.any((n) =>
          n['title']?.toString() == title &&
          (n['message'] ?? n['body'])?.toString() == body);
      if (exists) return; // Prevent duplicate notification
    }
    _notifications.insert(0, payload);
    _saveCachedNotifications();
    notifyListeners();
  }

  void markAllNotificationsRead() {
    for (final n in _notifications) {
      n['unread'] = false;
    }
    notifyListeners();
  }

  void markNotificationRead(String id) {
    final idx = _notifications.indexWhere((n) => n['_id']?.toString() == id);
    if (idx != -1) {
      _notifications[idx]['unread'] = false;
      notifyListeners();
    }
  }

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
              ...kHeaders,
              'Authorization': 'Bearer $_currentToken',
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
          _saveCachedBookings();
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
      _socket = IO.io(
        kBaseUrl,
        IO.OptionBuilder()
            .setTransports(['websocket'])
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionDelay(1000)
            .setReconnectionAttempts(99)
            .build(),
      );

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

      // Admin panel emits 'new_notification' when a push broadcast is triggered
      _socket!.on('new_notification', (data) {
        debugPrint('📡 new_notification received: $data');
        try {
          final payload = data is Map ? Map<String, dynamic>.from(data) : null;
          if (payload == null) return;

          // Check if targeting all users or specific user
          final targetUserId = payload['userId']?.toString();
          if (targetUserId == 'all' || targetUserId == _currentUserId) {
            _addNotification(payload);
          }
        } catch (e) {
          debugPrint('⚠️ Socket notification parse error: $e');
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
              ...kHeaders,
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
