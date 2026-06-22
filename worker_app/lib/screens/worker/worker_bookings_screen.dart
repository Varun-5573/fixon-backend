import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
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

class _BookingCard extends StatelessWidget {
  final Map<String, dynamic> booking;
  final bool isNew;
  const _BookingCard({required this.booking, required this.isNew});

  @override
  Widget build(BuildContext context) {
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

    final statusColors = {
      'pending': AppColors.accent,
      'accepted': AppColors.primary,
      'on_the_way': AppColors.warning,
      'ongoing': AppColors.secondary,
      'completed': AppColors.success,
    };
    final color = statusColors[status] ?? AppColors.textSub;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isNew ? AppColors.primary.withOpacity(0.3) : AppColors.border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Top row
          Row(children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(_categoryIcon(booking['category'] ?? booking['service'] ?? ''), style: const TextStyle(fontSize: 22)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(booking['service'] ?? booking['category'] ?? 'Service',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
              Text('Customer: $userName', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
            ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(12)),
              child: Text(status.toUpperCase(), style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
            ),
          ]),

          const SizedBox(height: 12),
          Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),

          // Details
          _row(Icons.location_on_outlined, address),
          if (dt != null) ...[
            const SizedBox(height: 6),
            _row(Icons.calendar_today_outlined, '${dt.day}/${dt.month}/${dt.year} at ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}'),
          ],
          const SizedBox(height: 6),
          _row(Icons.currency_rupee, '₹${booking['price'] ?? 0} (Your share: ₹${((booking['price'] ?? 0) * 0.8).round()})'),
          
          if (userPhone.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.phone_outlined, size: 14, color: AppColors.textSub),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Phone: $userPhone',
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub),
                  ),
                ),
                if (status != 'pending') ...[
                  GestureDetector(
                    onTap: () async {
                      final uri = Uri.parse('tel:$userPhone');
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri);
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.phone, size: 12, color: AppColors.success),
                          const SizedBox(width: 4),
                          Text(
                            'CALL',
                            style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.success),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      final cId = booking['userId'] is Map ? booking['userId']['_id']?.toString() : booking['userId']?.toString();
                      if (cId != null) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => WorkerChatScreen(
                              workerId: cId,
                              workerName: userName,
                              workerCategory: 'Customer',
                            ),
                          ),
                        );
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.chat_bubble_outline, size: 12, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            'CHAT',
                            style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primary),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],

          // Customer Before Photo (if any)
          if (booking['beforePhoto'] != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withOpacity(0.2)),
              ),
              child: Row(children: [
                const Text('📸', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Text('Customer uploaded a before photo', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
              ]),
            ),
          ],

          const SizedBox(height: 12),

          // 📍 View on Map Button (always visible for all bookings)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => WorkerLiveMapScreen(booking: booking),
                  ),
                );
              },
              icon: const Icon(Icons.map_rounded, size: 16),
              label: Text('📍 View Customer Location on Map',
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600, fontSize: 13)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: BorderSide(color: AppColors.primary.withOpacity(0.5)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 11),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Action Buttons
          if (isNew) ...[
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final ok = await wp.rejectBooking(booking['_id']);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(ok ? '❌ Booking skipped' : 'Error'),
                        backgroundColor: AppColors.error,
                        behavior: SnackBarBehavior.floating,
                      ));
                    }
                  },
                  icon: const Icon(Icons.close, size: 16),
                  label: Text('❌ Reject Booking', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
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
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(ok ? '✅ Booking accepted!' : 'Failed — try again'),
                        backgroundColor: ok ? AppColors.success : AppColors.error,
                        behavior: SnackBarBehavior.floating,
                      ));
                    }
                  },
                  icon: const Icon(Icons.check, size: 16),
                  label: Text('✅ Accept Booking', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ]),
          ] else ...[
            // Status progression buttons
            if (status == 'accepted')
              _actionBtn('🏍️ Mark On The Way', AppColors.warning, () => wp.updateBookingStatus(booking['_id'], 'on-the-way')),
            if (status == 'on_the_way')
              _actionBtn('🔧 Work Started', AppColors.secondary, () => wp.updateBookingStatus(booking['_id'], 'start')),
            if (status == 'ongoing') ...[
              // Before/After photo upload widget for worker
              if (booking['_id'] != null)
                BeforeAfterPhotosWidget(
                  bookingId: booking['_id'],
                  initialBeforePhoto: booking['beforePhoto'],
                  initialAfterPhoto: booking['afterPhoto'],
                  canUploadBefore: booking['beforePhoto'] == null || booking['beforePhoto'].toString().isEmpty,
                  canUploadAfter: (booking['beforePhoto'] != null && booking['beforePhoto'].toString().isNotEmpty) && (booking['afterPhoto'] == null || booking['afterPhoto'].toString().isEmpty),
                ),
              const SizedBox(height: 10),
              _actionBtn('🟢 Mark Completed', AppColors.success, () {
                if (booking['beforePhoto'] == null || booking['beforePhoto'].toString().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text('⚠️ Please upload a BEFORE photo first!'),
                    backgroundColor: AppColors.error,
                  ));
                  return;
                }
                if (booking['afterPhoto'] == null || booking['afterPhoto'].toString().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text('⚠️ Please upload an AFTER photo first!'),
                    backgroundColor: AppColors.error,
                  ));
                  return;
                }
                wp.updateBookingStatus(booking['_id'], 'complete');
              }),
            ],
            if (status == 'completed')
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.success.withOpacity(0.3)),
                ),
                child: Row(children: [
                  const Text('🎉', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Text('Job Completed! ₹${((booking['price'] ?? 0) * 0.8).round()} earned',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: AppColors.success, fontSize: 14)),
                ]),
              ),
          ],
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
    Expanded(child: Text(text, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub), maxLines: 1, overflow: TextOverflow.ellipsis)),
  ]);

  String _categoryIcon(String cat) {
    const icons = {'Plumbing': '🔧', 'Electrical': '⚡', 'Cleaning': '🧹', 'AC Repair': '❄️', 'Carpentry': '🪚', 'Painting': '🎨', 'Pest Control': '🐛', 'CCTV Setup': '📹'};
    return icons[cat] ?? '🔧';
  }
}
