import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';
import '../../widgets/before_after_photos_widget.dart';
import 'package:url_launcher/url_launcher.dart';
import 'worker_live_map_screen.dart';
import '../chat/worker_chat_screen.dart';

class WorkerBookingsScreen extends StatefulWidget {
  final bool isNewBookings;
  const WorkerBookingsScreen({super.key, required this.isNewBookings});
  @override
  State<WorkerBookingsScreen> createState() => _WorkerBookingsScreenState();
}

class _WorkerBookingsScreenState extends State<WorkerBookingsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final wp = context.read<WorkerProvider>();
      if (widget.isNewBookings) {
        wp.fetchPendingBookings();
      } else {
        wp.fetchMyBookings();
      }
    });
  }

  Future<void> _refresh() async {
    final wp = context.read<WorkerProvider>();
    if (widget.isNewBookings) {
      await wp.fetchPendingBookings();
    } else {
      await wp.fetchMyBookings();
    }
  }

  @override
  Widget build(BuildContext context) {
    final wp = context.watch<WorkerProvider>();
    final bookings = widget.isNewBookings ? wp.pendingBookings : wp.myBookings;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: AppColors.primary,
        child: CustomScrollView(slivers: [
          SliverAppBar(
            pinned: true,
            backgroundColor: AppColors.bg,
            title: Text(
              widget.isNewBookings ? '🔔 New Bookings' : '📋 My Jobs',
              style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text),
            ),
            actions: [
              IconButton(
                icon: Icon(Icons.refresh, color: AppColors.textSub),
                onPressed: _refresh,
              ),
            ],
          ),

          if (bookings.isEmpty)
            SliverFillRemaining(
              child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(widget.isNewBookings ? '🔔' : '📋', style: const TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                Text(
                  widget.isNewBookings ? 'No new bookings yet' : 'No jobs assigned yet',
                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.isNewBookings ? 'Go Online to receive booking requests!' : 'Accept bookings from the New tab',
                  style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _refresh,
                  icon: const Icon(Icons.refresh),
                  label: Text('Refresh', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                ),
              ])),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _BookingCard(
                    booking: bookings[i],
                    isNew: widget.isNewBookings,
                    onRefresh: _refresh,
                  ),
                  childCount: bookings.length,
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

class _BookingCard extends StatefulWidget {
  final Map<String, dynamic> booking;
  final bool isNew;
  final VoidCallback? onRefresh;
  const _BookingCard({required this.booking, required this.isNew, this.onRefresh});

  @override
  State<_BookingCard> createState() => _BookingCardState();
}

class _BookingCardState extends State<_BookingCard> {
  bool _uploadedBeforePhoto = false;
  bool _uploadedAfterPhoto = false;
  String? _afterPhoto;
  bool _uploadingPhoto = false;

  Future<void> _pickAndUploadAfterPhoto(String bookingId) async {
    final ImagePicker picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Upload Work Completion Photo',
                style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.text)),
            const SizedBox(height: 16),
            ListTile(
              leading: Icon(Icons.camera_alt, color: AppColors.primary),
              title: Text('Take Photo with Camera', style: GoogleFonts.inter(color: AppColors.text)),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: Icon(Icons.photo_library, color: AppColors.secondary),
              title: Text('Choose from Gallery', style: GoogleFonts.inter(color: AppColors.text)),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;

    final picked = await picker.pickImage(source: source, imageQuality: 55, maxWidth: 800, maxHeight: 800);
    if (picked == null) return;

    setState(() => _uploadingPhoto = true);

    try {
      final bytes = await File(picked.path).readAsBytes();
      final base64Img = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      final res = await http.post(
        Uri.parse('$kBaseUrl/api/bookings/$bookingId/photos'),
        headers: kHeaders,
        body: jsonEncode({
          'afterPhoto': base64Img,
          'workerAfterPhoto': base64Img,
        }),
      ).timeout(const Duration(seconds: 30));

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        setState(() {
          _afterPhoto = base64Img;
          _uploadedAfterPhoto = true;
          _uploadingPhoto = false;
        });
        if (mounted) {
          _snack(context, '📸 Work completion photo attached!', AppColors.success);
        }
      } else {
        throw Exception('Upload failed');
      }
    } catch (e) {
      setState(() => _uploadingPhoto = false);
      if (mounted) {
        _snack(context, '⚠️ Photo upload failed. Please try again.', AppColors.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = widget.booking;
    final isNew = widget.isNew;
    final onRefresh = widget.onRefresh;
    final wp = context.read<WorkerProvider>();
    final status = booking['status']?.toString() ?? 'pending';

    final userName = booking['userName']?.toString() ??
                     (booking['userId'] is Map ? booking['userId']['name']?.toString() : null) ??
                     'Customer';
    final dt = booking['scheduledTime'] != null
        ? DateTime.tryParse(booking['scheduledTime'].toString())
        : null;
    final address = (booking['location'] is Map && booking['location']['address'] != null)
        ? booking['location']['address'].toString()
        : (booking['address']?.toString() ?? 'N/A');
    final userPhone = booking['userPhone']?.toString() ??
                      (booking['userId'] is Map ? booking['userId']['phone']?.toString() : null) ??
                      '';

    // Normalised status labels & colors
    final statusLabels = {
      'pending':     'PENDING',
      'accepted':    'ACCEPTED',
      'on_the_way':  'ON THE WAY 🏍️',
      'ongoing':     'IN PROGRESS 🔧',
      'in_progress': 'IN PROGRESS 🔧',
      'completed':   'COMPLETED ✅',
      'cancelled':   'CANCELLED ❌',
    };
    final statusColors = {
      'pending':     AppColors.accent,
      'accepted':    AppColors.primary,
      'on_the_way':  AppColors.warning,
      'ongoing':     AppColors.secondary,
      'in_progress': AppColors.secondary,
      'completed':   AppColors.success,
      'cancelled':   AppColors.error,
    };
    final statusLabel = statusLabels[status] ?? status.toUpperCase();
    final color = statusColors[status] ?? AppColors.textSub;

    // Photo flags
    final beforePhoto = booking['beforePhoto']?.toString() ?? '';
    final afterPhoto  = booking['afterPhoto']?.toString()  ?? '';
    final hasBeforePhoto = beforePhoto.isNotEmpty || _uploadedBeforePhoto;
    final hasAfterPhoto  = afterPhoto.isNotEmpty || _uploadedAfterPhoto;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isNew ? AppColors.primary.withOpacity(0.3) : AppColors.border,
        ),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

          // ── Header Row ─────────────────────────────────────
          Row(children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(_categoryIcon(booking['category'] ?? booking['service'] ?? ''),
                  style: const TextStyle(fontSize: 22)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(booking['service'] ?? booking['category'] ?? 'Service',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
              Text('Customer: $userName',
                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
            ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(statusLabel,
                  style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
            ),
          ]),

          const SizedBox(height: 12),
          Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),

          // ── Details ────────────────────────────────────────
          _row(Icons.tag_rounded, 'Booking ID: #${booking['_id']}'),
          const SizedBox(height: 6),
          _row(Icons.location_on_outlined, address),
          if (dt != null) ...[
            const SizedBox(height: 6),
            _row(Icons.calendar_today_outlined,
                '${dt.day}/${dt.month}/${dt.year} at ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}'),
          ],
          const SizedBox(height: 6),
          _row(Icons.currency_rupee,
              '₹${booking['price'] ?? 0}  (Your share: ₹${((booking['price'] ?? 0) * 0.8).round()})'),

          // ── Customer Problem Photo & Description Section ──
          if ((booking['description'] != null && booking['description'].toString().isNotEmpty) ||
              (booking['problemDescription'] != null && booking['problemDescription'].toString().isNotEmpty) ||
              (booking['beforePhoto'] != null && booking['beforePhoto'].toString().isNotEmpty) ||
              (booking['customerProblemPhoto'] != null && booking['customerProblemPhoto'].toString().isNotEmpty) ||
              (booking['problemPhoto'] != null && booking['problemPhoto'].toString().isNotEmpty)) ...[
            const SizedBox(height: 10),
            _buildProblemBox(booking),
          ],

          // ── Phone / Chat ───────────────────────────────────
          if (userPhone.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(children: [
              Icon(Icons.phone_outlined, size: 14, color: AppColors.textSub),
              const SizedBox(width: 8),
              Expanded(child: Text('Phone: $userPhone',
                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub))),
              if (status != 'pending') ...[
                _iconChip(Icons.phone, 'CALL', AppColors.success, () async {
                  final uri = Uri.parse('tel:$userPhone');
                  if (await canLaunchUrl(uri)) launchUrl(uri);
                }),
                const SizedBox(width: 8),
                _iconChip(Icons.chat_bubble_outline, 'CHAT', AppColors.primary, () {
                  final cId = booking['userId'] is Map
                      ? booking['userId']['_id']?.toString()
                      : booking['userId']?.toString();
                  if (cId != null) {
                    Navigator.push(context, MaterialPageRoute(
                      builder: (_) => WorkerChatScreen(
                        workerId: cId,
                        workerName: userName,
                        workerCategory: 'Customer',
                      ),
                    ));
                  }
                }),
              ],
            ]),
          ],

          // ── Map Button ─────────────────────────────────────
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => WorkerLiveMapScreen(booking: booking),
                ));
              },
              icon: const Icon(Icons.map_rounded, size: 16),
              label: Text('📍 View Customer Location on Map',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: BorderSide(color: AppColors.primary.withOpacity(0.5)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 11),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ══════════════════════════════════════════════════
          //  ACTION BUTTONS — Full Lifecycle
          // ══════════════════════════════════════════════════

          if (isNew) ...[
            // ── NEW BOOKING: Accept / Reject ─────────────
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final ok = await wp.rejectBooking(booking['_id']);
                    if (context.mounted) {
                      _snack(context, ok ? '❌ Booking skipped' : 'Error skipping booking',
                          ok ? AppColors.warning : AppColors.error);
                      if (ok) onRefresh?.call();
                    }
                  },
                  icon: const Icon(Icons.close, size: 16),
                  label: Text('❌ Reject', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: BorderSide(color: AppColors.error.withOpacity(0.4)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final ok = await wp.acceptBooking(booking['_id']);
                    if (context.mounted) {
                      _snack(context, ok ? '✅ Booking Accepted!' : 'Failed — try again',
                          ok ? AppColors.success : AppColors.error);
                      if (ok) onRefresh?.call();
                    }
                  },
                  icon: const Icon(Icons.check, size: 16),
                  label: Text('✅ Accept', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ]),

          ] else ...[

            // ── STEP 1: ACCEPTED → Mark On The Way ────────
            if (status == 'accepted')
              _stepBanner(
                context,
                step: 'Step 1',
                title: '🏍️ Head to Customer Location',
                subtitle: 'Tap below when you leave for the job site.',
                btnLabel: '🏍️ I\'m On The Way',
                btnColor: AppColors.warning,
                onTap: () async {
                  final ok = await wp.updateBookingStatus(booking['_id'], 'on-the-way');
                  if (context.mounted) {
                    _snack(context, ok ? '🏍️ Customer notified you\'re on the way!' : 'Failed — try again',
                        ok ? AppColors.success : AppColors.error);
                    if (ok) onRefresh?.call();
                  }
                },
              ),

            // ── STEP 2: ON THE WAY → Mark Arrived ─────────
            if (status == 'on_the_way')
              _stepBanner(
                context,
                step: 'Step 2',
                title: '📍 Arrived at Customer Location',
                subtitle: 'Tap below when you arrive at the customer\'s address.',
                btnLabel: '📍 I Have Arrived',
                btnColor: AppColors.secondary,
                onTap: () async {
                  final ok = await wp.updateBookingStatus(booking['_id'], 'arrived');
                  if (context.mounted) {
                    _snack(context, ok ? '📍 Customer notified of your arrival!' : 'Failed — try again',
                        ok ? AppColors.success : AppColors.error);
                    if (ok) onRefresh?.call();
                  }
                },
              ),

            // ── STEP 3: ARRIVED → Start Work ───────────────
            if (status == 'arrived')
              _stepBanner(
                context,
                step: 'Step 3',
                title: '🛠️ Ready to Start Work',
                subtitle: 'Tap below to begin work on this job.',
                btnLabel: '🛠️ Start Work Now',
                btnColor: AppColors.primary,
                onTap: () async {
                  final ok = await wp.updateBookingStatus(booking['_id'], 'start');
                  if (context.mounted) {
                    _snack(context, ok ? '🛠️ Work started! Customer notified.' : 'Failed — try again',
                        ok ? AppColors.success : AppColors.error);
                    if (ok) onRefresh?.call();
                  }
                },
              ),

            // ── STEP 4: ONGOING → Mandatory Completion Photo → Complete Job ────
            if (status == 'ongoing' || status == 'in_progress' || status == 'started') ...[
              Builder(builder: (context) {
                final existingAfterPhoto = booking['afterPhoto']?.toString() ?? booking['workerAfterPhoto']?.toString() ?? '';
                final hasAfterPhoto = _afterPhoto != null || existingAfterPhoto.isNotEmpty || _uploadedAfterPhoto;

                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: hasAfterPhoto ? AppColors.success.withOpacity(0.4) : AppColors.primary.withOpacity(0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(hasAfterPhoto ? '✅ Step 4' : '📸 Step 4', style: const TextStyle(fontSize: 15)),
                          const SizedBox(width: 8),
                          Text(
                            hasAfterPhoto ? 'Work Completed Photo Uploaded' : 'Upload Work Completion Photo',
                            style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 14, color: hasAfterPhoto ? AppColors.success : AppColors.primary),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        hasAfterPhoto
                            ? 'Photo attached! Tap below to mark job as complete.'
                            : 'Please take or upload a photo of the completed work to enable completion.',
                        style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub),
                      ),
                      const SizedBox(height: 10),

                      // Preview thumbnail if photo uploaded
                      if (hasAfterPhoto) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: SizedBox(
                            height: 140,
                            width: double.infinity,
                            child: _buildImageWidget(_afterPhoto ?? existingAfterPhoto),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],

                      if (_uploadingPhoto)
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Center(
                            child: CircularProgressIndicator(color: AppColors.primary),
                          ),
                        )
                      else if (!hasAfterPhoto)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () => _pickAndUploadAfterPhoto(booking['_id']),
                            icon: const Icon(Icons.camera_alt, size: 18),
                            label: Text('📸 Take / Choose Work Photo', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        )
                      else
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              final ok = await wp.updateBookingStatus(booking['_id'], 'complete');
                              if (context.mounted) {
                                _snack(context, ok ? '🎉 Job Complete! Invoice generated & customer notified.' : 'Failed — try again',
                                    ok ? AppColors.success : AppColors.error);
                                if (ok) onRefresh?.call();
                              }
                            },
                            icon: const Icon(Icons.check_circle, size: 18),
                            label: Text('✅ Mark Job as Complete', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.success,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              }),
            ],

            // ── COMPLETED ──────────────────────────────────
            if (status == 'completed') ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.success.withOpacity(0.3)),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Text('🎉', style: TextStyle(fontSize: 24)),
                    const SizedBox(width: 10),
                    Expanded(child: Text(
                      'Job Completed!',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: AppColors.success, fontSize: 16),
                    )),
                  ]),
                  const SizedBox(height: 8),
                  Text('Earnings: ₹${((booking['price'] ?? 0) * 0.8).round()}',
                      style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
                  if (booking['completedAt'] != null) ...[
                    const SizedBox(height: 4),
                    Text('Completed at: ${_formatDate(booking['completedAt'])}',
                        style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
                  ],
                  if (hasBeforePhoto || hasAfterPhoto) ...[
                    const SizedBox(height: 12),
                    BeforeAfterPhotosWidget(
                      bookingId: booking['_id'],
                      initialBeforePhoto: hasBeforePhoto ? beforePhoto : null,
                      initialAfterPhoto: hasAfterPhoto ? afterPhoto : null,
                      canUploadBefore: false,
                      canUploadAfter: false,
                    ),
                  ],
                ]),
              ),
            ],

            // ── CANCELLED ──────────────────────────────────
            if (status == 'cancelled')
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withOpacity(0.2)),
                ),
                child: Row(children: [
                  const Text('❌', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Text('Booking was cancelled',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.error, fontSize: 13)),
                ]),
              ),
          ],
        ]),
      ),
    );
  }

  Widget _stepBanner(
    BuildContext context, {
    required String step,
    required String title,
    required String subtitle,
    Widget? child,
    required String btnLabel,
    required Color btnColor,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(step,
                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(title,
              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.text))),
        ]),
        const SizedBox(height: 6),
        Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
        if (child != null) ...[const SizedBox(height: 10), child],
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: btnColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(vertical: 13),
            ),
            child: Text(btnLabel,
                style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white)),
          ),
        ),
      ]),
    );
  }

  Widget _iconChip(IconData icon, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
        ]),
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) => SizedBox(
    width: double.infinity,
    child: ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 13),
      ),
      child: Text(label, style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white)),
    ),
  );

  Widget _row(IconData icon, String text) => Row(children: [
    Icon(icon, size: 14, color: AppColors.textSub),
    const SizedBox(width: 8),
    Expanded(child: Text(text,
        style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub),
        maxLines: 2,
        overflow: TextOverflow.ellipsis)),
  ]);

  void _snack(BuildContext context, String msg, Color bg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: bg,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  String _formatDate(String isoDate) {
    try {
      final d = DateTime.parse(isoDate).toLocal();
      return '${d.day}/${d.month}/${d.year} at ${d.hour.toString().padLeft(2,'0')}:${d.minute.toString().padLeft(2,'0')}';
    } catch (_) {
      return isoDate;
    }
  }

  String _categoryIcon(String cat) {
    const icons = {
      'Plumbing': '🔧', 'Electrical': '⚡', 'Cleaning': '🧹',
      'AC Repair': '❄️', 'Carpentry': '🪚', 'Painting': '🎨',
      'Pest Control': '🐛', 'CCTV Setup': '📹',
    };
    return icons[cat] ?? '🔧';
  }

  Widget _buildProblemBox(Map<String, dynamic> booking) {
    final description = booking['description']?.toString() ?? booking['problemDescription']?.toString() ?? '';
    final problemPhoto = booking['problemPhoto']?.toString() ?? booking['customerProblemPhoto']?.toString() ?? booking['beforePhoto']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('📝', style: TextStyle(fontSize: 15)),
              const SizedBox(width: 6),
              Text('Customer Problem Description:', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
            ],
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              description,
              style: GoogleFonts.inter(fontSize: 13, color: AppColors.text, fontWeight: FontWeight.w500),
            ),
          ],
          if (problemPhoto.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Text('📸', style: TextStyle(fontSize: 15)),
                const SizedBox(width: 6),
                Text('Problem Photo:', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                height: 140,
                width: double.infinity,
                child: _buildImageWidget(problemPhoto),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildImageWidget(String src) {
    if (src.startsWith('data:image')) {
      try {
        final decodedBytes = base64Decode(src.split(',').last);
        return Image.memory(decodedBytes, fit: BoxFit.cover);
      } catch (_) {}
    }
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return Image.network(src, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white54));
    }
    return Container(
      color: Colors.black26,
      child: const Center(child: Icon(Icons.image, color: Colors.white54, size: 32)),
    );
  }
}
