import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class BankDetailsScreen extends StatefulWidget {
  const BankDetailsScreen({super.key});
  @override
  State<BankDetailsScreen> createState() => _BankDetailsScreenState();
}

class _BankDetailsScreenState extends State<BankDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _accCtrl = TextEditingController();
  final _ifscCtrl = TextEditingController();
  final _bankCtrl = TextEditingController();
  final _upiCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _hasSaved = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDetails());
  }

  Future<void> _loadDetails() async {
    final auth = context.read<AuthProvider>();
    final uId = auth.user?['_id'];
    if (uId == null) { setState(() => _loading = false); return; }

    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/user/$uId/bank-details'))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final bd = data['bankDetails'];
        if (bd != null) {
          _nameCtrl.text = bd['accountName'] ?? '';
          _accCtrl.text = bd['accountNumber'] ?? '';
          _ifscCtrl.text = bd['ifscCode'] ?? '';
          _bankCtrl.text = bd['bankName'] ?? '';
          _upiCtrl.text = bd['upiId'] ?? '';
          _hasSaved = true;
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    // At least one of account or UPI must be filled
    if (_accCtrl.text.trim().isEmpty && _upiCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text('Please enter either Bank Account Number or UPI ID'),
        backgroundColor: AppColors.error,
      ));
      return;
    }

    setState(() => _saving = true);
    final auth = context.read<AuthProvider>();
    final uId = auth.user?['_id'] ?? 'guest';

    try {
      final body = jsonEncode({
        'accountName': _nameCtrl.text.trim(),
        'accountNumber': _accCtrl.text.trim(),
        'ifscCode': _ifscCtrl.text.trim().toUpperCase(),
        'bankName': _bankCtrl.text.trim(),
        'upiId': _upiCtrl.text.trim(),
      });

      final res = await http.put(
        Uri.parse('$kBaseUrl/api/user/$uId/bank-details'),
        headers: {'Content-Type': 'application/json'},
        body: body,
      ).timeout(const Duration(seconds: 10));

      if (res.statusCode == 200) {
        setState(() => _hasSaved = true);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('✅ Bank details saved successfully!'),
            backgroundColor: AppColors.success,
          ));
          Navigator.pop(context, true);
        }
      } else {
        throw Exception('Server error ${res.statusCode}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to save: $e'),
          backgroundColor: AppColors.error,
        ));
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Icon(Icons.arrow_back_ios, color: AppColors.text, size: 18),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('🏦 Bank Details', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
                    Text('For refunds & payments', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
                  ])),
                  if (_hasSaved)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.check_circle, color: AppColors.success, size: 13),
                        const SizedBox(width: 4),
                        Text('Saved', style: GoogleFonts.inter(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                ]),
              ),

              if (_loading)
                Expanded(child: Center(child: CircularProgressIndicator(color: AppColors.primary)))
              else
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Info banner
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                            ),
                            child: Row(children: [
                              Icon(Icons.security_outlined, color: AppColors.primary, size: 20),
                              const SizedBox(width: 10),
                              Expanded(child: Text(
                                'Your bank details are securely stored and will only be used by FixoN admin for processing refunds.',
                                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub, height: 1.5),
                              )),
                            ]),
                          ),
                          const SizedBox(height: 24),

                          // Bank Account Section
                          Text('🏦 Bank Account', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.text)),
                          const SizedBox(height: 12),

                          _buildField(
                            controller: _nameCtrl,
                            label: 'Account Holder Name',
                            hint: 'As per bank records',
                            icon: Icons.person_outline,
                            textCapitalization: TextCapitalization.words,
                          ),
                          const SizedBox(height: 14),

                          _buildField(
                            controller: _accCtrl,
                            label: 'Account Number',
                            hint: 'Enter your bank account number',
                            icon: Icons.account_balance_outlined,
                            keyboardType: TextInputType.number,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          ),
                          const SizedBox(height: 14),

                          _buildField(
                            controller: _ifscCtrl,
                            label: 'IFSC Code',
                            hint: 'e.g. SBIN0001234',
                            icon: Icons.code_outlined,
                            textCapitalization: TextCapitalization.characters,
                          ),
                          const SizedBox(height: 14),

                          _buildField(
                            controller: _bankCtrl,
                            label: 'Bank Name',
                            hint: 'e.g. State Bank of India',
                            icon: Icons.business_outlined,
                            textCapitalization: TextCapitalization.words,
                          ),

                          const SizedBox(height: 24),

                          // Divider with OR
                          Row(children: [
                            Expanded(child: Divider(color: AppColors.border)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text('OR', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub, fontWeight: FontWeight.w600)),
                            ),
                            Expanded(child: Divider(color: AppColors.border)),
                          ]),

                          const SizedBox(height: 20),

                          // UPI Section
                          Text('📱 UPI ID', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.text)),
                          const SizedBox(height: 12),

                          _buildField(
                            controller: _upiCtrl,
                            label: 'UPI ID',
                            hint: 'e.g. yourname@upi or 9000000000@ybl',
                            icon: Icons.phone_android_outlined,
                            keyboardType: TextInputType.emailAddress,
                          ),

                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),
                ),

              // Save Button
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: AppColors.success,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: _saving
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('💾 Save Bank Details', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    TextCapitalization textCapitalization = TextCapitalization.none,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSub)),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          inputFormatters: inputFormatters,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.text),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textDim),
            prefixIcon: Icon(icon, color: AppColors.primary, size: 20),
            filled: true,
            fillColor: AppColors.card,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
              borderSide: BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _accCtrl.dispose();
    _ifscCtrl.dispose();
    _bankCtrl.dispose();
    _upiCtrl.dispose();
    super.dispose();
  }
}
