import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class AppColors {
  static Color primary     = const Color(0xFF7C3AED);
  static Color primaryLight= const Color(0xFF9D5AF7);
  static Color secondary   = const Color(0xFF06B6D4);
  static Color accent      = const Color(0xFFF59E0B);
  static Color success     = const Color(0xFF10B981);
  static Color error       = const Color(0xFFEF4444);
  static Color warning     = const Color(0xFFF59E0B);

  static Color bg          = const Color(0xFF060612);
  static Color surface     = const Color(0xFF0D0D22);
  static Color card        = const Color(0xFF13132B);
  static Color card2       = const Color(0xFF1A1A35);
  static Color border      = const Color(0x12FFFFFF);

  static Color text        = const Color(0xFFF0F0FF);
  static Color textSub     = const Color(0xFF7880A8);
  static Color textDim     = const Color(0x4DFFFFFF);

  static LinearGradient get primaryGradient => LinearGradient(
    colors: [primary, primaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient get bgGradient => LinearGradient(
    colors: bg == const Color(0xFF060612) ? [const Color(0xFF0D0528), const Color(0xFF060612)] : [const Color(0xFFF8FAFC), const Color(0xFFF0F4F8)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static void updateTheme(bool isDark) {
    if (isDark) {
      bg = const Color(0xFF060612);
      surface = const Color(0xFF0D0D22);
      card = const Color(0xFF13132B);
      card2 = const Color(0xFF1A1A35);
      border = const Color(0x12FFFFFF);
      text = const Color(0xFFF0F0FF);
      textSub = const Color(0xFF7880A8);
      textDim = const Color(0x4DFFFFFF);
    } else {
      bg = const Color(0xFFF8FAFC);
      surface = const Color(0xFFFFFFFF);
      card = const Color(0xFFFFFFFF);
      card2 = const Color(0xFFF1F5F9);
      border = const Color(0xFFE2E8F0);
      text = const Color(0xFF0F172A);
      textSub = const Color(0xFF64748B);
      textDim = const Color(0x400F172A);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  PRODUCTION BACKEND — Single cloud URL (laptop NOT required)
//  Deployed on Railway.app (no bandwidth limits, always-on)
// ══════════════════════════════════════════════════════════════
const String kProductionUrl = 'https://verceltemp-six.vercel.app';
const List<String> kCandidateIps = [
  'https://verceltemp-six.vercel.app',
  'http://10.78.7.161:5000',
  'http://10.251.123.161:5000',
  'http://10.0.2.2:5000',
  'http://localhost:5000',
];

String _cachedBackendUrl = kProductionUrl;
String get kServerIp => _cachedBackendUrl;
String get kBaseUrl => _cachedBackendUrl;

Future<String> resolveBaseUrl() async {
  for (final url in kCandidateIps) {
    try {
      final res = await http.get(Uri.parse('$url/api/health')).timeout(const Duration(milliseconds: 2000));
      if (res.statusCode == 200) {
        _cachedBackendUrl = url;
        return url;
      }
    } catch (_) {}
  }
  _cachedBackendUrl = kProductionUrl;
  return _cachedBackendUrl;
}

// Default headers
const Map<String, String> kHeaders = {
  'Content-Type': 'application/json',
  'bypass-tunnel-reminder': 'true',
};

const List<Map<String, dynamic>> kServices = [
  {'name': 'Plumbing',            'icon': '🔧', 'color': 0xFF7C3AED, 'price': 499},
  {'name': 'Electrical',          'icon': '⚡', 'color': 0xFFF59E0B, 'price': 599},
  {'name': 'Cleaning',            'icon': '🧹', 'color': 0xFF10B981, 'price': 1299},
  {'name': 'AC Repair',           'icon': '❄️', 'color': 0xFF06B6D4, 'price': 799},
  {'name': 'Carpentry',           'icon': '🪚', 'color': 0xFFEC4899, 'price': 699},
  {'name': 'Painting',            'icon': '🎨', 'color': 0xFFEF4444, 'price': 2499},
  {'name': 'Pest Control',        'icon': '🐛', 'color': 0xFF8B5CF6, 'price': 999},
  {'name': 'CCTV Setup',          'icon': '📹', 'color': 0xFF059669, 'price': 3499},
  {'name': 'Photo Studio',        'icon': '📸', 'color': 0xFFE11D48, 'price': 4999},
  {'name': 'Wedding Tent House',  'icon': '🎪', 'color': 0xFFD97706, 'price': 9999},
  {'name': 'Catering Services',   'icon': '🍽', 'color': 0xFF059669, 'price': 299},
  {'name': 'Decoration Services', 'icon': '🎀', 'color': 0xFF9333EA, 'price': 2999},
  {'name': 'DJ & Music',           'icon': '🎵', 'color': 0xFF2563EB, 'price': 4999},
  {'name': 'Videography',         'icon': '🎥', 'color': 0xFFDC2626, 'price': 5999},
  {'name': 'Vehicle Rental',      'icon': '🚗', 'color': 0xFF4F46E5, 'price': 3499},
  {'name': 'Makeup Artist',       'icon': '💄', 'color': 0xFFDB2777, 'price': 1999},
];
