import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import '../home/home_screen.dart';
import 'login_screen.dart';

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
    final firstName = _firstNameCtrl.text.trim();
    final lastName  = _lastNameCtrl.text.trim();
    final email     = _emailCtrl.text.trim();
    final phone     = _phoneCtrl.text.trim();
    final password  = _passwordCtrl.text;

    if (firstName.isEmpty) { setState(() => _error = 'Please enter your First Name'); return; }
    if (lastName.isEmpty)  { setState(() => _error = 'Please enter your Last Name');  return; }
    if (email.isEmpty)     { setState(() => _error = 'Please enter your Email');       return; }
    if (phone.length < 10) { setState(() => _error = 'Please enter a valid 10-digit phone number'); return; }
    if (password.length < 6) { setState(() => _error = 'Password must be at least 6 characters'); return; }

    final auth = context.read<AuthProvider>();
    final fullName = '$firstName $lastName';
    final ok = await auth.register(
      fullName, email, phone, password,
      firstName: firstName,
      lastName: lastName,
    );
    if (ok && mounted) {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      setState(() => _error = 'Registration failed. Please check your details and try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),
                IconButton(
                  onPressed: () {
                    if (Navigator.canPop(context)) {
                      Navigator.pop(context);
                    } else {
                      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                    }
                  },
                  icon: Icon(Icons.arrow_back_ios, color: AppColors.text),
                ),
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
                    style: TextStyle(color: AppColors.text),
                    decoration: InputDecoration(hintText: field['hint'] as String, prefixIcon: Icon(field['icon'] as IconData, color: AppColors.textSub)),
                  ),
                  const SizedBox(height: 16),
                ],

                Text('Password', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSub)),
                const SizedBox(height: 8),
                TextField(
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  style: TextStyle(color: AppColors.text),
                  decoration: InputDecoration(
                    hintText: 'Min 6 characters',
                    prefixIcon: Icon(Icons.lock_outline, color: AppColors.textSub),
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
                    onTap: () {
                      if (Navigator.canPop(context)) {
                        Navigator.pop(context);
                      } else {
                        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                      }
                    },
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

