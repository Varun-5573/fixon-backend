import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class WorkerVerificationScreen extends StatefulWidget {
  const WorkerVerificationScreen({super.key});

  @override
  State<WorkerVerificationScreen> createState() =>
      _WorkerVerificationScreenState();
}

class _WorkerVerificationScreenState extends State<WorkerVerificationScreen> {
  final _docNumCtrl = TextEditingController();
  String _docType = 'Aadhaar';
  File? _frontImage;
  File? _backImage;
  bool _submitting = false;
  bool _submitted = false;
  String _verificationStatus = 'not_submitted';

  @override
  void dispose() {
    _docNumCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(bool isFront) async {
    final picker = ImagePicker();
    final picked =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 75);
    if (picked == null) return;
    setState(() {
      if (isFront) {
        _frontImage = File(picked.path);
      } else {
        _backImage = File(picked.path);
      }
    });
  }

  Future<void> _submit() async {
    if (_docNumCtrl.text.trim().isEmpty) {
      _showSnack('Please enter your document number', isError: true);
      return;
    }
    if (_frontImage == null) {
      _showSnack('Please upload the front side of your document', isError: true);
      return;
    }

    setState(() => _submitting = true);

    try {
      final workerId =
          context.read<AuthProvider>().user?['_id'] ?? 'guest';

      String? frontUrl;
      String? backUrl;

      if (_frontImage != null) {
        final bytes = await _frontImage!.readAsBytes();
        frontUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }
      if (_backImage != null) {
        final bytes = await _backImage!.readAsBytes();
        backUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }

      final res = await http.post(
        Uri.parse('$kBaseUrl/api/workers/$workerId/verify-document'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'documentType': _docType,
          'documentNumber': _docNumCtrl.text.trim(),
          'documentFrontUrl': frontUrl,
          'documentBackUrl': backUrl,
        }),
      );

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        setState(() {
          _submitting = false;
          _submitted = true;
          _verificationStatus = 'pending';
        });
        _showSnack('Documents submitted! Admin will review within 24 hours. ✅');
      } else {
        setState(() => _submitting = false);
        _showSnack('Submission failed. Try again.', isError: true);
      }
    } catch (e) {
      setState(() => _submitting = false);
      _showSnack('Connection error. Make sure server is running.', isError: true);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, color: AppColors.text, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Worker Verification',
            style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.text)),
      ),
      body: _submitted
          ? _buildSuccessState()
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Banner
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withOpacity(0.15),
                          AppColors.secondary.withOpacity(0.08),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: AppColors.primary.withOpacity(0.2)),
                    ),
                    child: Row(children: [
                      const Text('🛡️',
                          style: TextStyle(fontSize: 36)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Get Verified',
                                style: GoogleFonts.outfit(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.text)),
                            const SizedBox(height: 4),
                            Text(
                                'Verified workers get priority assignments, higher pay, and a badge on their profile.',
                                style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: AppColors.textSub,
                                    height: 1.4)),
                          ],
                        ),
                      ),
                    ]),
                  ),

                  const SizedBox(height: 24),

                  // Document Type
                  Text('Document Type',
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSub)),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                      child: _typeChip(
                          'Aadhaar', '🪪', _docType == 'Aadhaar'),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _typeChip(
                          'PAN', '📋', _docType == 'PAN'),
                    ),
                  ]),

                  const SizedBox(height: 20),

                  // Document Number
                  Text('Document Number',
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSub)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _docNumCtrl,
                    style: GoogleFonts.inter(
                        fontSize: 14, color: AppColors.text),
                    decoration: InputDecoration(
                      hintText: _docType == 'Aadhaar'
                          ? 'XXXX XXXX XXXX'
                          : 'ABCDE1234F',
                      hintStyle: GoogleFonts.inter(
                          fontSize: 14, color: AppColors.textSub),
                      filled: true,
                      fillColor: AppColors.card,
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
                        borderSide: BorderSide(
                            color: AppColors.primary, width: 1.5),
                      ),
                    ),
                    keyboardType: TextInputType.text,
                    textCapitalization: TextCapitalization.characters,
                  ),

                  const SizedBox(height: 24),

                  // Front Photo
                  Text('Front Side Photo',
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSub)),
                  const SizedBox(height: 10),
                  _imageUploadBox(
                    image: _frontImage,
                    label: 'Tap to upload front side',
                    onTap: () => _pickImage(true),
                  ),

                  const SizedBox(height: 16),

                  // Back Photo
                  Text('Back Side Photo (Optional)',
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSub)),
                  const SizedBox(height: 10),
                  _imageUploadBox(
                    image: _backImage,
                    label: 'Tap to upload back side',
                    onTap: () => _pickImage(false),
                  ),

                  const SizedBox(height: 24),

                  // Privacy Note
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.lock_outline,
                            color: AppColors.textSub, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Your documents are encrypted and stored securely. Only authorized admins can access them for verification purposes.',
                            style: GoogleFonts.inter(
                                fontSize: 11,
                                color: AppColors.textSub,
                                height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    child: GestureDetector(
                      onTap: _submitting ? null : _submit,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding:
                            const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          gradient: AppColors.primaryGradient,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            )
                          ],
                        ),
                        child: Center(
                          child: _submitting
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2.5),
                                )
                              : Text('Submit for Verification',
                                  style: GoogleFonts.outfit(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _typeChip(String label, String icon, bool selected) {
    return GestureDetector(
      onTap: () => setState(() => _docType = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withOpacity(0.15)
              : AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(children: [
          Text(icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(height: 4),
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight:
                      selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? AppColors.primary : AppColors.text)),
        ]),
      ),
    );
  }

  Widget _imageUploadBox(
      {required File? image,
      required String label,
      required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 160,
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: image != null
                ? AppColors.success
                : AppColors.border,
            width: image != null ? 1.5 : 1,
          ),
        ),
        child: image != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(15),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.file(image, fit: BoxFit.cover),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: AppColors.success,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.check,
                            color: Colors.white, size: 14),
                      ),
                    ),
                  ],
                ),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.cloud_upload_outlined,
                      color: AppColors.textSub, size: 36),
                  const SizedBox(height: 8),
                  Text(label,
                      style: GoogleFonts.inter(
                          fontSize: 13, color: AppColors.textSub)),
                ],
              ),
      ),
    );
  }

  Widget _buildSuccessState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Center(
                  child: Text('✅', style: TextStyle(fontSize: 48))),
            ),
            const SizedBox(height: 24),
            Text('Documents Submitted!',
                style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.text)),
            const SizedBox(height: 12),
            Text(
              'Our admin team will review your $_docType document within 24 hours. You will be notified once verified.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                  fontSize: 14, color: AppColors.textSub, height: 1.5),
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: AppColors.warning.withOpacity(0.3)),
              ),
              child: Row(children: [
                const Text('⏳', style: TextStyle(fontSize: 24)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text('Verification Status: Pending Review',
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          color: AppColors.warning,
                          fontWeight: FontWeight.w600)),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 32, vertical: 14),
                decoration: BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text('Back to Profile',
                    style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
