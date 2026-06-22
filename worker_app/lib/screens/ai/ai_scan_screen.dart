import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../utils/constants.dart';

class AiScanScreen extends StatefulWidget {
  const AiScanScreen({super.key});

  @override
  State<AiScanScreen> createState() => _AiScanScreenState();
}

class _AiScanScreenState extends State<AiScanScreen>
    with TickerProviderStateMixin {
  File? _selectedImage;
  bool _isAnalyzing = false;
  Map<String, dynamic>? _result;
  late AnimationController _pulseCtrl;
  late AnimationController _slideCtrl;
  late Animation<double> _pulseAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _slideCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));
    _pulseAnim = Tween(begin: 0.9, end: 1.0).animate(
        CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));
    _slideAnim = Tween<Offset>(
            begin: const Offset(0, 1), end: Offset.zero)
        .animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _slideCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, imageQuality: 75);
    if (picked == null) return;
    setState(() {
      _selectedImage = File(picked.path);
      _result = null;
    });
    await _analyzeImage();
  }

  Future<void> _analyzeImage() async {
    if (_selectedImage == null) return;
    setState(() => _isAnalyzing = true);

    try {
      final bytes = await _selectedImage!.readAsBytes();
      final base64Image =
          'data:image/jpeg;base64,${base64Encode(bytes)}';

      final res = await http
          .post(
            Uri.parse('$kBaseUrl/api/ai/detect-issue'),
            headers: kHeaders,
            body: jsonEncode({'image': base64Image}),
          )
          .timeout(const Duration(seconds: 30));

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        setState(() {
          _result = data['analysis'];
          _isAnalyzing = false;
        });
        _slideCtrl.forward(from: 0);
      } else {
        setState(() => _isAnalyzing = false);
        _showError('AI could not analyze the image. Try again.');
      }
    } catch (e) {
      setState(() => _isAnalyzing = false);
      _showError('Connection error. Make sure server is running.');
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(msg),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating),
    );
  }

  Color _categoryColor(String? cat) {
    switch (cat) {
      case 'Plumbing': return const Color(0xFF7C3AED);
      case 'Electrical': return const Color(0xFFF59E0B);
      case 'AC Repair': return const Color(0xFF06B6D4);
      case 'Cleaning': return const Color(0xFF10B981);
      case 'Carpentry': return const Color(0xFFEC4899);
      case 'Painting': return const Color(0xFFEF4444);
      default: return AppColors.primary;
    }
  }

  String _categoryIcon(String? cat) {
    switch (cat) {
      case 'Plumbing': return '🔧';
      case 'Electrical': return '⚡';
      case 'AC Repair': return '❄️';
      case 'Cleaning': return '🧹';
      case 'Carpentry': return '🪚';
      case 'Painting': return '🎨';
      default: return '🔍';
    }
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
        title: Text('AI Problem Scanner',
            style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.text)),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              gradient: AppColors.primaryGradient,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(children: [
              const Text('⚡', style: TextStyle(fontSize: 12)),
              const SizedBox(width: 4),
              Text('Gemini AI',
                  style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.white)),
            ]),
          )
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                // ── Upload Area ──
                GestureDetector(
                  onTap: () => _showPickerSheet(),
                  child: AnimatedBuilder(
                    animation: _pulseAnim,
                    builder: (_, child) => Transform.scale(
                      scale: _selectedImage == null ? _pulseAnim.value : 1.0,
                      child: child,
                    ),
                    child: Container(
                      height: 280,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: _selectedImage != null
                              ? AppColors.primary
                              : AppColors.primary.withOpacity(0.3),
                          width: 2,
                        ),
                      ),
                      child: _selectedImage != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(22),
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  Image.file(_selectedImage!, fit: BoxFit.cover),
                                  if (_isAnalyzing)
                                    Container(
                                      color: Colors.black54,
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          SizedBox(
                                            width: 64,
                                            height: 64,
                                            child: CircularProgressIndicator(
                                              color: AppColors.primary,
                                              strokeWidth: 3,
                                            ),
                                          ),
                                          const SizedBox(height: 16),
                                          Text('AI Analyzing...',
                                              style: GoogleFonts.outfit(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w700,
                                                  color: Colors.white)),
                                          const SizedBox(height: 4),
                                          Text('Powered by Gemini Vision',
                                              style: GoogleFonts.inter(
                                                  fontSize: 12,
                                                  color: Colors.white70)),
                                        ],
                                      ),
                                    ),
                                  Positioned(
                                    top: 12,
                                    right: 12,
                                    child: GestureDetector(
                                      onTap: _showPickerSheet,
                                      child: Container(
                                        padding: const EdgeInsets.all(6),
                                        decoration: BoxDecoration(
                                          color: Colors.black54,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: const Icon(Icons.refresh,
                                            color: Colors.white, size: 18),
                                      ),
                                    ),
                                  )
                                ],
                              ),
                            )
                          : Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    gradient: AppColors.primaryGradient,
                                    borderRadius: BorderRadius.circular(24),
                                  ),
                                  child: const Icon(Icons.camera_enhance,
                                      color: Colors.white, size: 40),
                                ),
                                const SizedBox(height: 20),
                                Text('Take or Upload a Photo',
                                    style: GoogleFonts.outfit(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.text)),
                                const SizedBox(height: 8),
                                Text('AI will identify the issue instantly',
                                    style: GoogleFonts.inter(
                                        fontSize: 13,
                                        color: AppColors.textSub)),
                                const SizedBox(height: 20),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    _chip('🚰 Leaks'),
                                    const SizedBox(width: 8),
                                    _chip('⚡ Electrical'),
                                    const SizedBox(width: 8),
                                    _chip('❄️ AC Issues'),
                                  ],
                                )
                              ],
                            ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // ── Action Buttons ──
                Row(children: [
                  Expanded(
                    child: _actionBtn(
                      icon: Icons.camera_alt_rounded,
                      label: 'Take Photo',
                      onTap: () => _pickImage(ImageSource.camera),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _actionBtn(
                      icon: Icons.photo_library_rounded,
                      label: 'Gallery',
                      onTap: () => _pickImage(ImageSource.gallery),
                    ),
                  ),
                ]),

                const SizedBox(height: 20),

                // ── How it works ──
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('How AI Scan Works',
                          style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.text)),
                      const SizedBox(height: 12),
                      _step('1', 'Snap a photo of the problem area'),
                      _step('2', 'Gemini AI analyzes the image instantly'),
                      _step('3', 'Get diagnosis + recommended service'),
                      _step('4', 'Book the right expert in 1 click'),
                    ],
                  ),
                ),
                const SizedBox(height: 200),
              ],
            ),
          ),

          // ── Results Drawer ──
          if (_result != null)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: SlideTransition(
                position: _slideAnim,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius:
                        const BorderRadius.vertical(top: Radius.circular(28)),
                    border: Border.all(
                        color: _categoryColor(_result?['category'])
                            .withOpacity(0.3)),
                    boxShadow: [
                      BoxShadow(
                        color: _categoryColor(_result?['category'])
                            .withOpacity(0.2),
                        blurRadius: 30,
                        offset: const Offset(0, -8),
                      )
                    ],
                  ),
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _categoryColor(_result?['category'])
                                .withOpacity(0.15),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                              _categoryIcon(_result?['category']),
                              style: const TextStyle(fontSize: 28)),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _result?['detectedIssue'] ?? 'Issue Detected',
                                  style: GoogleFonts.outfit(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.text),
                                ),
                                const SizedBox(height: 4),
                                Row(children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: _categoryColor(_result?['category'])
                                          .withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      _result?['category'] ?? '',
                                      style: GoogleFonts.inter(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: _categoryColor(
                                              _result?['category'])),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    '${((_result?['confidence'] ?? 0.9) * 100).toStringAsFixed(0)}% match',
                                    style: GoogleFonts.inter(
                                        fontSize: 11,
                                        color: AppColors.success,
                                        fontWeight: FontWeight.w600),
                                  ),
                                ]),
                              ]),
                        ),
                      ]),
                      const SizedBox(height: 14),
                      Text(
                        _result?['description'] ?? '',
                        style: GoogleFonts.inter(
                            fontSize: 13,
                            color: AppColors.textSub,
                            height: 1.5),
                      ),
                      const SizedBox(height: 16),
                      Row(children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.card,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(children: [
                              Text('Est. Cost',
                                  style: GoogleFonts.inter(
                                      fontSize: 11, color: AppColors.textSub)),
                              const SizedBox(height: 4),
                              Text(
                                '₹${_result?['estimatedCost'] ?? 499}',
                                style: GoogleFonts.outfit(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.text),
                              ),
                            ]),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: GestureDetector(
                            onTap: () => Navigator.pop(context,
                                _result?['category']),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                gradient: AppColors.primaryGradient,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Center(
                                child: Text('⚡ Book Now in 1-Click',
                                    style: GoogleFonts.outfit(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white)),
                              ),
                            ),
                          ),
                        ),
                      ]),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _chip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
      ),
      child: Text(label,
          style: GoogleFonts.inter(
              fontSize: 11,
              color: AppColors.primary,
              fontWeight: FontWeight.w600)),
    );
  }

  Widget _actionBtn(
      {required IconData icon,
      required String label,
      required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(width: 8),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.text)),
          ],
        ),
      ),
    );
  }

  Widget _step(String num, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(num,
                style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.white)),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text,
              style: GoogleFonts.inter(
                  fontSize: 13, color: AppColors.textSub)),
        ),
      ]),
    );
  }

  void _showPickerSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Choose Image Source',
                style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text)),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(
                child: _actionBtn(
                  icon: Icons.camera_alt_rounded,
                  label: 'Camera',
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.camera);
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionBtn(
                  icon: Icons.photo_library_rounded,
                  label: 'Gallery',
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.gallery);
                  },
                ),
              ),
            ]),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
