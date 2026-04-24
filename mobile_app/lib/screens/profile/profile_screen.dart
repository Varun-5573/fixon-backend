import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/theme_provider.dart';
import '../../utils/constants.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final theme = context.watch<ThemeProvider>();
    final user = auth.user ?? {};

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 80),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Profile 👤', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text)),
        const SizedBox(height: 24),

        // Profile Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [AppColors.primary.withOpacity(0.15), AppColors.secondary.withOpacity(0.08)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.primary.withOpacity(0.2)),
          ),
          child: Row(children: [
            Container(
              width: 70, height: 70,
              decoration: BoxDecoration(gradient: AppColors.primaryGradient, borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.4), blurRadius: 16)]),
              child: Center(child: Text((user['name'] ?? 'U').toString()[0].toUpperCase(),
                style: GoogleFonts.outfit(fontSize: 30, fontWeight: FontWeight.w900, color: Colors.white))),
            ),
            const SizedBox(width: 18),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(user['name']?.toString() ?? 'User', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
              const SizedBox(height: 4),
              Text(user['email']?.toString() ?? '', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
              const SizedBox(height: 4),
              if (user['phone'] != null) Text('📞 ${user['phone']}', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
            ])),
          ]),
        ),

        const SizedBox(height: 22),

        // Stats Row
        Row(children: [
          for (final s in [
            {'label': 'Bookings', 'value': '5', 'icon': '📦'},
            {'label': 'Completed', 'value': '3', 'icon': '✅'},
            {'label': 'Ratings', 'value': '4.8', 'icon': '⭐'},
          ]) Expanded(child: Container(
            margin: EdgeInsets.only(right: s['label'] != 'Ratings' ? 10 : 0),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
            child: Column(children: [
              Text(s['icon']!, style: const TextStyle(fontSize: 22)),
              const SizedBox(height: 6),
              Text(s['value']!, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.text)),
              Text(s['label']!, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
            ]),
          )),
        ]),

        const SizedBox(height: 22),

        // Menu Items
        _section('Account', [
          _MenuItem(icon: Icons.person_outline, label: 'Edit Profile', color: AppColors.primary, onTap: () {}),
          _MenuItem(icon: Icons.location_on_outlined, label: 'Saved Addresses', color: AppColors.secondary, onTap: () {}),
          _MenuItem(icon: Icons.payment_outlined, label: 'Payment Methods', color: AppColors.success, onTap: () {}),
        ]),

        const SizedBox(height: 14),

        _section('Preferences', [
          _MenuItem(
            icon: theme.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
            label: theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
            color: AppColors.accent,
            trailing: Switch(value: theme.isDark, onChanged: (_) => context.read<ThemeProvider>().toggle(), activeColor: AppColors.primary),
            onTap: () => context.read<ThemeProvider>().toggle(),
          ),
          _MenuItem(icon: Icons.notifications_outlined, label: 'Notifications', color: AppColors.primary, onTap: () {}),
          _MenuItem(icon: Icons.language_outlined, label: 'Language', color: AppColors.secondary, onTap: () {}),
        ]),

        const SizedBox(height: 14),

        _section('Support', [
          _MenuItem(icon: Icons.help_outline, label: 'Help & FAQ', color: AppColors.secondary, onTap: () {}),
          _MenuItem(icon: Icons.chat_bubble_outline, label: 'Contact Support', color: AppColors.primary, onTap: () {}),
          _MenuItem(icon: Icons.star_outline, label: 'Rate FixoN', color: AppColors.accent, onTap: () {}),
          _MenuItem(icon: Icons.share_outlined, label: 'Refer & Earn ₹200', color: AppColors.success, onTap: () {}),
        ]),

        const SizedBox(height: 14),

        // Logout
        GestureDetector(
          onTap: () async {
            // ✅ Stop location tracking before logout
            context.read<LocationProvider>().stopTracking();
            await auth.logout();
            if (context.mounted) {
              Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
            }
          },
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.error.withOpacity(0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.error.withOpacity(0.25)),
            ),
            child: Row(children: [
              const Icon(Icons.logout, color: AppColors.error, size: 22),
              const SizedBox(width: 14),
              Text('Logout', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.error)),
            ]),
          ),
        ),
        const SizedBox(height: 14),
        Center(child: Text('FixoN v1.0.0 • Made with ❤️ in India', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textDim))),
        const SizedBox(height: 20),
      ]),
    );
  }

  Widget _section(String title, List<Widget> items) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(title, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSub, letterSpacing: 1)),
    const SizedBox(height: 10),
    Container(
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: Column(children: items),
    ),
  ]);
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Widget? trailing;
  final VoidCallback onTap;
  const _MenuItem({required this.icon, required this.label, required this.color, this.trailing, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(children: [
        Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 18)),
        const SizedBox(width: 14),
        Expanded(child: Text(label, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.text))),
        trailing ?? const Icon(Icons.chevron_right, color: AppColors.textSub, size: 20),
      ]),
    ),
  );
}
