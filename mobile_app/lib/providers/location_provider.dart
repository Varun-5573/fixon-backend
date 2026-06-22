import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class LocationProvider extends ChangeNotifier {
  Position? _position;
  String _address = 'Detecting location...';
  bool _loading = false;
  String? _error;
  Timer? _periodicTimer;
  String? _periodicTimerId;
  String? _currentUserId;
  IO.Socket? _socket;

  LocationProvider() {
    _loadFromPrefs();
  }

  Future<void> _loadFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lat = prefs.getDouble('loc_lat');
      final lng = prefs.getDouble('loc_lng');
      final addr = prefs.getString('loc_address');
      if (lat != null && lng != null && addr != null) {
        _position = Position(
          latitude: lat,
          longitude: lng,
          timestamp: DateTime.now(),
          accuracy: 1.0,
          altitude: 0.0,
          heading: 0.0,
          speed: 0.0,
          speedAccuracy: 0.0,
          altitudeAccuracy: 0.0,
          headingAccuracy: 0.0,
        );
        _address = addr;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading location from prefs: $e');
    }
  }

  Future<void> _saveToPrefs() async {
    if (_position == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble('loc_lat', _position!.latitude);
      await prefs.setDouble('loc_lng', _position!.longitude);
      await prefs.setString('loc_address', _address);
    } catch (e) {
      debugPrint('Error saving location to prefs: $e');
    }
  }

  Position? get position => _position;
  String get address => _address;
  bool get loading => _loading;
  String? get error => _error;
  double? get lat => _position?.latitude;
  double? get lng => _position?.longitude;

  /// Connect socket so server instantly knows when app closes
  void _connectSocket(String userId, String userName) {
    try {
      _socket?.disconnect();
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
      _socket!.onConnect((_) {
        debugPrint('🔌 LocationProvider socket connected');
        _socket!.emit('customer_join', {'userId': userId, 'name': userName});
      });
      _socket!.onDisconnect((_) {
        debugPrint('📴 LocationProvider socket disconnected');
      });
    } catch (e) {
      debugPrint('⚠️ Socket connect error: $e');
    }
  }

  /// Request permission + get real GPS location, reverse-geocode, push to backend
  Future<void> fetchLocation(String userId, {String userName = 'Customer'}) async {
    _currentUserId = userId;
    _loading = true;
    _error = null;
    notifyListeners();

    // Connect socket so server can detect when app closes
    _connectSocket(userId, userName);

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

      // 2. Get REAL GPS position (high accuracy)
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
      _saveToPrefs();

      // 5. Start periodic updates every 25s (within server's 60s online threshold)
      _startPeriodicPush(userId);
    } catch (e) {
      _error = 'Could not get location.';
      if (_address == 'Detecting location...') {
        _address = 'Location unavailable';
      }
      debugPrint('⚠️ Location error: $e');
    }

    _loading = false;
    notifyListeners();
  }

  /// Push REAL GPS coordinates to backend
  Future<void> _pushToBackend(String userId) async {
    if (_position == null) return;
    try {
      await http
          .post(
            Uri.parse('$kBaseUrl/api/location/update'),
            headers: kHeaders,
            body: jsonEncode({
              'userId': userId,
              'lat': _position!.latitude,
              'lng': _position!.longitude,
              'address': _address,
            }),
          )
          .timeout(const Duration(seconds: 6));
      debugPrint('📍 Location pushed: ${_position!.latitude}, ${_position!.longitude}');
    } catch (e) {
      debugPrint('⚠️ Location push failed: $e');
    }
  }

  /// Start sending location every 25s (keeps lastSeen fresh within the 60s server threshold)
  void _startPeriodicPush(String userId) {
    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(const Duration(seconds: 25), (_) async {
      try {
        final newPos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 10),
        );
        _position = newPos;
        await _pushToBackend(userId);
        notifyListeners();
      } catch (_) {
        await _pushToBackend(userId);
      }
    });
  }

  /// Start continuous location stream (for high-frequency tracking)
  Stream<Position> startLiveTracking() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 20,
      ),
    );
  }

  void setManualLocation(double latitude, double longitude, String customAddress) {
    _position = Position(
      latitude: latitude,
      longitude: longitude,
      timestamp: DateTime.now(),
      accuracy: 1.0,
      altitude: 0.0,
      heading: 0.0,
      speed: 0.0,
      speedAccuracy: 0.0,
      altitudeAccuracy: 0.0,
      headingAccuracy: 0.0,
    );
    _address = customAddress;
    _saveToPrefs();
    notifyListeners();
    if (_currentUserId != null) {
      _pushToBackend(_currentUserId!);
    }
  }

  /// Stop tracking — disconnects socket so server immediately marks offline
  void stopTracking() {
    _periodicTimer?.cancel();
    _periodicTimer = null;
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  @override
  void dispose() {
    _periodicTimer?.cancel();
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }
}
