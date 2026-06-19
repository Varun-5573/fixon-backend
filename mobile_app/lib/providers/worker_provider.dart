import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class WorkerProvider extends ChangeNotifier {
  Map<String, dynamic>? _worker;
  String? _token;
  bool _loading = false;
  Map<String, dynamic>? _dashboardStats;
  List<dynamic> _pendingBookings = [];
  List<dynamic> _myBookings = [];

  Map<String, dynamic>? get worker => _worker;
  String? get token => _token;
  bool get loading => _loading;
  Map<String, dynamic>? get stats => _dashboardStats;
  List<dynamic> get pendingBookings => _pendingBookings;
  List<dynamic> get myBookings => _myBookings;
  bool get isLoggedIn => _worker != null;
  bool get isOnline => _worker?['isOnline'] == true;

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
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'workerId': workerId, 'password': password}),
      );
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
      notifyListeners();
      return {'success': false, 'error': 'Connection error'};
    }
  }

  Future<void> logout() async {
    await toggleOnline(false);
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
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/dashboard'));
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
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/pending-bookings'));
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
      final res = await http.get(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/bookings'));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _myBookings = data['bookings'];
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<bool> acceptBooking(String bookingId) async {
    if (_worker == null) return false;
    try {
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/accept-booking/$bookingId'));
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
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/reject-booking/$bookingId'));
      final data = jsonDecode(res.body);
      if (data['success'] == true) await fetchPendingBookings();
      return data['success'] == true;
    } catch (_) { return false; }
  }

  Future<bool> updateBookingStatus(String bookingId, String action) async {
    if (_worker == null) return false;
    try {
      final res = await http.post(Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/booking/$bookingId/$action'));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        await fetchMyBookings();
        await fetchDashboard();
      }
      return data['success'] == true;
    } catch (_) { return false; }
  }

  Future<void> toggleOnline(bool isOnline) async {
    if (_worker == null) return;
    try {
      final res = await http.put(
        Uri.parse('$kBaseUrl/api/worker/${_worker!['_id']}/status'),
        headers: {'Content-Type': 'application/json'},
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
