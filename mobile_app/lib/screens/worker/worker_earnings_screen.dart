import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';

class WorkerEarningsScreen extends StatefulWidget {
  const WorkerEarningsScreen({super.key});
  @override
  State<WorkerEarningsScreen> createState() => _WorkerEarningsScreenState();
}

class _WorkerEarningsScreenState extends State<WorkerEarningsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WorkerProvider>().fetchDashboard();
      context.read<WorkerProvider>().fetchMyBookings();
    });
  }

  @override
  Widget build(BuildContext context) {
    final wp = context.watch<WorkerProvider>();
    final stats = wp.stats ?? {};
    final completed = wp.myBookings.where((b) => b['status'] == 'completed').toList();

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        onRefresh: () async {
          await wp.fetchDashboard();
          await wp.fetchMyBookings();
        },
        color: AppColors.primary,
        child: CustomScrollView(slivers: [
          // Header
          SliverAppBar(
            pinned: true,
            backgroundColor: AppColors.bg,
            title: Text('💰 Earnings', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
          ),

          // Total Earnings Hero Card
          SliverToBoxAdapter(child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.success.withOpacity(0.3), AppColors.primary.withOpacity(0.2)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.success.withOpacity(0.3)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Text('🏦', style: TextStyle(fontSize: 28)),
                  const SizedBox(width: 10),
                  Text('Total Earnings', style: GoogleFonts.inter(color: Colors.white60, fontSize: 14)),
                ]),
                const SizedBox(height: 10),
                Text('₹${stats['totalEarnings'] ?? 0}',
                    style: GoogleFonts.outfit(fontSize: 42, fontWeight: FontWeight.w900, color: Colors.white)),
                const SizedBox(height: 4),
                Text('80% of all completed jobs', style: GoogleFonts.inter(fontSize: 12, color: Colors.white54)),
                const SizedBox(height: 16),
                Row(children: [
                  _miniStat('Today', '₹${stats['todayEarnings'] ?? 0}', AppColors.accent),
                  const SizedBox(width: 16),
                  _miniStat('Jobs Done', '${stats['completedBookings'] ?? 0}', AppColors.secondary),
                  const SizedBox(width: 16),
                  _miniStat('Rating', '${stats['rating'] ?? 0} ⭐', AppColors.primary),
                ]),
              ]),
            ),
          )),

          // Breakdown info
          SliverToBoxAdapter(child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Payment Split', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.text)),
                const SizedBox(height: 12),
                _splitRow('Your Earnings (80%)', '₹${stats['totalEarnings'] ?? 0}', AppColors.success),
                const SizedBox(height: 8),
                _splitRow('Platform Fee (20%)', '₹${((stats['totalEarnings'] ?? 0) / 0.8 * 0.2).round()}', AppColors.error),
                Divider(color: AppColors.border, height: 20),
                _splitRow('Total Revenue', '₹${((stats['totalEarnings'] ?? 0) / 0.8).round()}', AppColors.text),
              ]),
            ),
          )),

          // Job History Header
          SliverToBoxAdapter(child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: Text('Job History', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
          )),

          // Completed Jobs List
          if (completed.isEmpty)
            SliverToBoxAdapter(child: Center(child: Padding(
              padding: const EdgeInsets.all(40),
              child: Column(children: [
                const Text('💼', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 12),
                Text('No completed jobs yet', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
                const SizedBox(height: 8),
                Text('Accept bookings to start earning!', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
              ]),
            )))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    final b = completed[i];
                    final earned = ((b['price'] ?? 0) * 0.8).round();
                    final dt = b['completedAt'] != null ? DateTime.tryParse(b['completedAt']) : null;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(children: [
                        Container(
                          width: 42, height: 42,
                          decoration: BoxDecoration(
                            color: AppColors.success.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(child: Text(_icon(b['category'] ?? b['service'] ?? ''), style: const TextStyle(fontSize: 20))),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(b['service'] ?? b['category'] ?? 'Service',
                              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                          if (dt != null)
                            Text('${dt.day}/${dt.month}/${dt.year}',
                                style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
                        ])),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('₹$earned', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.success)),
                          Text('of ₹${b['price'] ?? 0}', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSub)),
                        ]),
                      ]),
                    );
                  },
                  childCount: completed.length,
                ),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _miniStat(String label, String val, Color color) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(children: [
        Text(val, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
        Text(label, style: GoogleFonts.inter(fontSize: 10, color: Colors.white60)),
      ]),
    ),
  );

  Widget _splitRow(String label, String val, Color valColor) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(label, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
      Text(val, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: valColor)),
    ],
  );

  String _icon(String cat) {
    const m = {'Plumbing': '🔧', 'Electrical': '⚡', 'Cleaning': '🧹', 'AC Repair': '❄️', 'Carpentry': '🪚', 'Painting': '🎨', 'Pest Control': '🐛'};
    return m[cat] ?? '🔧';
  }
}
