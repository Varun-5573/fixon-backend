import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import '../../utils/constants.dart';

const _statusColors = {
  'pending': AppColors.accent, 'accepted': AppColors.primary, 'ongoing': AppColors.secondary,
  'completed': AppColors.success, 'cancelled': AppColors.error
};
const _statusIcons = {
  'pending': '⏰', 'accepted': '✅', 'ongoing': '🔧', 'completed': '🎉', 'cancelled': '❌'
};

class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});
  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _tabLabels = ['All', 'Pending', 'Ongoing', 'Completed', 'Cancelled'];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _tabLabels.length, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      // ✅ Pass userId so server returns THIS user's bookings
      context.read<BookingProvider>().fetchBookings(
        auth.token ?? '',
        userId: auth.user?['_id']?.toString(),
      );
    });
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: Align(alignment: Alignment.centerLeft,
            child: Text('My Bookings 📦', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.text))),
        ),
        const SizedBox(height: 14),
        // Tabs
        TabBar(
          controller: _tabs,
          isScrollable: true,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSub,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13),
          unselectedLabelStyle: GoogleFonts.inter(fontSize: 13),
          tabs: _tabLabels.map((t) => Tab(text: t)).toList(),
        ),
        Expanded(
          child: Consumer<BookingProvider>(
            builder: (ctx, bp, _) {
              if (bp.loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
              return TabBarView(
                controller: _tabs,
                children: _tabLabels.map((label) {
                  final list = label == 'All' ? bp.bookings
                      : bp.bookings.where((b) => b['status'] == label.toLowerCase()).toList();
                  if (list.isEmpty) return _empty(label);
                  return ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                    itemCount: list.length,
                    itemBuilder: (_, i) => _BookingCard(booking: list[i]),
                  );
                }).toList(),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _empty(String label) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Text('📦', style: TextStyle(fontSize: 60)),
      const SizedBox(height: 16),
      Text('No ${label.toLowerCase()} bookings', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      Text('Book a service from the Home tab', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
    ]),
  );
}

class _BookingCard extends StatelessWidget {
  final Map<String, dynamic> booking;
  const _BookingCard({required this.booking});

  @override
  Widget build(BuildContext context) {
    final status = booking['status'] as String? ?? 'pending';
    final color = _statusColors[status] ?? AppColors.textSub;
    final worker = booking['workerId'] as Map<String, dynamic>?;
    final dt = booking['scheduledTime'] != null ? DateTime.tryParse(booking['scheduledTime'] as String) : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Top row
        Row(children: [
          Expanded(child: Text(booking['service'] as String? ?? '', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text))),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
            child: Text('${_statusIcons[status]} ${status[0].toUpperCase()}${status.substring(1)}',
              style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: color))),
        ]),
        const SizedBox(height: 12),
        // Date
        if (dt != null) _row(Icons.calendar_today_outlined, '${dt.day}/${dt.month}/${dt.year} at ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}'),
        const SizedBox(height: 6),
        // Address
        if (booking['location'] != null) _row(Icons.location_on_outlined, (booking['location'] as Map)['address'] as String? ?? 'N/A'),
        const SizedBox(height: 10),

        // Worker
        if (worker != null) ...[
          const Divider(color: AppColors.border, height: 16),
          Row(children: [
            Container(width: 36, height: 36,
              decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
              child: Center(child: Text((worker['name'] as String? ?? 'W')[0], style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.primary)))),
            const SizedBox(width: 10),
            Flexible(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(worker['name'] as String? ?? '', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text), overflow: TextOverflow.ellipsis),
              Text('⭐ ${worker['rating']} • 👷 Assigned', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub), overflow: TextOverflow.ellipsis),
            ])),
            if (status == 'ongoing') GestureDetector(
              onTap: () {},
              child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: AppColors.success.withOpacity(0.1), borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.success.withOpacity(0.3))),
                child: Text('📞 Call', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.success))),
            ),
          ]),
        ] else if (status == 'pending') ...[
          const Divider(color: AppColors.border, height: 16),
          Text('🔍 Finding the best worker for you...', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
          const SizedBox(height: 8),
          LinearProgressIndicator(backgroundColor: AppColors.card2, color: AppColors.primary, borderRadius: BorderRadius.circular(4)),
        ],

        // Price
        const Divider(color: AppColors.border, height: 20),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Amount', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
          Text('₹${booking['price'] ?? 0}', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.success)),
        ]),

        // Action buttons
        if (status == 'completed') ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.star_outline, size: 16),
              label: Text('Rate', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.accent, side: const BorderSide(color: AppColors.accent), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            )),
            const SizedBox(width: 10),
            Expanded(child: ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.refresh, size: 16),
              label: Text('Rebook', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
              style: ElevatedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), padding: const EdgeInsets.symmetric(vertical: 10)),
            )),
          ]),
        ],
      ]),
    );
  }

  Widget _row(IconData icon, String text) => Row(children: [
    Icon(icon, size: 14, color: AppColors.textSub),
    const SizedBox(width: 8),
    Expanded(child: Text(text, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub), maxLines: 1, overflow: TextOverflow.ellipsis)),
  ]);
}
