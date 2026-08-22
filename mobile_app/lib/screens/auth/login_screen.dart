import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import '../home/home_screen.dart';
import 'register_screen.dart';
import '../worker/worker_login_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _emailCtrl    = TextEditingController(text: 'pittala@gmail.com');
  final _passwordCtrl = TextEditingController(text: 'Password@123');
  
  // OTP Fields
  final _phoneCtrl    = TextEditingController();
  final _otpCtrl      = TextEditingController();
  final _nameCtrl     = TextEditingController(text: 'Customer');
  bool _isOtpMode = false;
  bool _otpSent = false;
  String? _sentOtp;

  bool _obscure = true;
  String? _error;
  late AnimationController _animCtrl;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
        .animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _animCtrl.forward();
  }

  @override
  void dispose() { 
    _animCtrl.dispose(); 
    _emailCtrl.dispose(); 
    _passwordCtrl.dispose(); 
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose(); 
  }

  Future<void> _login() async {
    setState(() => _error = null);
    final auth = context.read<AuthProvider>();
    final ok = await auth.login(_emailCtrl.text.trim(), _passwordCtrl.text);
    if (ok && mounted) {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else if (mounted) {
      setState(() => _error = 'Invalid credentials. Try pittala@gmail.com / Password@123');
    }
  }

  Future<void> _requestOtp() async {
    setState(() => _error = null);
    if (_phoneCtrl.text.length < 10) {
      setState(() => _error = 'Please enter a valid 10-digit phone number');
      return;
    }
    final auth = context.read<AuthProvider>();
    final otp = await auth.sendOtp(_phoneCtrl.text.trim());
    if (otp != null) {
      setState(() {
        _otpSent = true;
        _sentOtp = otp;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('📱 Debug OTP: $otp (Auto-filled in production)'),
          backgroundColor: AppColors.primary,
        ),
      );
    } else {
      setState(() => _error = 'Failed to send OTP. Check your internet connection and try again.');
    }
  }

  Future<void> _verifyOtpAndLogin() async {
    setState(() => _error = null);
    if (_otpCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please enter the 6-digit OTP code');
      return;
    }
    final auth = context.read<AuthProvider>();
    final ok = await auth.verifyOtp(
      _phoneCtrl.text.trim(),
      _otpCtrl.text.trim(),
      _nameCtrl.text.trim(),
    );
    if (ok && mounted) {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else if (mounted) {
      setState(() => _error = 'Invalid or expired OTP. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: SlideTransition(
            position: _slideAnim,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 30),

                  // Logo
                  Center(
                    child: Column(
                      children: [
                        Container(
                          width: 70, height: 70,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            gradient: AppColors.primaryGradient,
                            boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.4), blurRadius: 24, spreadRadius: 2)],
                          ),
                          child: const Center(child: Text('🔧', style: TextStyle(fontSize: 34))),
                        ),
                        const SizedBox(height: 12),
                        RichText(text: TextSpan(children: [
                          TextSpan(text: 'Fix', style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.primary)),
                          TextSpan(text: 'oN', style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.secondary)),
                        ])),
                      ],
                    ),
                  ),

                  const SizedBox(height: 25),
                  Text(_isOtpMode ? 'Mobile OTP Login 📱' : 'Welcome back 👋', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.text)),
                  const SizedBox(height: 6),
                  Text(_isOtpMode ? 'Sign in quickly using your phone number' : 'Sign in to book your home services', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSub)),
                  const SizedBox(height: 20),

                  // Mode Toggle
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() { _isOtpMode = false; _error = null; }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: !_isOtpMode ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text('Email Login', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: !_isOtpMode ? Colors.white : AppColors.textSub)),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() { _isOtpMode = true; _error = null; }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: _isOtpMode ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text('OTP Login', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: _isOtpMode ? Colors.white : AppColors.textSub)),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  if (!_isOtpMode) ...[
                    // Email
                    _label('Email Address'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      style: TextStyle(color: AppColors.text),
                      decoration: InputDecoration(hintText: 'your@email.com', prefixIcon: Icon(Icons.email_outlined, color: AppColors.textSub)),
                    ),
                    const SizedBox(height: 18),

                    // Password
                    _label('Password'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _passwordCtrl,
                      obscureText: _obscure,
                      style: TextStyle(color: AppColors.text),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        prefixIcon: Icon(Icons.lock_outline, color: AppColors.textSub),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, color: AppColors.textSub),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        child: Text('Forgot Password?', style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ] else ...[
                    // Phone Number
                    _label('Phone Number'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      maxLength: 10,
                      style: TextStyle(color: AppColors.text),
                      decoration: InputDecoration(
                        hintText: '9876543210', 
                        counterText: '',
                        prefixText: '+91 ',
                        prefixStyle: TextStyle(color: AppColors.text, fontWeight: FontWeight.bold),
                        prefixIcon: Icon(Icons.phone_android_outlined, color: AppColors.textSub),
                      ),
                    ),
                    const SizedBox(height: 18),

                    if (_otpSent) ...[
                      // Name field
                      _label('Your Name (for new account)'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _nameCtrl,
                        style: TextStyle(color: AppColors.text),
                        decoration: InputDecoration(hintText: 'Enter name', prefixIcon: Icon(Icons.person_outline, color: AppColors.textSub)),
                      ),
                      const SizedBox(height: 18),

                      // OTP Field
                      _label('Enter 6-Digit OTP'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _otpCtrl,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        style: TextStyle(color: AppColors.text, letterSpacing: 8, fontSize: 18, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          hintText: '••••••', 
                          counterText: '',
                          prefixIcon: Icon(Icons.security, color: AppColors.textSub),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (_sentOtp != null)
                        Text('ℹ️ Testing OTP Code: $_sentOtp', style: GoogleFonts.inter(color: AppColors.secondary, fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 18),
                    ],
                  ],

                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.error.withOpacity(0.3)),
                      ),
                      child: Text(_error!, style: GoogleFonts.inter(color: AppColors.error, fontSize: 12)),
                    ),
                  ],

                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: auth.loading 
                          ? null 
                          : (_isOtpMode 
                              ? (_otpSent ? _verifyOtpAndLogin : _requestOtp)
                              : _login),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        backgroundColor: AppColors.primary,
                      ),
                      child: auth.loading
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(_isOtpMode ? (_otpSent ? 'Verify & Login' : 'Get OTP Code') : '🔐 Sign In', 
                              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Divider
                  Row(children: [
                    Expanded(child: Divider(color: AppColors.border)),
                    Padding(padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text('OR', style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 12))),
                    Expanded(child: Divider(color: AppColors.border)),
                  ]),

                  const SizedBox(height: 20),

                  // Google Sign In
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Text('G', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.red)),
                      label: Text('Continue with Google', style: GoogleFonts.inter(color: AppColors.text, fontWeight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: BorderSide(color: AppColors.border),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text("Don't have an account? ", style: GoogleFonts.inter(color: AppColors.textSub)),
                    GestureDetector(
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
                      child: Text('Sign Up', style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.w700)),
                    ),
                  ]),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSub, letterSpacing: 0.5));
}

