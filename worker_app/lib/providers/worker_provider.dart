import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../utils/constants.dart';

class WorkerProvider extends ChangeNotifier {
  Map<String, dynamic>? _worker;
  String? _token;
  bool _loading = false;
  bool _connectionError = false;
  Map<String, dynamic>? _dashboardStats;
  List<dynamic> _pendingBookings = [];
  List<dynamic> _myBookings = [];
  Timer? _locationBroadcastTimer;
  double? _currentLat;
  double? _currentLng;
  IO.Socket? _socket;

  Map<String, dynamic>? get worker => _worker;
  String? get token => _token;
  bool get loading => _loading;
  bool get connectionError => _connectionError;
  Map<String, dynamic>? get stats => _dashboardStats;
  List<dynamic> get pendingBookings => _pendingBookings;
  List<dynamic> get myBookings => _myBookings;
  bool get isLoggedIn => _worker != null;
  bool get isOnline => _worker?['isOnline'] == true;
  double? get currentLat => _currentLat;
  double? get currentLng => _currentLng;

  void _initSocket() {
    if (_socket != null || _worker == null) return;
    try {
      final workerId = _worker!['_id'] ?? _worker!['workerId'];
      _socket = IO.io(
        kBaseUrl,
        IO.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionDelay(2000)
            .setReconnectionAttempts(99)
            .setTimeout(5000)
            .build(),
      );

      _socket!.onConnect((_) {
        debugPrint('⚡ Worker Socket Connected for $workerId');
        _socket!.emit('worker_join', {'workerId': workerId});
      });

      _socket!.on('booking_update', (_) => _handleRealtimeUpdate());
      _socket!.on('new_booking', (_) => _handleRealtimeUpdate());
      _socket!.on('new_booking_assigned', (_) => _handleRealtimeUpdate());
      _socket!.on('booking_photos_updated', (_) => _handlePhotoUpdate());

      _socket!.onDisconnect((_) => debugPrint('🔌 Worker Socket Disconnected'));
    } catch (e) {
      debugPrint('⚠️ Worker socket init error: $e');
    }
  }

  Timer? _realtimeDebounce;
  void _handleRealtimeUpdate() {
    if (_worker == null) return;
    // Debounce: wait 500ms before fetching to batch rapid events
    _realtimeDebounce?.cancel();
    _realtimeDebounce = Timer(const Duration(milliseconds: 500), () {
      fetchPendingBookings();
      fetchMyBookings();
    });
  }

  void _handlePhotoUpdate() {
    // Only refresh my bookings for photo events (lighter)
    fetchMyBookings();
  }

  Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final workerJson = prefs.getString('worker_data');
    final token = prefs.getString('worker_token');
    if (workerJson != null && token != null) {
      _worker = jsonDecode(workerJson);
      _token = token;
      
      // Load cached stats and bookings
      final statsJson = prefs.getString('worker_stats');
      if (statsJson != null) {
        _dashboardStats = jsonDecode(statsJson);
      }
      final pendingJson = prefs.getString('worker_pending_bookings');
      if (pendingJson != null) {
        _pendingBookings = jsonDecode(pendingJson);
      }
      final myBookingsJson = prefs.getString('worker_my_bookings');
      if (myBookingsJson != null) {
        _myBookings = jsonDecode(myBookingsJson);
      }
      
      _initSocket();
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> login(String workerId, String password) async {
    _loading = true;
    _connectionError = false;
    notifyListeners();
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/login'),
        headers: kHeaders,
        body: jsonEncode({'workerId': workerId, 'password': password}),
      ).timeout(const Duration(seconds: 10));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _worker = data['worker'];
        _token = data['token'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_data', jsonEncode(_worker));
        await prefs.setString('worker_token', _token!);
        _initSocket();
        // Fetch all data in parallel for faster startup
        unawaited(Future.wait([
          fetchPendingBookings(),
          fetchMyBookings(),
          fetchDashboard(),
        ]));
      }
      _loading = false;
      notifyListeners();
      return data;
    } catch (e) {
      _loading = false;
      _connectionError = true;
      notifyListeners();
      return {'success': false, 'error': 'Connection error — check if server is running'};
    }
  }

  Future<void> logout() async {
    await toggleOnline(false);
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _worker = null;
    _token = null;
    _dashboardStats = null;
    _pendingBookings = [];
    _myBookings = [];
    _connectionError = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('worker_data');
    await prefs.remove('worker_token');
    await prefs.remove('worker_stats');
    await prefs.remove('worker_pending_bookings');
    await prefs.remove('worker_my_bookings');
    notifyListeners();
  }

  Future<void> fetchDashboard() async {
    if (_worker == null) return;
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/dashboard'), headers: kHeaders).timeout(const Duration(seconds: 5));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _dashboardStats = data['stats'];
        _connectionError = false;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_stats', jsonEncode(_dashboardStats));
        notifyListeners();
      }
    } catch (_) {
      _connectionError = true;
      notifyListeners();
    }
  }

  Future<void> fetchPendingBookings() async {
    if (_worker == null) return;
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/pending-bookings'), headers: kHeaders).timeout(const Duration(seconds: 5));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _pendingBookings = data['bookings'];
        _connectionError = false;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_pending_bookings', jsonEncode(_pendingBookings));
        notifyListeners();
      }
    } catch (_) {
      _connectionError = true;
      notifyListeners();
    }
  }

  Future<void> fetchMyBookings() async {
    if (_worker == null) return;
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/bookings'), headers: kHeaders).timeout(const Duration(seconds: 5));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _myBookings = data['bookings'];
        _connectionError = false;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_my_bookings', jsonEncode(_myBookings));
        notifyListeners();
      }
    } catch (_) {
      _connectionError = true;
      notifyListeners();
    }
  }

  Future<bool> acceptBooking(String bookingId) async {
    if (_worker == null) return false;
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/accept-booking/$bookingId'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _connectionError = false;
        // Update local pending bookings to remove accepted one
        _pendingBookings = _pendingBookings.where((b) => b['_id'] != bookingId).toList();
        // Add to my bookings if returned in response
        if (data['booking'] != null) {
          final exists = _myBookings.any((b) => b['_id'] == bookingId);
          if (!exists) _myBookings.insert(0, data['booking']);
        }
        notifyListeners();
        // Refresh from server in background
        fetchMyBookings();
        fetchDashboard();
      }
      return data['success'] == true;
    } catch (_) {
      _connectionError = true;
      notifyListeners();
      return false;
    }
  }

  Future<bool> rejectBooking(String bookingId) async {
    if (_worker == null) return false;
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/reject-booking/$bookingId'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _connectionError = false;
        _pendingBookings = _pendingBookings.where((b) => b['_id'] != bookingId).toList();
        notifyListeners();
        fetchPendingBookings();
      }
      return data['success'] == true;
    } catch (_) {
      _connectionError = true;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateBookingStatus(String bookingId, String action) async {
    if (_worker == null) return false;
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/booking/$bookingId/$action'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _connectionError = false;
        // Optimistically update status in local list
        final actionToStatus = {
          'on-the-way':  'on_the_way',
          'on_the_way':  'on_the_way',
          'arrived':     'arrived',
          'arrive':      'arrived',
          'start':       'ongoing',
          'start_work':  'ongoing',
          'in_progress': 'ongoing',
          'ongoing':     'ongoing',
          'complete':    'completed',
          'completed':   'completed',
          'cancel':      'cancelled',
          'cancelled':   'cancelled',
        };
        final newStatus = actionToStatus[action] ?? action;
        final updatedBooking = data['booking'];
        _myBookings = _myBookings.map((b) {
          if (b['_id'] == bookingId) {
            return updatedBooking ?? { ...b, 'status': newStatus };
          }
          return b;
        }).toList();
        notifyListeners();
        // Also refresh from server
        fetchMyBookings();
        fetchDashboard();
      }
      return data['success'] == true;
    } catch (_) {
      _connectionError = true;
      notifyListeners();
      return false;
    }
  }

  Future<void> toggleOnline(bool isOnline) async {
    if (_worker == null) return;
    try {
      final res = await http.put(
        Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/status'),
        headers: kHeaders,
        body: jsonEncode({'isOnline': isOnline}),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _worker = data['worker'];
        _connectionError = false;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_data', jsonEncode(_worker));
        notifyListeners();
      }
    } catch (_) {
      _connectionError = true;
      notifyListeners();
    }

    if (isOnline) {
      _startLocationBroadcast();
    } else {
      _stopLocationBroadcast();
    }
  }

  // ── GPS Location Broadcasting ─────────────────────────────
  void _startLocationBroadcast() {
    _locationBroadcastTimer?.cancel();
    _pushLocation(); // push immediately on going online
    _locationBroadcastTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => _pushLocation(),
    );
  }

  void _stopLocationBroadcast() {
    _locationBroadcastTimer?.cancel();
    _locationBroadcastTimer = null;
  }

  Future<void> _pushLocation() async {
    if (_worker == null) return;
    try {
      // Check permission and request if denied
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        print("📍 Location permission denied");
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 8));

      _currentLat = pos.latitude;
      _currentLng = pos.longitude;

      print("📍 Worker location fetched: ${pos.latitude}, ${pos.longitude}");

      await http.post(
        Uri.parse('$kBaseUrl/api/location/worker'),
        headers: kHeaders,
        body: jsonEncode({
          'workerId': _worker!['_id'],
          'lat': pos.latitude,
          'lng': pos.longitude,
        }),
      ).timeout(const Duration(seconds: 15));
    } catch (e) {
      print("📍 Error pushing worker location: $e");
      // Silently fail — don't block app
    }
  }
  Future<Map<String, dynamic>> registerWorker(Map<String, dynamic> body) async {
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/workers/register'),
        headers: kHeaders,
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 30));
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'error': 'Connection error — check if server is running'};
    }
  }

  Future<Map<String, dynamic>> checkRegistrationStatus(String phone) async {
    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/workers/registration-status/$phone'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 15));
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'error': 'Connection error — check if server is running'};
    }
  }
}
