import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

class AppColors {
  static const Color primary     = Color(0xFF7C3AED);
  static const Color primaryLight= Color(0xFF9D5AF7);
  static const Color secondary   = Color(0xFF06B6D4);
  static const Color accent      = Color(0xFFF59E0B);
  static const Color success     = Color(0xFF10B981);
  static const Color error       = Color(0xFFEF4444);
  static const Color warning     = Color(0xFFF59E0B);

  static const Color bg          = Color(0xFF060612);
  static const Color surface     = Color(0xFF0D0D22);
  static const Color card        = Color(0xFF13132B);
  static const Color card2       = Color(0xFF1A1A35);
  static const Color border      = Color(0x12FFFFFF);

  static const Color text        = Color(0xFFF0F0FF);
  static const Color textSub     = Color(0xFF7880A8);
  static const Color textDim     = Color(0x4DFFFFFF);

  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, primaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient bgGradient = LinearGradient(
    colors: [Color(0xFF0D0528), Color(0xFF060612)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
}

// Web → localhost, Android APK → hotspot Wi-Fi IP
const String kServerIp = '10.114.61.161';
const String kBaseUrl = kIsWeb ? 'http://localhost:5000' : 'http://$kServerIp:5000';

const List<Map<String, dynamic>> kServices = [
  {'name': 'Plumbing',      'icon': '🔧', 'color': 0xFF7C3AED, 'price': 499},
  {'name': 'Electrical',    'icon': '⚡', 'color': 0xFFF59E0B, 'price': 599},
  {'name': 'Cleaning',      'icon': '🧹', 'color': 0xFF10B981, 'price': 1299},
  {'name': 'AC Repair',     'icon': '❄️', 'color': 0xFF06B6D4, 'price': 799},
  {'name': 'Carpentry',     'icon': '🪚', 'color': 0xFFEC4899, 'price': 699},
  {'name': 'Painting',      'icon': '🎨', 'color': 0xFFEF4444, 'price': 2499},
  {'name': 'Pest Control',  'icon': '🐛', 'color': 0xFF8B5CF6, 'price': 999},
  {'name': 'CCTV Setup',    'icon': '📹', 'color': 0xFF059669, 'price': 3499},
];
