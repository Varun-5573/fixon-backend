import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class ThemeProvider extends ChangeNotifier {
  bool _isDark = true;
  bool get isDark => _isDark;

  ThemeProvider() { _load(); }

  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    _isDark = p.getBool('isDark') ?? true;
    AppColors.updateTheme(_isDark);
    notifyListeners();
  }

  Future<void> toggle() async {
    _isDark = !_isDark;
    final p = await SharedPreferences.getInstance();
    await p.setBool('isDark', _isDark);
    AppColors.updateTheme(_isDark);
    notifyListeners();
  }
}
