import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:math' as math;
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../utils/constants.dart';
import 'onboarding/onboarding_screen.dart';
import 'auth/register_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'home/home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  // Controllers
  late AnimationController _bgCtrl;      // Background gradient shift
  late AnimationController _logoCtrl;    // Logo scale + fade
  late AnimationController _ringCtrl;    // Pulsing ring
  late AnimationController _particleCtrl;// Floating particles
  late AnimationController _textCtrl;   // Text reveal
  late AnimationController _exitCtrl;   // Exit animation

  // Particles
  final List<_Particle> _particles = [];
  final math.Random _rnd = math.Random();

  @override
  void initState() {
    super.initState();
    _spawnParticles();

    _bgCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat(reverse: true);
    _logoCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));
    _ringCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();
    _particleCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 6))..repeat();
    _textCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
    _exitCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));

    _startSequence();
  }

  void _spawnParticles() {
    for (int i = 0; i < 30; i++) {
      _particles.add(_Particle(
        x: _rnd.nextDouble(),
        y: _rnd.nextDouble(),
        size: _rnd.nextDouble() * 5 + 2,
        speed: _rnd.nextDouble() * 0.3 + 0.1,
        opacity: _rnd.nextDouble() * 0.5 + 0.1,
        color: _rnd.nextBool() ? AppColors.primary : AppColors.secondary,
        angle: _rnd.nextDouble() * 2 * math.pi,
      ));
    }
  }

  Future<void> _startSequence() async {
    // Step 1: Logo appears with spring bounce
    await Future.delayed(const Duration(milliseconds: 200));
    _logoCtrl.forward();

    // Step 2: Text letter-by-letter reveal
    await Future.delayed(const Duration(milliseconds: 700));
    _textCtrl.forward();

    // Step 3: Stay → then exit
    await Future.delayed(const Duration(milliseconds: 2800));
    _exitCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;

    final p = await SharedPreferences.getInstance();
    final hasSeenOnboarding = p.getBool('hasSeenOnboarding') ?? false;
    final String? localToken = p.getString('fixon_token');
    final bool isLoggedDirectly = localToken != null && localToken.isNotEmpty;

    Navigator.pushReplacement(context, PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 500),
      // ✅ Now using isLoggedDirectly based purely on SharedPreferences to prevent race condition
      pageBuilder: (_, __, ___) => isLoggedDirectly ? const HomeScreen() : (!hasSeenOnboarding ? const OnboardingScreen() : const RegisterScreen()),
      transitionsBuilder: (_, anim, __, child) => FadeTransition(
        opacity: anim,
        child: SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
          child: child,
        ),
      ),
    ));
  }

  @override
  void dispose() {
    _bgCtrl.dispose(); _logoCtrl.dispose(); _ringCtrl.dispose();
    _particleCtrl.dispose(); _textCtrl.dispose(); _exitCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: AnimatedBuilder(
        animation: Listenable.merge([_bgCtrl, _logoCtrl, _ringCtrl, _particleCtrl, _textCtrl, _exitCtrl]),
        builder: (context, _) {
          final exitVal = _exitCtrl.value;
          return Opacity(
            opacity: 1 - exitVal,
            child: Transform.scale(
              scale: 1 + exitVal * 0.05,
              child: Stack(
                children: [
                  // ── Animated Background Gradient ──────────────
                  Container(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: Alignment(
                          0.5 * math.sin(_bgCtrl.value * math.pi),
                          0.3 * math.cos(_bgCtrl.value * math.pi),
                        ),
                        radius: 1.5,
                        colors: [
                          Color.lerp(const Color(0xFF1A0533), const Color(0xFF051A33), _bgCtrl.value)!,
                          AppColors.bg,
                        ],
                      ),
                    ),
                  ),

                  // ── Floating Particles ────────────────────────
                  ...List.generate(_particles.length, (i) {
                    final p = _particles[i];
                    final progress = (_particleCtrl.value + i / _particles.length) % 1.0;
                    final x = (p.x + math.cos(p.angle) * progress * p.speed) % 1.0;
                    final y = (p.y - progress * p.speed * 0.5) % 1.0;
                    final fadeEdge = math.sin(progress * math.pi);
                    return Positioned(
                      left: x * size.width,
                      top: y * size.height,
                      child: Opacity(
                        opacity: p.opacity * fadeEdge,
                        child: Container(
                          width: p.size, height: p.size,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: p.color),
                        ),
                      ),
                    );
                  }),

                  // ── Glowing orbs ──────────────────────────────
                  Positioned(top: -100, left: -80,
                    child: _GlowOrb(size: 400, color: AppColors.primary.withValues(alpha: 0.08 + 0.04 * _bgCtrl.value))),
                  Positioned(bottom: -100, right: -80,
                    child: _GlowOrb(size: 350, color: AppColors.secondary.withValues(alpha: 0.06 + 0.03 * _bgCtrl.value))),

                  // ── Center Content ────────────────────────────
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Pulsing rings
                        Stack(alignment: Alignment.center, children: [
                          // Outer ring
                          Opacity(
                            opacity: (1 - _ringCtrl.value) * 0.4,
                            child: Transform.scale(scale: 0.9 + _ringCtrl.value * 0.7,
                              child: Container(width: 170, height: 170,
                                decoration: BoxDecoration(shape: BoxShape.circle,
                                  border: Border.all(color: AppColors.primary, width: 1.5)))),
                          ),
                          // Middle ring
                          Opacity(
                            opacity: (1 - (_ringCtrl.value + 0.3) % 1) * 0.5,
                            child: Transform.scale(scale: 0.9 + ((_ringCtrl.value + 0.3) % 1) * 0.5,
                              child: Container(width: 140, height: 140,
                                decoration: BoxDecoration(shape: BoxShape.circle,
                                  border: Border.all(color: AppColors.secondary, width: 1)))),
                          ),
                          // Logo
                          _AnimatedLogo(ctrl: _logoCtrl),
                        ]),

                        const SizedBox(height: 36),

                        // Letter-by-letter animated title
                        _AnimatedTitle(ctrl: _textCtrl),

                        const SizedBox(height: 12),

                        // Tagline fade in
                        Opacity(
                          opacity: Curves.easeOut.transform(_textCtrl.value.clamp(0.0, 1.0)),
                          child: Transform.translate(
                            offset: Offset(0, 10 * (1 - _textCtrl.value.clamp(0.0, 1.0))),
                            child: Text(
                              'Your Home Service Partner',
                              style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSub, letterSpacing: 0.5),
                            ),
                          ),
                        ),

                        const SizedBox(height: 50),

                        // Animated loading bar
                        if (_textCtrl.value > 0.8) _LoadingBar(ctrl: _textCtrl),
                      ],
                    ),
                  ),

                  // ── Bottom Badge ──────────────────────────────
                  Positioned(
                    bottom: 40, left: 0, right: 0,
                    child: Opacity(
                      opacity: Curves.easeOut.transform(_textCtrl.value.clamp(0.0, 1.0)),
                      child: Column(children: [
                        Text('v1.0.0', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textDim)),
                        const SizedBox(height: 4),
                        Text('Made with ❤️ in India', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textDim)),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Logo with spring animation ──────────────────────
class _AnimatedLogo extends StatelessWidget {
  final AnimationController ctrl;
  const _AnimatedLogo({required this.ctrl});

  @override
  Widget build(BuildContext context) {
    final bounce = CurvedAnimation(parent: ctrl, curve: Curves.elasticOut);
    final fade   = CurvedAnimation(parent: ctrl, curve: const Interval(0, 0.5));
    return AnimatedBuilder(
      animation: ctrl,
      builder: (_, __) => FadeTransition(
        opacity: Tween<double>(begin: 0, end: 1).animate(fade),
        child: Transform.scale(
          scale: Tween<double>(begin: 0.3, end: 1).animate(bounce).value,
          child: Container(
            width: 110, height: 110,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(32),
              gradient: const LinearGradient(
                colors: [AppColors.primary, Color(0xFF9D5AF7), AppColors.secondary],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(color: AppColors.primary.withValues(alpha: 0.5), blurRadius: 40, spreadRadius: 4),
                BoxShadow(color: AppColors.secondary.withValues(alpha: 0.25), blurRadius: 60, spreadRadius: 2),
              ],
            ),
            child: const Center(child: Text('🔧', style: TextStyle(fontSize: 52))),
          ),
        ),
      ),
    );
  }
}

// ── Letter-by-letter title animation ─────────────────
class _AnimatedTitle extends StatelessWidget {
  final AnimationController ctrl;
  const _AnimatedTitle({required this.ctrl});

  @override
  Widget build(BuildContext context) {
    const fix = 'Fix';
    const on  = 'oN';
    return AnimatedBuilder(
      animation: ctrl,
      builder: (_, __) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ...fix.split('').asMap().entries.map((e) {
              final delay = e.key * 0.12;
              final val = ((ctrl.value - delay) / 0.4).clamp(0.0, 1.0);
              return _AnimLetter(char: e.value, progress: val, color: AppColors.primary);
            }),
            ...on.split('').asMap().entries.map((e) {
              final delay = (fix.length + e.key) * 0.12;
              final val = ((ctrl.value - delay) / 0.4).clamp(0.0, 1.0);
              return _AnimLetter(char: e.value, progress: val, color: AppColors.secondary);
            }),
          ],
        );
      },
    );
  }
}

class _AnimLetter extends StatelessWidget {
  final String char;
  final double progress;
  final Color color;
  const _AnimLetter({required this.char, required this.progress, required this.color});

  @override
  Widget build(BuildContext context) {
    final curved = Curves.elasticOut.transform(progress);
    return Opacity(
      opacity: progress,
      child: Transform.translate(
        offset: Offset(0, 30 * (1 - curved)),
        child: Text(char, style: GoogleFonts.outfit(fontSize: 52, fontWeight: FontWeight.w900, color: color, height: 1)),
      ),
    );
  }
}

// ── Animated loading bar ──────────────────────────────
class _LoadingBar extends StatelessWidget {
  final AnimationController ctrl;
  const _LoadingBar({required this.ctrl});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: ctrl,
      builder: (_, __) => Container(
        width: 160, height: 3, decoration: BoxDecoration(color: AppColors.card2, borderRadius: BorderRadius.circular(3)),
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: ctrl.value,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(3),
              gradient: const LinearGradient(colors: [AppColors.primary, AppColors.secondary]),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Glow Orb ─────────────────────────────────────────
class _GlowOrb extends StatelessWidget {
  final double size;
  final Color color;
  const _GlowOrb({required this.size, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    width: size, height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, color: color),
  );
}

// ── Particle data ─────────────────────────────────────
class _Particle {
  final double x, y, size, speed, opacity, angle;
  final Color color;
  const _Particle({required this.x, required this.y, required this.size, required this.speed, required this.opacity, required this.color, required this.angle});
}
