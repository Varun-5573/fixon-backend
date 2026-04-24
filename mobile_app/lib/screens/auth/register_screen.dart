import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import '../home/home_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl    = TextEditingController();
  final _phoneCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  String? _error;

  Future<void> _register() async {
    if (_firstNameCtrl.text.isEmpty || _lastNameCtrl.text.isEmpty || _emailCtrl.text.isEmpty || _phoneCtrl.text.isEmpty || _passwordCtrl.text.isEmpty) {
      setState(() => _error = 'Please fill all fields'); return;
    }
    final auth = context.read<AuthProvider>();
    final fullName = '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}';
    final ok = await auth.register(fullName, _emailCtrl.text.trim(), _phoneCtrl.text.trim(), _passwordCtrl.text);
    if (ok && mounted) {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      setState(() => _error = 'Registration failed. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),
                IconButton(onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_ios, color: AppColors.text)),
                const SizedBox(height: 16),
                Text('Create Account 🚀', style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.text)),
                const SizedBox(height: 6),
                Text('Join FixoN to book home services', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSub)),
                const SizedBox(height: 32),

                for (final field in [
                  {'label': 'First Name', 'ctrl': _firstNameCtrl, 'hint': 'John', 'icon': Icons.person_outline, 'type': TextInputType.name},
                  {'label': 'Last Name', 'ctrl': _lastNameCtrl, 'hint': 'Doe', 'icon': Icons.person_outline, 'type': TextInputType.name},
                  {'label': 'Email', 'ctrl': _emailCtrl, 'hint': 'your@email.com', 'icon': Icons.email_outlined, 'type': TextInputType.emailAddress},
                  {'label': 'Phone', 'ctrl': _phoneCtrl, 'hint': '10-digit number', 'icon': Icons.phone_outlined, 'type': TextInputType.phone},
                ]) ...[
                  Text(field['label'] as String, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSub)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: field['ctrl'] as TextEditingController,
                    keyboardType: field['type'] as TextInputType,
                    style: const TextStyle(color: AppColors.text),
                    decoration: InputDecoration(hintText: field['hint'] as String, prefixIcon: Icon(field['icon'] as IconData, color: AppColors.textSub)),
                  ),
                  const SizedBox(height: 16),
                ],

                Text('Password', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSub)),
                const SizedBox(height: 8),
                TextField(
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  style: const TextStyle(color: AppColors.text),
                  decoration: InputDecoration(
                    hintText: 'Min 6 characters',
                    prefixIcon: const Icon(Icons.lock_outline, color: AppColors.textSub),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, color: AppColors.textSub),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),

                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.error.withOpacity(0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.error.withOpacity(0.3))),
                    child: Text(_error!, style: GoogleFonts.inter(color: AppColors.error, fontSize: 12)),
                  ),
                ],

                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: auth.loading ? null : _register,
                    child: auth.loading
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('🚀 Create Account', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
                const SizedBox(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('Already have an account? ', style: GoogleFonts.inter(color: AppColors.textSub)),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Text('Sign In', style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.w700)),
                  ),
                ]),
                const SizedBox(height: 30),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
