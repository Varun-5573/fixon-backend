import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:http/http.dart' as http;
import 'dart:async';
import 'dart:convert';
import '../utils/constants.dart';

class LocationProvider extends ChangeNotifier {
  Position? _position;
  String _address = 'Detecting location...';
  bool _loading = false;
  String? _error;
  Timer? _periodicTimer;
  String? _currentUserId;

  Position? get position => _position;
  String get address => _address;
  bool get loading => _loading;
  String? get error => _error;
  double? get lat => _position?.latitude;
  double? get lng => _position?.longitude;

  /// Request permission + get real GPS location, reverse-geocode, push to backend
  Future<void> fetchLocation(String userId) async {
    _currentUserId = userId;
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      // 1. Check / request permission
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        _error = 'Location permission permanently denied.';
        _address = 'Permission denied';
        _loading = false;
        notifyListeners();
        return;
      }

      // 2. ✅ Get REAL GPS position (high accuracy — no fake/static data)
      _position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 12),
      );

      // 3. Reverse geocode to human-readable address
      try {
        final placemarks = await placemarkFromCoordinates(
          _position!.latitude,
          _position!.longitude,
        );
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          _address = [
            p.street,
            p.subLocality,
            p.locality,
            p.administrativeArea,
          ].where((s) => s != null && s.isNotEmpty).join(', ');
          if (_address.isEmpty) {
            _address =
                '${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}';
          }
        }
      } catch (_) {
        _address =
            '${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}';
      }

      // 4. Push to backend immediately
      await _pushToBackend(userId);

      // 5. Start periodic updates every 30s (keeps admin map live)
      _startPeriodicPush(userId);
    } catch (e) {
      _error = 'Could not get location.';
      _address = 'Location unavailable';
      debugPrint('⚠️ Location error: $e');
    }

    _loading = false;
    notifyListeners();
  }

  /// Push ✅ REAL GPS coordinates to backend — never static/fake
  Future<void> _pushToBackend(String userId) async {
    if (_position == null) return;
    try {
      await http
          .post(
            Uri.parse('$kBaseUrl/api/location/update'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'userId': userId,
              'lat': _position!.latitude,   // real GPS lat
              'lng': _position!.longitude,  // real GPS lng
              'address': _address,
            }),
          )
          .timeout(const Duration(seconds: 6));
      debugPrint('📍 Location pushed: ${_position!.latitude}, ${_position!.longitude}');
    } catch (e) {
      debugPrint('⚠️ Location push failed: $e');
    }
  }

  /// Start sending location to server every 30 seconds
  void _startPeriodicPush(String userId) {
    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      try {
        // Re-fetch fresh GPS position each cycle
        final newPos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 10),
        );
        _position = newPos;
        await _pushToBackend(userId);
        notifyListeners();
      } catch (_) {
        // Silent fail — just use last known position
        await _pushToBackend(userId);
      }
    });
  }

  /// Start continuous location stream (for high-frequency tracking)
  Stream<Position> startLiveTracking() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 20, // update every 20 metres moved
      ),
    );
  }

  /// Stop tracking (call on logout)
  void stopTracking() {
    _periodicTimer?.cancel();
    _periodicTimer = null;
  }

  @override
  void dispose() {
    _periodicTimer?.cancel();
    super.dispose();
  }
}
