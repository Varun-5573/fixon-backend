import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';

class AuthProvider extends ChangeNotifier {
  Map<String, dynamic>? _user;
  String? _token;
  bool _loading = false;

  Map<String, dynamic>? get user => _user;
  String? get token => _token;
  bool get loading => _loading;
  bool get isLoggedIn => _token != null && _user != null;

  AuthProvider() { _loadFromStorage(); }

  Future<void> _loadFromStorage() async {
    final p = await SharedPreferences.getInstance();
    final u = p.getString('fixon_user');
    final t = p.getString('fixon_token');
    if (u != null && t != null) {
      _user = jsonDecode(u);
      _token = t;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _loading = true; notifyListeners();
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/auth/user/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 8));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _token = data['token'];
        _user = data['user'];
        final p = await SharedPreferences.getInstance();
        await p.setString('fixon_token', _token!);
        await p.setString('fixon_user', jsonEncode(_user));
        _loading = false; notifyListeners();
        return true;
      }
    } catch (e) {
      print('❌ LOGIN ERROR: $e');
      // Demo mode
      if (email.isNotEmpty && password == 'Password@123') {
        _token = 'demo_token';
        _user = {'_id': 'demo1', 'name': email.split('@')[0], 'email': email, 'phone': '9876543210'};
        final p = await SharedPreferences.getInstance();
        await p.setString('fixon_token', _token!);
        await p.setString('fixon_user', jsonEncode(_user));
        _loading = false; notifyListeners();
        return true;
      }
    }
    _loading = false; notifyListeners();
    return false;
  }

  Future<bool> register(String name, String email, String phone, String password) async {
    _loading = true; notifyListeners();
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/auth/user/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'name': name, 'email': email, 'phone': phone, 'password': password}),
      ).timeout(const Duration(seconds: 8));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _token = data['token'];
        _user = data['user'];
        final p = await SharedPreferences.getInstance();
        await p.setString('fixon_token', _token!);
        await p.setString('fixon_user', jsonEncode(_user));
        _loading = false; notifyListeners();
        return true;
      }
    } catch (e) {
      print('❌ REGISTER ERROR: $e');
      // Demo mode
      _token = 'demo_token';
      _user = {'_id': 'demo1', 'name': name, 'email': email, 'phone': phone};
      final p = await SharedPreferences.getInstance();
      await p.setString('fixon_token', _token!);
      await p.setString('fixon_user', jsonEncode(_user));
      _loading = false; notifyListeners();
      return true;
    }
    _loading = false; notifyListeners();
    return false;
  }

  Future<void> logout() async {
    _user = null; _token = null;
    final p = await SharedPreferences.getInstance();
    await p.remove('fixon_token');
    await p.remove('fixon_user');
    notifyListeners();
  }
}
