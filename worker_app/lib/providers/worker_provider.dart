import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
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
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'workerId': workerId, 'password': password}),
      ).timeout(const Duration(seconds: 5));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _worker = data['worker'];
        _token = data['token'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_data', jsonEncode(_worker));
        await prefs.setString('worker_token', _token!);
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
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/dashboard')).timeout(const Duration(seconds: 4));
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
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/pending-bookings')).timeout(const Duration(seconds: 4));
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
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/bookings')).timeout(const Duration(seconds: 4));
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
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/accept-booking/$bookingId')).timeout(const Duration(seconds: 5));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _connectionError = false;
        await fetchPendingBookings();
        await fetchMyBookings();
        await fetchDashboard();
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
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/reject-booking/$bookingId')).timeout(const Duration(seconds: 5));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _connectionError = false;
        await fetchPendingBookings();
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
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/booking/$bookingId/$action')).timeout(const Duration(seconds: 5));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _connectionError = false;
        await fetchMyBookings();
        await fetchDashboard();
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
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'isOnline': isOnline}),
      ).timeout(const Duration(seconds: 5));
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
      const Duration(seconds: 15),
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
      // Check permission quickly without blocking
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) return;

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 8));

      _currentLat = pos.latitude;
      _currentLng = pos.longitude;

      await http.post(
        Uri.parse('$kBaseUrl/api/location/worker'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'workerId': _worker!['_id'],
          'lat': pos.latitude,
          'lng': pos.longitude,
        }),
      ).timeout(const Duration(seconds: 5));
    } catch (_) {
      // Silently fail — don't block app
    }
  }
}
