import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../providers/worker_provider.dart';
import '../../utils/constants.dart';

/// Reusable Before/After Photo comparison widget
/// Can be used inside booking detail screen
class BeforeAfterPhotosWidget extends StatefulWidget {
  final String bookingId;
  final String? initialBeforePhoto;
  final String? initialAfterPhoto;
  final bool canUploadBefore;
  final bool canUploadAfter;
  final VoidCallback? onPhotoUploaded;

  const BeforeAfterPhotosWidget({
    super.key,
    required this.bookingId,
    this.initialBeforePhoto,
    this.initialAfterPhoto,
    this.canUploadBefore = false,
    this.canUploadAfter = false,
    this.onPhotoUploaded,
  });

  @override
  State<BeforeAfterPhotosWidget> createState() =>
      _BeforeAfterPhotosWidgetState();
}

class _BeforeAfterPhotosWidgetState extends State<BeforeAfterPhotosWidget>
    with TickerProviderStateMixin {
  String? _beforePhoto;
  String? _afterPhoto;
  bool _uploading = false;
  late AnimationController _slideAnim;
  double _sliderValue = 0.5;

  @override
  void initState() {
    super.initState();
    _beforePhoto = widget.initialBeforePhoto;
    _afterPhoto = widget.initialAfterPhoto;
    _slideAnim = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    if (_beforePhoto != null || _afterPhoto != null) {
      _slideAnim.forward();
    }
  }

  @override
  void dispose() {
    _slideAnim.dispose();
    super.dispose();
  }

  Future<void> _uploadPhoto({required bool isBefore}) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
        source: ImageSource.camera, imageQuality: 75);
    if (picked == null) return;

    setState(() => _uploading = true);

    try {
      final bytes = await File(picked.path).readAsBytes();
      final base64Img = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      final res = await http.post(
        Uri.parse('$kBaseUrl/api/bookings/${widget.bookingId}/photos'),
        headers: kHeaders,
        body: jsonEncode(isBefore
            ? {'beforePhoto': base64Img}
            : {'afterPhoto': base64Img}),
      );

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        setState(() {
          if (isBefore) {
            _beforePhoto = base64Img;
          } else {
            _afterPhoto = base64Img;
          }
          _uploading = false;
        });
        _slideAnim.forward(from: 0);
        _showSnack(isBefore
            ? '✅ Before photo uploaded!'
            : '✅ After photo uploaded!');
        widget.onPhotoUploaded?.call();
        try {
          context.read<WorkerProvider>().fetchMyBookings();
        } catch (_) {}
      } else {
        setState(() => _uploading = false);
        _showSnack('Upload failed. Try again.', isError: true);
      }
    } catch (e) {
      setState(() => _uploading = false);
      _showSnack('Connection error.', isError: true);
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

  bool get _hasBeforePhoto =>
      _beforePhoto != null && _beforePhoto!.isNotEmpty;
  bool get _hasAfterPhoto =>
      _afterPhoto != null && _afterPhoto!.isNotEmpty;
  bool get _hasBothPhotos => _hasBeforePhoto && _hasAfterPhoto;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text('📸', style: TextStyle(fontSize: 18)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('Before & After',
                      style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text)),
                  Text('Service proof photos',
                      style: GoogleFonts.inter(
                          fontSize: 11, color: AppColors.textSub)),
                ]),
              ),
              if (_hasBothPhotos)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: AppColors.success.withOpacity(0.3)),
                  ),
                  child: Text('Complete',
                      style: GoogleFonts.inter(
                          fontSize: 11,
                          color: AppColors.success,
                          fontWeight: FontWeight.w700)),
                ),
            ]),
          ),

          // Photos Grid
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(children: [
              Row(children: [
                Expanded(
                  child: _photoSlot(
                    isBefore: true,
                    label: 'Before',
                    icon: '🔴',
                    photo: _beforePhoto,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _photoSlot(
                    isBefore: false,
                    label: 'After',
                    icon: '🟢',
                    photo: _afterPhoto,
                  ),
                ),
              ]),

              // Comparison slider (if both photos available)
              if (_hasBothPhotos) ...[
                const SizedBox(height: 16),
                _buildComparisonSlider(),
              ],

              if (_uploading)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            color: AppColors.primary, strokeWidth: 2),
                      ),
                      const SizedBox(width: 8),
                      Text('Uploading photo...',
                          style: GoogleFonts.inter(
                              fontSize: 12, color: AppColors.textSub)),
                    ],
                  ),
                ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _photoSlot({
    required bool isBefore,
    required String label,
    required String icon,
    required String? photo,
  }) {
    final hasPhoto = photo != null && photo.isNotEmpty;
    final canUpload = isBefore ? widget.canUploadBefore : widget.canUploadAfter;

    return GestureDetector(
      onTap: (canUpload && !hasPhoto)
          ? () => _uploadPhoto(isBefore: isBefore)
          : (hasPhoto ? () => _viewFullPhoto(photo) : null),
      child: Container(
        height: 140,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: hasPhoto
                ? (isBefore
                    ? AppColors.error.withOpacity(0.4)
                    : AppColors.success.withOpacity(0.4))
                : AppColors.border,
            width: hasPhoto ? 1.5 : 1,
          ),
        ),
        child: hasPhoto
            ? ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(photo),
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('$icon $label',
                            style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Colors.white)),
                      ),
                    ),
                    if (canUpload)
                      Positioned(
                        bottom: 6,
                        right: 6,
                        child: GestureDetector(
                          onTap: () => _uploadPhoto(isBefore: isBefore),
                          child: Container(
                            padding: const EdgeInsets.all(5),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.refresh,
                                color: Colors.white, size: 14),
                          ),
                        ),
                      ),
                  ],
                ),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(icon, style: const TextStyle(fontSize: 28)),
                  const SizedBox(height: 8),
                  Text(label,
                      style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text)),
                  const SizedBox(height: 4),
                  Text(
                    canUpload ? 'Tap to upload' : 'Not uploaded',
                    style: GoogleFonts.inter(
                        fontSize: 10, color: AppColors.textSub),
                  ),
                  if (canUpload) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text('📸 Upload',
                          style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white)),
                    )
                  ]
                ],
              ),
      ),
    );
  }

  Widget _buildComparisonSlider() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Comparison Slider',
            style: GoogleFonts.inter(
                fontSize: 12,
                color: AppColors.textSub,
                fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            height: 160,
            child: Stack(
              children: [
                // After photo (background)
                Positioned.fill(child: _buildImage(_afterPhoto!)),
                // Before photo (clipped by slider)
                ClipRect(
                  clipper: _HalfClipper(_sliderValue),
                  child: Positioned.fill(child: _buildImage(_beforePhoto!)),
                ),
                // Slider divider line
                Positioned(
                  left: MediaQuery.of(context).size.width * _sliderValue - 60,
                  top: 0,
                  bottom: 0,
                  child: Container(
                    width: 3,
                    color: Colors.white,
                    child: Center(
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.compare_arrows,
                            size: 14, color: Colors.black),
                      ),
                    ),
                  ),
                ),
                // Invisible slider
                Positioned.fill(
                  child: Slider(
                    value: _sliderValue,
                    onChanged: (v) => setState(() => _sliderValue = v),
                    activeColor: Colors.transparent,
                    inactiveColor: Colors.transparent,
                  ),
                ),
                // Labels
                Positioned(
                  top: 8,
                  left: 8,
                  child: _photoLabel('Before', AppColors.error),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: _photoLabel('After', AppColors.success),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _photoLabel(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.85),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text,
          style: GoogleFonts.inter(
              fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
    );
  }

  Widget _buildImage(String src) {
    if (src.startsWith('data:image')) {
      try {
        final decodedBytes = base64Decode(src.split(',').last);
        return Image.memory(
          decodedBytes,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => const Center(
            child: Icon(Icons.broken_image, color: Colors.white30, size: 30),
          ),
        );
      } catch (e) {
        return const Center(
          child: Icon(Icons.broken_image, color: Colors.white30, size: 30),
        );
      }
    }
    
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return Image.network(
        src,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => const Center(
          child: Icon(Icons.broken_image, color: Colors.white30, size: 30),
        ),
      );
    }
    
    return const Center(
      child: Icon(Icons.broken_image, color: Colors.white30, size: 30),
    );
  }

  void _viewFullPhoto(String photo) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: EdgeInsets.zero,
        child: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: SizedBox.expand(child: _buildImage(photo)),
        ),
      ),
    );
  }
}

class _HalfClipper extends CustomClipper<Rect> {
  final double fraction;
  _HalfClipper(this.fraction);

  @override
  Rect getClip(Size size) =>
      Rect.fromLTRB(0, 0, size.width * fraction, size.height);

  @override
  bool shouldReclip(_HalfClipper old) => old.fraction != fraction;
}
