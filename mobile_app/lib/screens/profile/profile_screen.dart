import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/theme_provider.dart';
import '../../utils/constants.dart';
import '../../utils/strings.dart';
import '../auth/login_screen.dart';
import 'edit_profile_screen.dart';
import 'saved_payment_methods_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String? _base64Image;

  @override
  void initState() {
    super.initState();
    _loadProfilePhoto();
  }

  Future<void> _loadProfilePhoto() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _base64Image = prefs.getString('profile_photo');
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final theme = context.watch<ThemeProvider>();
    final user = auth.user ?? {};

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 80),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${AppStrings.profile} 👤', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text)),
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
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient, 
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.4), blurRadius: 16)],
                image: _base64Image != null
                    ? DecorationImage(image: MemoryImage(base64Decode(_base64Image!)), fit: BoxFit.cover)
                    : null,
              ),
              child: _base64Image == null
                  ? Center(child: Text((user['name'] ?? 'U').toString()[0].toUpperCase(),
                      style: GoogleFonts.outfit(fontSize: 30, fontWeight: FontWeight.w900, color: Colors.white)))
                  : null,
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
              Text(s['icon']!, style: TextStyle(fontSize: 22)),
              const SizedBox(height: 6),
              Text(s['value']!, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.text)),
              Text(s['label']!, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
            ]),
          )),
        ]),

        const SizedBox(height: 22),

        // Menu Items
        _section(AppStrings.account, [
          _MenuItem(icon: Icons.person_outline, label: AppStrings.editProfile, color: AppColors.primary, onTap: () async {
            final changed = await Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen()));
            if (changed == true) {
              _loadProfilePhoto();
            }
          }),
          _MenuItem(icon: Icons.location_on_outlined, label: AppStrings.savedAddresses, color: AppColors.secondary, onTap: () {}),
          _MenuItem(icon: Icons.payment_outlined, label: AppStrings.paymentMethods, color: AppColors.success, onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const SavedPaymentMethodsScreen()));
          }),
        ]),

        const SizedBox(height: 14),

        _section(AppStrings.preferences, [
          _MenuItem(
            icon: theme.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
            label: theme.isDark ? AppStrings.switchToLight : AppStrings.switchToDark,
            color: AppColors.accent,
            trailing: Switch(value: theme.isDark, onChanged: (_) => context.read<ThemeProvider>().toggle(), activeColor: AppColors.primary),
            onTap: () => context.read<ThemeProvider>().toggle(),
          ),
          _MenuItem(icon: Icons.notifications_outlined, label: AppStrings.notifications, color: AppColors.primary, onTap: () {}),
          _MenuItem(icon: Icons.language_outlined, label: AppStrings.language, color: AppColors.secondary, onTap: () {
            showModalBottomSheet(
              context: context,
              backgroundColor: AppColors.card,
              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
              builder: (_) => Container(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Select Language', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.text)),
                    const SizedBox(height: 20),
                    ListTile(
                      title: Text('English', style: TextStyle(color: AppColors.text, fontWeight: AppStrings.lang == 'en' ? FontWeight.bold : null)),
                      trailing: AppStrings.lang == 'en' ? Icon(Icons.check_circle, color: AppColors.primary) : null,
                      onTap: () { AppStrings.setLang('en'); setState((){}); Navigator.pop(context); },
                    ),
                    Divider(color: AppColors.border),
                    ListTile(
                      title: Text('తెలుగు (Telugu)', style: TextStyle(color: AppColors.text, fontWeight: AppStrings.lang == 'te' ? FontWeight.bold : null)),
                      trailing: AppStrings.lang == 'te' ? Icon(Icons.check_circle, color: AppColors.primary) : null,
                      onTap: () { AppStrings.setLang('te'); setState((){}); Navigator.pop(context); },
                    ),
                     Divider(color: AppColors.border),
                    ListTile(
                      title: Text('हिंदी (Hindi)', style: TextStyle(color: AppColors.text, fontWeight: AppStrings.lang == 'hi' ? FontWeight.bold : null)),
                      trailing: AppStrings.lang == 'hi' ? Icon(Icons.check_circle, color: AppColors.primary) : null,
                      onTap: () { AppStrings.setLang('hi'); setState((){}); Navigator.pop(context); },
                    ),
                  ],
                ),
              ),
            );
          }),
        ]),

        const SizedBox(height: 14),

        _section(AppStrings.support, [
          _MenuItem(icon: Icons.help_outline, label: AppStrings.helpFAQ, color: AppColors.secondary, onTap: () {}),
          _MenuItem(
            icon: Icons.chat_bubble_outline,
            label: AppStrings.contactSupport,
            color: AppColors.primary,
            onTap: () => _showContactSupport(context, user),
          ),
          _MenuItem(
            icon: Icons.star_outline,
            label: AppStrings.rateFixon,
            color: AppColors.accent,
            onTap: () => _rateApp(context),
          ),
          _MenuItem(icon: Icons.share_outlined, label: AppStrings.referEarn, color: AppColors.success, onTap: () {
            showModalBottomSheet(
              context: context,
              backgroundColor: AppColors.card,
              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
              builder: (_) => Container(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 60, height: 60,
                      decoration: BoxDecoration(color: AppColors.success.withOpacity(0.15), shape: BoxShape.circle),
                      child: Icon(Icons.redeem, color: AppColors.success, size: 30),
                    ),
                    const SizedBox(height: 16),
                    Text('Refer & Earn ₹200', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.text)),
                    const SizedBox(height: 8),
                    Text('Share your code with friends. When they book their first service, you both get ₹200 off!',
                        textAlign: TextAlign.center, style: GoogleFonts.inter(color: AppColors.textSub)),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.bg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('FIXON-2026', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 2, color: AppColors.primary)),
                          Icon(Icons.copy, color: AppColors.primary, size: 20),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => Navigator.pop(context),
                        icon: Icon(Icons.share, color: Colors.white),
                        label: Text('Share Now', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 16)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
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
              Icon(Icons.logout, color: AppColors.error, size: 22),
              const SizedBox(width: 14),
              Text(AppStrings.logout, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.error)),
            ]),
          ),
        ),
        const SizedBox(height: 14),
        Center(child: Text('${AppStrings.appName} ${AppStrings.version} • ${AppStrings.madeWithLove}', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textDim))),
        const SizedBox(height: 20),
      ]),
    );
  }

  Future<void> _rateApp(BuildContext context) async {
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.fixon.app';
    final uri = Uri.parse(playStoreUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.card,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Text('Rate FixoN ⭐', style: GoogleFonts.outfit(color: AppColors.text, fontWeight: FontWeight.bold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('⭐⭐⭐⭐⭐', style: TextStyle(fontSize: 36)),
                const SizedBox(height: 12),
                Text('Enjoying FixoN? Your review means a lot to us!', textAlign: TextAlign.center, style: GoogleFonts.inter(color: AppColors.textSub)),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Maybe Later', style: TextStyle(color: AppColors.textSub))),
              ElevatedButton(
                onPressed: () { Navigator.pop(ctx); },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                child: const Text('⭐ Rate Us', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );
      }
    }
  }

  void _showContactSupport(BuildContext context, Map<String, dynamic> user) {
    final bookingId = user['_id'] ?? '';
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            Text('Contact Support', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.text)),
            const SizedBox(height: 6),
            Text('We are here to help you 24/7', style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 13)),
            const SizedBox(height: 20),
            _supportOption(Icons.chat_bubble_outline, 'Chat on WhatsApp', 'Fastest response', AppColors.success, () async {
              final msg = Uri.encodeComponent('Hello FixoN Support! My ID: $bookingId');
              final uri = Uri.parse('https://wa.me/919876543210?text=$msg');
              if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
            }),
            const SizedBox(height: 10),
            _supportOption(Icons.call_outlined, 'Call Support', 'Mon-Sat 9AM-8PM', AppColors.primary, () async {
              final uri = Uri.parse('tel:+919876543210');
              if (await canLaunchUrl(uri)) await launchUrl(uri);
            }),
            const SizedBox(height: 10),
            _supportOption(Icons.email_outlined, 'Email Support', 'Reply within 24h', AppColors.accent, () async {
              final subject = Uri.encodeComponent('FixoN Support Request - User: $bookingId');
              final body = Uri.encodeComponent('Hello FixoN Support,\n\nMy User ID: $bookingId\n\nIssue: ');
              final uri = Uri.parse('mailto:support@fixon.in?subject=$subject&body=$body');
              if (await canLaunchUrl(uri)) await launchUrl(uri);
            }),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _supportOption(IconData icon, String title, String subtitle, Color color, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.07),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Row(children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle), child: Icon(icon, color: color, size: 20)),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.text, fontSize: 14)),
              Text(subtitle, style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 12)),
            ])),
            Icon(Icons.chevron_right, color: AppColors.textSub, size: 20),
          ]),
        ),
      ),
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
        trailing ?? Icon(Icons.chevron_right, color: AppColors.textSub, size: 20),
      ]),
    ),
  );
}

