import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:math' as math;
import '../../utils/constants.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../auth/register_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> with TickerProviderStateMixin {
  final _pageCtrl = PageController();
  int _current = 0;

  late AnimationController _iconCtrl;
  late AnimationController _bgCtrl;
  late AnimationController _slideCtrl;

  final _pages = [
    _OnboardPage(
      icon: '🔧',
      title: 'Find Expert\nProfessionals',
      subtitle: 'Connect instantly with verified, skilled workers for your home services. Quality guaranteed.',
      color: AppColors.primary,
      bg: Color(0xFF1A0533),
      particles: ['⚡', '🔩', '🪛', '🔨', '🪚'],
    ),
    _OnboardPage(
      icon: '📅',
      title: 'Book in\nSeconds',
      subtitle: 'Schedule any home service at your convenience. Same-day booking available 24/7.',
      color: AppColors.secondary,
      bg: Color(0xFF001A22),
      particles: ['📱', '⏰', '✅', '🗓️', '🌟'],
    ),
    _OnboardPage(
      icon: '🗺️',
      title: 'Real-Time\nTracking',
      subtitle: 'Watch your worker arrive in real-time on the map. Know exactly when they will be there.',
      color: Color(0xFF10B981),
      bg: Color(0xFF001A10),
      particles: ['📍', '🚗', '🏠', '📡', '⚡'],
    ),
    _OnboardPage(
      icon: '💰',
      title: 'Transparent\nPricing',
      subtitle: 'No hidden charges. Know exactly what you pay before booking. Save with exclusive offers.',
      color: AppColors.accent,
      bg: Color(0xFF1A1100),
      particles: ['💳', '🏷️', '🎁', '💎', '✨'],
    ),
  ];

  @override
  void initState() {
    super.initState();
    _iconCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _bgCtrl    = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat(reverse: true);
    _slideCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _iconCtrl.forward();
    _slideCtrl.forward();
  }

  @override
  void dispose() {
    _pageCtrl.dispose(); _iconCtrl.dispose(); _bgCtrl.dispose(); _slideCtrl.dispose();
    super.dispose();
  }

  void _next() {
    if (_current < _pages.length - 1) {
      _iconCtrl.reset();
      _slideCtrl.reset();
      _pageCtrl.nextPage(duration: const Duration(milliseconds: 450), curve: Curves.easeInOutCubic);
      Future.delayed(const Duration(milliseconds: 200), () {
        _iconCtrl.forward();
        _slideCtrl.forward();
      });
    } else {
      _goToLogin();
    }
  }

  void _goToLogin() async {
    final p = await SharedPreferences.getInstance();
    await p.setBool('hasSeenOnboarding', true);

    if (!mounted) return;
    Navigator.pushReplacement(context, PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 500),
      pageBuilder: (_, __, ___) => const RegisterScreen(),
      transitionsBuilder: (_, anim, __, child) {
        return SlideTransition(
          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
              .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
    ));
  }

  @override
  Widget build(BuildContext context) {
    final page = _pages[_current];
    final size = MediaQuery.of(context).size;
    final isLast = _current == _pages.length - 1;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: AnimatedBuilder(
        animation: _bgCtrl,
        builder: (_, __) => Stack(
          children: [
            // ── Animated Background ───────────────────────────
            AnimatedContainer(
              duration: const Duration(milliseconds: 500),
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0, -0.3 + 0.1 * math.sin(_bgCtrl.value * math.pi)),
                  radius: 1.3,
                  colors: [page.bg, AppColors.bg],
                ),
              ),
            ),

            // ── Floating Emoji Particles ──────────────────────
            ..._buildFloatingParticles(size, page),

            // ── Page Content ──────────────────────────────────
            Column(
              children: [
                // Skip button
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (!isLast) TextButton(
                          onPressed: _goToLogin,
                          child: Text('Skip', style: GoogleFonts.inter(color: AppColors.textSub, fontWeight: FontWeight.w600, fontSize: 14)),
                        ),
                      ],
                    ),
                  ),
                ),

                // Page View
                Expanded(
                  child: PageView.builder(
                    controller: _pageCtrl,
                    onPageChanged: (i) {
                      setState(() => _current = i);
                    },
                    itemCount: _pages.length,
                    itemBuilder: (_, i) => _buildPage(_pages[i], i == _current),
                  ),
                ),

                // ── Bottom Controls ───────────────────────────
                _buildBottomControls(page, isLast),
                const SizedBox(height: 40),
              ],
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildFloatingParticles(Size size, _OnboardPage page) {
    final rnd = math.Random(42);
    return List.generate(page.particles.length, (i) {
      final x = rnd.nextDouble() * size.width;
      final y = rnd.nextDouble() * size.height * 0.55;
      final scale = 0.6 + rnd.nextDouble() * 0.8;
      return Positioned(
        left: x, top: y,
        child: AnimatedBuilder(
          animation: _bgCtrl,
          builder: (_, __) => Transform.translate(
            offset: Offset(
              math.sin((_bgCtrl.value + i * 0.3) * math.pi * 2) * 10,
              math.cos((_bgCtrl.value + i * 0.2) * math.pi * 2) * 14,
            ),
            child: Opacity(
              opacity: 0.12,
              child: Transform.scale(scale: scale,
                child: Text(page.particles[i], style: const TextStyle(fontSize: 32))),
            ),
          ),
        ),
      );
    });
  }

  Widget _buildPage(_OnboardPage page, bool isActive) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Animated icon
          AnimatedBuilder(
            animation: _iconCtrl,
            builder: (_, __) {
              final bounceVal = Curves.elasticOut.transform(_iconCtrl.value);
              final fadeVal = Curves.easeOut.transform(_iconCtrl.value.clamp(0.0, 1.0));
              return Opacity(
                opacity: isActive ? fadeVal : 1,
                child: Transform.scale(
                  scale: isActive ? (0.5 + 0.5 * bounceVal) : 1,
                  child: Stack(alignment: Alignment.center, children: [
                    // Glow behind icon
                    AnimatedBuilder(
                      animation: _bgCtrl,
                      builder: (_, __) => Container(
                        width: 160, height: 160,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(
                            color: page.color.withValues(alpha: 0.2 + 0.1 * _bgCtrl.value),
                            blurRadius: 50, spreadRadius: 10,
                          )],
                        ),
                      ),
                    ),
                    // Icon container
                    Container(
                      width: 140, height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(colors: [page.color.withValues(alpha: 0.25), page.color.withValues(alpha: 0.05)]),
                        border: Border.all(color: page.color.withValues(alpha: 0.35), width: 2),
                      ),
                      child: Center(child: Text(page.icon, style: const TextStyle(fontSize: 68))),
                    ),
                    // Rotating ring
                    AnimatedBuilder(
                      animation: _bgCtrl,
                      builder: (_, __) => Transform.rotate(
                        angle: _bgCtrl.value * math.pi * 2,
                        child: Container(
                          width: 160, height: 160,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: page.color.withValues(alpha: 0.15),
                              width: 1.5,
                            ),
                          ),
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: Container(
                              margin: const EdgeInsets.only(top: 4),
                              width: 8, height: 8,
                              decoration: BoxDecoration(shape: BoxShape.circle, color: page.color.withValues(alpha: 0.6)),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ]),
                ),
              );
            },
          ),

          const SizedBox(height: 40),

          // Title with slide animation
          AnimatedBuilder(
            animation: _slideCtrl,
            builder: (_, __) {
              final val = Curves.easeOutCubic.transform(_slideCtrl.value.clamp(0.0, 1.0));
              return Opacity(
                opacity: isActive ? val : 1,
                child: Transform.translate(
                  offset: Offset(0, isActive ? 30 * (1 - val) : 0),
                  child: Text(
                    page.title,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 38, fontWeight: FontWeight.w900,
                      color: AppColors.text, height: 1.15,
                      shadows: [Shadow(color: page.color.withValues(alpha: 0.3), blurRadius: 20)],
                    ),
                  ),
                ),
              );
            },
          ),

          const SizedBox(height: 18),

          // Subtitle
          AnimatedBuilder(
            animation: _slideCtrl,
            builder: (_, __) {
              final val = Curves.easeOut.transform(((_slideCtrl.value - 0.2) / 0.8).clamp(0.0, 1.0));
              return Opacity(
                opacity: isActive ? val : 1,
                child: Transform.translate(
                  offset: Offset(0, isActive ? 20 * (1 - val) : 0),
                  child: Text(
                    page.subtitle,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(fontSize: 15, color: AppColors.textSub, height: 1.65),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls(_OnboardPage page, bool isLast) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(children: [
        // Dot indicators
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_pages.length, (i) {
            final isActive = i == _current;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOutCubic,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: isActive ? 28 : 8,
              height: 8,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                color: isActive ? page.color : AppColors.textSub.withValues(alpha: 0.3),
                boxShadow: isActive ? [BoxShadow(color: page.color.withValues(alpha: 0.5), blurRadius: 8)] : [],
              ),
            );
          }),
        ),

        const SizedBox(height: 32),

        // Next / Get Started Button
        GestureDetector(
          onTap: _next,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(
                colors: [page.color, page.color.withValues(alpha: 0.7)],
                begin: Alignment.centerLeft, end: Alignment.centerRight,
              ),
              boxShadow: [BoxShadow(color: page.color.withValues(alpha: 0.4), blurRadius: 24, offset: const Offset(0, 8))],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  isLast ? '🚀  Get Started' : 'Next',
                  style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                if (!isLast) ...[
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                ],
              ],
            ),
          ),
        ),

        if (isLast) ...[
          const SizedBox(height: 14),
          GestureDetector(
            onTap: _goToLogin,
            child: Text('Already have an account? Sign In',
              style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
          ),
        ],
      ]),
    );
  }
}

class _OnboardPage {
  final String icon, title, subtitle;
  final Color color, bg;
  final List<String> particles;
  const _OnboardPage({required this.icon, required this.title, required this.subtitle, required this.color, required this.bg, required this.particles});
}
