import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../utils/constants.dart';

class WorkerProvider extends ChangeNotifier {
  Map<String, dynamic>? _worker;
  String? _token;
  bool _loading = false;
  Map<String, dynamic>? _dashboardStats;
  List<dynamic> _pendingBookings = [];
  List<dynamic> _myBookings = [];
  IO.Socket? _socket;

  Map<String, dynamic>? get worker => _worker;
  String? get token => _token;
  bool get loading => _loading;
  Map<String, dynamic>? get stats => _dashboardStats;
  List<dynamic> get pendingBookings => _pendingBookings;
  List<dynamic> get myBookings => _myBookings;
  bool get isLoggedIn => _worker != null;
  bool get isOnline => _worker?['isOnline'] == true;

  // ── Status rank constants (mirrors server) ──────────────────────────────────
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

  /// Applies a booking update from socket — rank-guarded against regression
  void _applyBookingUpdate(Map<String, dynamic> updated) {
    final id = updated['_id']?.toString();
    if (id == null) return;
    final idx = _myBookings.indexWhere((b) => b['_id']?.toString() == id);
    if (idx != -1) {
      final currentRank = _statusRanks[_norm(_myBookings[idx]['status']?.toString())] ?? 0;
      final incomingRank = _statusRanks[_norm(updated['status']?.toString())] ?? 0;
      if (incomingRank < currentRank) {
        debugPrint('⚠️ Worker: Ignoring stale socket update for booking $id');
        return;
      }
      _myBookings[idx] = Map<String, dynamic>.from(updated);
      notifyListeners();
    }
  }

  void _startSocketSync() {
    if (_socket != null) return;
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
        debugPrint('🔌 WorkerProvider: Socket connected');
        _socket!.emit('worker_join', {'workerId': _worker?['_id']});
      });
      _socket!.on('booking_update', (data) {
        try {
          final payload = data is Map ? Map<String, dynamic>.from(data) : null;
          if (payload == null) return;
          final updated = payload['booking'];
          if (updated is Map) {
            _applyBookingUpdate(Map<String, dynamic>.from(updated));
          }
        } catch (e) {
          debugPrint('⚠️ Worker socket update error: $e');
        }
      });
      _socket!.on('disconnect', (_) => debugPrint('🔌 WorkerProvider: Socket disconnected'));
    } catch (e) {
      debugPrint('⚠️ Worker socket init error: $e');
    }
  }

  Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final workerJson = prefs.getString('worker_data');
    final token = prefs.getString('worker_token');
    if (workerJson != null && token != null) {
      _worker = jsonDecode(workerJson);
      _token = token;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> login(String workerId, String password) async {
    _loading = true;
    notifyListeners();
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/login'),
        headers: kHeaders,
        body: jsonEncode({'workerId': workerId, 'password': password}),
      );
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _worker = data['worker'];
        _token = data['token'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_data', jsonEncode(_worker));
        await prefs.setString('worker_token', _token!);
        _startSocketSync();
      }
      _loading = false;
      notifyListeners();
      return data;
    } catch (e) {
      _loading = false;
      notifyListeners();
      return {'success': false, 'error': 'Connection error'};
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('worker_data');
    await prefs.remove('worker_token');
    notifyListeners();
  }

  Future<void> fetchDashboard() async {
    if (_worker == null) return;
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/dashboard'), headers: kHeaders);
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _dashboardStats = data['stats'];
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> fetchPendingBookings() async {
    if (_worker == null) return;
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/pending-bookings'), headers: kHeaders);
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _pendingBookings = data['bookings'];
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> fetchMyBookings() async {
    if (_worker == null) return;
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/bookings'), headers: kHeaders);
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        // Merge fresh data, but rank-guard to never regress any existing status
        final fresh = List<dynamic>.from(data['bookings'] ?? []);
        for (final freshB in fresh) {
          final id = freshB['_id']?.toString();
          if (id == null) continue;
          final idx = _myBookings.indexWhere((b) => b['_id']?.toString() == id);
          if (idx != -1) {
            final currentRank = _statusRanks[_norm(_myBookings[idx]['status']?.toString())] ?? 0;
            final incomingRank = _statusRanks[_norm(freshB['status']?.toString())] ?? 0;
            if (incomingRank >= currentRank) {
              _myBookings[idx] = freshB is Map ? Map<String, dynamic>.from(freshB) : freshB;
            }
          } else {
            _myBookings.add(freshB is Map ? Map<String, dynamic>.from(freshB) : freshB);
          }
        }
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<bool> acceptBooking(String bookingId) async {
    if (_worker == null) return false;
    try {
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/accept-booking/$bookingId'), headers: kHeaders);
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        await fetchPendingBookings();
        await fetchMyBookings();
        await fetchDashboard();
      }
      return data['success'] == true;
    } catch (_) { return false; }
  }

  Future<bool> rejectBooking(String bookingId) async {
    if (_worker == null) return false;
    try {
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/reject-booking/$bookingId'), headers: kHeaders);
      final data = jsonDecode(res.body);
      if (data['success'] == true) await fetchPendingBookings();
      return data['success'] == true;
    } catch (_) { return false; }
  }

  Future<bool> updateBookingStatus(String bookingId, String action) async {
    if (_worker == null) return false;

    // Optimistic in-memory update BEFORE network call
    final canonicalNew = _norm(action);
    final idx = _myBookings.indexWhere((b) => b['_id']?.toString() == bookingId);
    if (idx != -1) {
      final currentRank = _statusRanks[_norm(_myBookings[idx]['status']?.toString())] ?? 0;
      final newRank = _statusRanks[canonicalNew] ?? 0;
      if (newRank >= currentRank) {
        _myBookings[idx] = Map<String, dynamic>.from(_myBookings[idx])
          ..['status'] = canonicalNew;
        notifyListeners();
      }
    }

    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/booking/$bookingId/$action'),
        headers: kHeaders,
      );
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        // Apply server-confirmed booking state (rank-guarded)
        final serverBooking = data['booking'];
        if (serverBooking is Map) {
          _applyBookingUpdate(Map<String, dynamic>.from(serverBooking));
        }
        await fetchDashboard();
      } else {
        // Revert optimistic update on failure
        await fetchMyBookings();
      }
      return data['success'] == true;
    } catch (_) {
      await fetchMyBookings(); // revert on network error
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
      );
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _worker = data['worker'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('worker_data', jsonEncode(_worker));
        notifyListeners();
      }
    } catch (_) {}
  }
}
