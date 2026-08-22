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
          _notifications = list.map((n) {
            final map = Map<String, dynamic>.from(n as Map);
            if (!map.containsKey('unread')) map['unread'] = true;
            return map;
          }).toList();
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
          final fresh = List<Map<String, dynamic>>.from(
            (data['bookings'] as List? ?? [])
                .map((b) => Map<String, dynamic>.from(b as Map)),
          );

          // ── ALWAYS merge fresh data using rank-guard so status NEVER regresses ──
          // Build a map of current bookings for O(1) lookup
          final currentMap = <String, Map<String, dynamic>>{
            for (final b in _bookings)
              if (b['_id'] != null) b['_id'].toString(): b
          };

          final merged = fresh.map((freshB) {
            final id = freshB['_id']?.toString();
            if (id == null) return freshB;
            final current = currentMap[id];
            if (current == null) return freshB; // new booking
            final curRank = _statusRanks[_norm(current['status']?.toString())] ?? 0;
            final freshRank = _statusRanks[_norm(freshB['status']?.toString())] ?? 0;
            // Prefer whichever has a HIGHER rank (never go backward)
            if (freshRank >= curRank) return freshB;
            return current;
          }).toList();

          _bookings = merged;
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
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionDelay(1000)
            .setReconnectionAttempts(99)
            .setTimeout(5000)
            .build(),
      );

      _socket!.on('connect', (_) {
        debugPrint('🔌 BookingProvider: Socket connected');
        _socket!.emit('customer_join', {'userId': _currentUserId});
      });

      // Booking status push — most important real-time event
      _socket!.on('booking_status_update', (data) {
        try {
          final payload = data is Map ? Map<String, dynamic>.from(data) : null;
          if (payload == null) return;
          // Only process if meant for this user
          final targetUserId = payload['userId']?.toString();
          if (targetUserId != null && targetUserId != _currentUserId) return;
          final updatedBooking = payload['booking'] as Map?;
          if (updatedBooking != null) {
            applyBookingUpdate(Map<String, dynamic>.from(updatedBooking));
          }
        } catch (e) {
          debugPrint('⚠️ Socket booking_status_update error: $e');
        }
      });
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
            _notifications.insert(0, payload);
            notifyListeners();
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

  /// Periodic polling every 5s as fallback when socket misses events
  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 12), (_) => _doFetch());
  }

  // Status rank map — mirrors server STATUS_RANKS
  static const Map<String, int> _statusRanks = {
    'pending': 0, 'assigned': 1, 'accepted': 2, 'confirmed': 2,
    'on_the_way': 3, 'arrived': 4,
    'ongoing': 5, 'in_progress': 5, 'started': 5,
    'completed': 6, 'cancelled': 99,
  };

  static String _norm(String? s) {
    if (s == null || s.isEmpty) return 'pending';
    final str = s.toLowerCase().replaceAll(RegExp(r'[\s-]'), '_');
    if (['confirmed', 'accepted', 'accept'].contains(str)) return 'accepted';
    if (['on_the_way', 'ontheway', 'on_way', 'on-the-way'].contains(str)) return 'on_the_way';
    if (['arrived', 'arrive'].contains(str)) return 'arrived';
    if (['ongoing', 'in_progress', 'start_work', 'started', 'start', 'working'].contains(str)) return 'ongoing';
    if (['completed', 'complete', 'finish', 'finished', 'done'].contains(str)) return 'completed';
    if (['cancelled', 'cancel'].contains(str)) return 'cancelled';
    return str;
  }

  /// Applies a single booking update in-place, ignoring stale status regressions
  void applyBookingUpdate(Map<String, dynamic> updatedBooking) {
    final id = updatedBooking['_id']?.toString();
    if (id == null) return;

    // Extract userId — handle both enriched {_id, name} object AND raw string
    final rawUserId = updatedBooking['userId'];
    final bookingUserId = (rawUserId is Map)
        ? rawUserId['_id']?.toString()
        : rawUserId?.toString();

    // Only skip if BOTH are non-null AND they clearly don't match
    if (_currentUserId != null &&
        bookingUserId != null &&
        bookingUserId != _currentUserId &&
        bookingUserId.isNotEmpty) {
      debugPrint('⚠️ Socket event for different user ($bookingUserId vs $_currentUserId), skipping');
      return;
    }

    final idx = _bookings.indexWhere((b) => b['_id']?.toString() == id);
    if (idx != -1) {
      // RANK GUARD: only apply if incoming status is SAME or HIGHER rank than current
      final currentStatus = _norm(_bookings[idx]['status']?.toString());
      final incomingStatus = _norm(updatedBooking['status']?.toString());
      final currentRank = _statusRanks[currentStatus] ?? 0;
      final incomingRank = _statusRanks[incomingStatus] ?? 0;

      if (incomingRank < currentRank && incomingStatus != 'cancelled') {
        debugPrint('⚠️ Ignoring stale socket event: $currentStatus($currentRank) > $incomingStatus($incomingRank)');
        return;
      }
      _bookings[idx] = Map<String, dynamic>.from(updatedBooking);
    } else {
      // Booking not in list yet — trigger a full refresh to get it
      _doFetch();
      return;
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
    // Extract the photo BEFORE creating booking (send it separately for reliability)
    final problemPhoto = bookingData['problemPhoto']?.toString() ?? '';
    final beforePhoto  = bookingData['beforePhoto']?.toString() ?? '';
    final photoToUpload = problemPhoto.isNotEmpty ? problemPhoto : (beforePhoto.isNotEmpty ? beforePhoto : '');

    // Prepare booking payload including problemPhoto
    final payloadWithPhoto = Map<String, dynamic>.from(bookingData);
    if (photoToUpload.isNotEmpty) {
      payloadWithPhoto['problemPhoto'] = photoToUpload;
      payloadWithPhoto['customerProblemPhoto'] = photoToUpload;
      payloadWithPhoto['beforePhoto'] = photoToUpload;
    }

    String? createdBookingId;

    try {
      final res = await http
          .post(
            Uri.parse('$kBaseUrl/api/bookings'),
            headers: {
              ...kHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(payloadWithPhoto),
          )
          .timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>;

      if (data['success'] == true) {
        final booking = data['booking'] as Map<String, dynamic>? ?? {
          '_id': 'BK${DateTime.now().millisecondsSinceEpoch}',
          ...payloadWithPhoto,
          'status': 'pending',
          'workerId': null,
        };

        createdBookingId = booking['_id']?.toString();

        // ── Upload problem photo SEPARATELY for reliability ──────
        if (photoToUpload.isNotEmpty && createdBookingId != null) {
          try {
            await http.post(
              Uri.parse('$kBaseUrl/api/bookings/$createdBookingId/photos'),
              headers: {...kHeaders, 'Authorization': 'Bearer $token'},
              body: jsonEncode({
                'beforePhoto': photoToUpload,
                'problemPhoto': photoToUpload,
              }),
            ).timeout(const Duration(seconds: 30));
            debugPrint('📸 Problem photo uploaded for booking $createdBookingId');
            // Attach photo to booking in memory too
            booking['beforePhoto'] = photoToUpload;
            booking['problemPhoto'] = photoToUpload;
          } catch (e) {
            debugPrint('⚠️ Photo upload error (non-fatal): $e');
          }
        }

        _bookings.insert(0, booking);
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('⚠️ createBooking error: $e');
    }

    // Offline / Demo mode fallback
    _bookings.insert(0, {
      '_id': 'offline_${DateTime.now().millisecondsSinceEpoch}',
      ...payloadWithPhoto,
      'status': 'pending',
      'workerId': null,
    });
    notifyListeners();
    return true;
  }
}
