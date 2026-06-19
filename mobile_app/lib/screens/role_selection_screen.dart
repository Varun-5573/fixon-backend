import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/constants.dart';
import 'auth/login_screen.dart';
import 'worker/worker_login_screen.dart';

class RoleSelectionScreen extends StatefulWidget {
  const RoleSelectionScreen({super.key});

  @override
  State<RoleSelectionScreen> createState() => _RoleSelectionScreenState();
}

class _RoleSelectionScreenState extends State<RoleSelectionScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _customerSlide;
  late Animation<Offset> _workerSlide;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _fadeAnim = CurvedAnimation(
      parent: _animCtrl,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    );

    _customerSlide = Tween<Offset>(
      begin: const Offset(-0.3, 0.0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animCtrl,
      curve: const Interval(0.2, 0.8, curve: Curves.easeOutBack),
    ));

    _workerSlide = Tween<Offset>(
      begin: const Offset(0.3, 0.0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animCtrl,
      curve: const Interval(0.3, 0.9, curve: Curves.easeOutBack),
    ));

    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF060612), Color(0xFF0D0528), Color(0xFF1A0533)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              children: [
                const SizedBox(height: 40),
                
                // Pulsing FixoN Logo / Header
                FadeTransition(
                  opacity: _fadeAnim,
                  child: Column(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          gradient: AppColors.primaryGradient,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.4),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            )
                          ],
                        ),
                        child: const Center(
                          child: Text('🔧', style: TextStyle(fontSize: 38)),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'FixoN',
                        style: GoogleFonts.montserrat(
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                          fontStyle: FontStyle.italic,
                          color: Colors.white,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Choose how you want to continue',
                        style: GoogleFonts.inter(
                          color: Colors.white60,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                
                const Spacer(),

                // Customer Selection Card
                SlideTransition(
                  position: _customerSlide,
                  child: FadeTransition(
                    opacity: _fadeAnim,
                    child: _RoleCard(
                      title: 'Book a Service',
                      subtitle: 'Find trusted professionals for your home',
                      icon: '🙋‍♂️',
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withOpacity(0.8),
                          AppColors.primary.withOpacity(0.3),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderColor: AppColors.primary.withOpacity(0.5),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                        );
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 20),

                // Worker Selection Card
                SlideTransition(
                  position: _workerSlide,
                  child: FadeTransition(
                    opacity: _fadeAnim,
                    child: _RoleCard(
                      title: 'Join as Partner',
                      subtitle: 'Earn money, manage jobs & grow your business',
                      icon: '👷‍♂️',
                      gradient: LinearGradient(
                        colors: [
                          AppColors.secondary.withOpacity(0.8),
                          AppColors.secondary.withOpacity(0.3),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderColor: AppColors.secondary.withOpacity(0.5),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const WorkerLoginScreen()),
                        );
                      },
                    ),
                  ),
                ),

                const Spacer(),
                
                // Footer
                FadeTransition(
                  opacity: _fadeAnim,
                  child: Text(
                    'FixoN Premium Services Platform',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: Colors.white38,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String icon;
  final Gradient gradient;
  final Color borderColor;
  final VoidCallback onTap;

  const _RoleCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.gradient,
    required this.borderColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          )
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.outfit(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        subtitle,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: Colors.white70,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      icon,
                      style: const TextStyle(fontSize: 32),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
