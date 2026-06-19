import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';
import 'worker_home_screen.dart';

class WorkerLoginScreen extends StatefulWidget {
  const WorkerLoginScreen({super.key});
  @override
  State<WorkerLoginScreen> createState() => _WorkerLoginScreenState();
}

class _WorkerLoginScreenState extends State<WorkerLoginScreen>
    with SingleTickerProviderStateMixin {
  final _workerIdCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _workerIdCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final id = _workerIdCtrl.text.trim();
    final pass = _passwordCtrl.text.trim();
    if (id.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Please enter Worker ID and Password');
      return;
    }
    setState(() { _loading = true; _error = null; });

    final result = await context.read<WorkerProvider>().login(id, pass);
    if (!mounted) return;

    if (result['success'] == true) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const WorkerHomeScreen()),
      );
    } else {
      setState(() {
        _error = result['error'] ?? 'Login failed';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [const Color(0xFF060612), const Color(0xFF0D0528), const Color(0xFF1A0533)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnim,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 40),

                  // Header
                  Center(
                    child: Column(children: [
                      Container(
                        width: 90, height: 90,
                        decoration: BoxDecoration(
                          gradient: AppColors.primaryGradient,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.4), blurRadius: 24, offset: const Offset(0, 8))],
                        ),
                        child: const Center(child: Text('👷', style: TextStyle(fontSize: 44))),
                      ),
                      const SizedBox(height: 20),
                      Text('Worker Login', style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white)),
                      const SizedBox(height: 8),
                      Text('Enter your Worker ID & Password\nreceived from FixoN Admin',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 13, color: Colors.white60, height: 1.5)),
                    ]),
                  ),

                  const SizedBox(height: 48),

                  // Worker ID field
                  _label('Worker ID'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _workerIdCtrl,
                    style: const TextStyle(color: Colors.white, letterSpacing: 1.5, fontWeight: FontWeight.w700),
                    textCapitalization: TextCapitalization.characters,
                    decoration: _inputDeco('e.g. FIXON_PLM_1001', Icons.badge_outlined),
                    onSubmitted: (_) => _login(),
                  ),

                  const SizedBox(height: 16),

                  // Password field
                  _label('Password'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _passwordCtrl,
                    obscureText: _obscure,
                    style: const TextStyle(color: Colors.white, letterSpacing: 2),
                    decoration: _inputDeco('Enter password', Icons.lock_outline).copyWith(
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: Colors.white38),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    onSubmitted: (_) => _login(),
                  ),

                  // Error
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.error.withOpacity(0.3)),
                      ),
                      child: Row(children: [
                        Icon(Icons.error_outline, color: AppColors.error, size: 18),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_error!, style: GoogleFonts.inter(color: AppColors.error, fontSize: 13))),
                      ]),
                    ),
                  ],

                  const SizedBox(height: 32),

                  // Login Button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        padding: EdgeInsets.zero,
                      ),
                      child: Ink(
                        decoration: BoxDecoration(
                          gradient: AppColors.primaryGradient,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6))],
                        ),
                        child: Center(
                          child: _loading
                              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                              : Text('Login as Worker 👷', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Info Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                    ),
                    child: Column(children: [
                      Row(children: [
                        const Text('💡', style: TextStyle(fontSize: 18)),
                        const SizedBox(width: 8),
                        Text('Test Worker Credentials', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 14)),
                      ]),
                      const SizedBox(height: 12),
                      _credRow('Raju (Plumber)', 'FIXON_PLM_1001', 'FXN1001'),
                      _credRow('Srinivas (Electrician)', 'FIXON_ELC_1001', 'FXN1002'),
                      _credRow('Vijay (AC Repair)', 'FIXON_ACR_1001', 'FXN1004'),
                    ]),
                  ),

                  const SizedBox(height: 24),


                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text, style: GoogleFonts.inter(color: Colors.white60, fontSize: 13, fontWeight: FontWeight.w600));

  InputDecoration _inputDeco(String hint, IconData icon) => InputDecoration(
    hintText: hint,
    prefixIcon: Icon(icon, color: Colors.white38, size: 20),
    hintStyle: TextStyle(color: Colors.white24),
    filled: true,
    fillColor: Colors.white.withOpacity(0.06),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white12)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white12)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: AppColors.primary, width: 1.5)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );

  Widget _credRow(String name, String id, String pass) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(children: [
      Expanded(child: Text(name, style: GoogleFonts.inter(color: Colors.white54, fontSize: 11))),
      GestureDetector(
        onTap: () => _workerIdCtrl.text = id,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
          child: Text(id, style: GoogleFonts.inter(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.w700)),
        ),
      ),
      const SizedBox(width: 6),
      GestureDetector(
        onTap: () => _passwordCtrl.text = pass,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: AppColors.success.withOpacity(0.12), borderRadius: BorderRadius.circular(6)),
          child: Text(pass, style: GoogleFonts.inter(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.w700)),
        ),
      ),
    ]),
  );
}
