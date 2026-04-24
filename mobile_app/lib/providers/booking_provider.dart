import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';

class BookingProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _bookings = [];
  bool _loading = false;

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

  /// Fetch bookings for a specific user — uses correct /api/bookings/user/:userId
  Future<void> fetchBookings(String token, {String? userId}) async {
    _loading = true;
    notifyListeners();
    try {
      // ✅ Fixed: use userId-specific route matching server.js
      final url = (userId != null && userId.isNotEmpty)
          ? '$kBaseUrl/api/bookings/user/$userId'
          : '$kBaseUrl/api/bookings';

      final res = await http
          .get(
            Uri.parse(url),
            headers: {
              'Authorization': 'Bearer $token',
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
    _bookings = _demoBookings;
    _loading = false;
    notifyListeners();
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
      if (data['success'] == true) return true;
    } catch (e) {
      debugPrint('⚠️ createBooking error: $e');
    }
    // Demo mode — add locally so user sees the booking immediately
    _bookings.insert(0, {
      '_id': 'new_${DateTime.now().millisecondsSinceEpoch}',
      ...bookingData,
      'status': 'pending',
      'workerId': null,
    });
    notifyListeners();
    return true;
  }
}
