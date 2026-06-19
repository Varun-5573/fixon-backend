import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'screens/splash_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/booking_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/location_provider.dart';
import 'providers/worker_provider.dart';
import 'utils/constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider(), lazy: false),
        ChangeNotifierProvider(create: (_) => BookingProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
        ChangeNotifierProvider(create: (_) => WorkerProvider()),
      ],
      child: const FixoNApp(),
    ),
  );
}

class FixoNApp extends StatelessWidget {
  const FixoNApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, _) {
        return MaterialApp(key: ValueKey(themeProvider.isDark),
          title: 'FixoN',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: themeProvider.isDark ? ThemeMode.dark : ThemeMode.light,
          home: const SplashScreen(),
        );
      },
    );
  }
}

class AppTheme {
  static ThemeData get darkTheme => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: ColorScheme.dark(
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      surface: AppColors.surface,
      error: AppColors.error,
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.light,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: AppColors.primary, width: 2),
      ),
      hintStyle: TextStyle(color: AppColors.textSub),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(vertical: 16),
        textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
  );

  static ThemeData get lightTheme => ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: const Color(0xFFF8FAFC),
    colorScheme: ColorScheme.light(
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      surface: const Color(0xFFFFFFFF),
      error: AppColors.error,
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      foregroundColor: Color(0xFF0F172A),
    ),
    cardColor: Colors.white,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: AppColors.primary, width: 2),
      ),
      hintStyle: const TextStyle(color: Color(0xFF64748B)),
      labelStyle: const TextStyle(color: Color(0xFF64748B)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(vertical: 16),
        textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    listTileTheme: const ListTileThemeData(
      tileColor: Colors.white,
      textColor: Color(0xFF0F172A),
      iconColor: Color(0xFF0F172A),
    ),
    dividerColor: const Color(0xFFE2E8F0),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? AppColors.primary : Colors.grey),
      trackColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? AppColors.primary.withOpacity(0.3) : Colors.grey.shade300),
    ),
  );
}


