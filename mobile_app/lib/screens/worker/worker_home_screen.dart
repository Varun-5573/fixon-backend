import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';
import 'worker_bookings_screen.dart';
import 'worker_earnings_screen.dart';
import 'worker_login_screen.dart';

class WorkerHomeScreen extends StatefulWidget {
  const WorkerHomeScreen({super.key});
  @override
  State<WorkerHomeScreen> createState() => _WorkerHomeScreenState();
}

class _WorkerHomeScreenState extends State<WorkerHomeScreen> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final wp = context.read<WorkerProvider>();
      wp.fetchDashboard();
      wp.fetchPendingBookings();
      wp.fetchMyBookings();
    });
  }

  @override
  Widget build(BuildContext context) {
    final wp = context.watch<WorkerProvider>();
    final worker = wp.worker;

    final pages = [
      _DashboardTab(worker: worker, stats: wp.stats),
      WorkerBookingsScreen(isNewBookings: true),
      WorkerBookingsScreen(isNewBookings: false),
      WorkerEarningsScreen(),
    ];

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: pages[_tab],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          child: Row(
            children: [
              _navItem(0, Icons.dashboard_rounded, 'Home'),
              _navItem(1, Icons.notifications_active_rounded, 'New', badge: wp.pendingBookings.length),
              _navItem(2, Icons.work_rounded, 'My Jobs'),
              _navItem(3, Icons.account_balance_wallet_rounded, 'Earnings'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(int idx, IconData icon, String label, {int badge = 0}) {
    final active = _tab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _tab = idx);
          final wp = context.read<WorkerProvider>();
          if (idx == 1) wp.fetchPendingBookings();
          if (idx == 2) wp.fetchMyBookings();
          if (idx == 3) wp.fetchDashboard();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(children: [
            Stack(clipBehavior: Clip.none, children: [
              Icon(icon, color: active ? AppColors.primary : AppColors.textSub, size: 24),
              if (badge > 0)
                Positioned(
                  top: -4, right: -6,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                    child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                ),
            ]),
            const SizedBox(height: 4),
            Text(label, style: GoogleFonts.inter(fontSize: 10, color: active ? AppColors.primary : AppColors.textSub, fontWeight: active ? FontWeight.w700 : FontWeight.normal)),
          ]),
        ),
      ),
    );
  }
}

class _DashboardTab extends StatelessWidget {
  final Map<String, dynamic>? worker;
  final Map<String, dynamic>? stats;
  const _DashboardTab({this.worker, this.stats});

  @override
  Widget build(BuildContext context) {
    final wp = context.watch<WorkerProvider>();
    final isOnline = wp.isOnline;

    return CustomScrollView(slivers: [
      // App Bar
      SliverAppBar(
        expandedHeight: 160,
        pinned: true,
        backgroundColor: AppColors.bg,
        flexibleSpace: FlexibleSpaceBar(
          background: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isOnline
                    ? [AppColors.success.withOpacity(0.2), AppColors.bg]
                    : [AppColors.primary.withOpacity(0.15), AppColors.bg],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Container(
                      width: 50, height: 50,
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(child: Text(
                        (worker?['name'] ?? 'W').toString()[0].toUpperCase(),
                        style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white),
                      )),
                    ),
                    const SizedBox(width: 14),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${_greeting()}, ${worker?['name']?.toString().split(' ').first ?? 'Worker'}! 👋',
                          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                      Text(worker?['workerId'] ?? '', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
                    ])),
                    // Online Toggle
                    GestureDetector(
                      onTap: () => wp.toggleOnline(!isOnline),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: isOnline ? AppColors.success.withOpacity(0.15) : AppColors.error.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: isOnline ? AppColors.success.withOpacity(0.4) : AppColors.error.withOpacity(0.3)),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(width: 8, height: 8,
                            decoration: BoxDecoration(
                              color: isOnline ? AppColors.success : AppColors.error,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(isOnline ? 'Online' : 'Offline',
                              style: GoogleFonts.inter(color: isOnline ? AppColors.success : AppColors.error, fontSize: 12, fontWeight: FontWeight.w700)),
                        ]),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('🔧 ${worker?['category'] ?? ''} • ⭐ ${worker?['rating'] ?? 0} • ${worker?['experience'] ?? ''}',
                        style: GoogleFonts.inter(fontSize: 11, color: AppColors.primary)),
                  ),
                ]),
              ),
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.logout, color: AppColors.textSub),
            onPressed: () async {
              await wp.logout();
              if (context.mounted) {
                Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const WorkerLoginScreen()));
              }
            },
          ),
        ],
      ),

      // Stats Grid
      SliverToBoxAdapter(child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Today\'s Summary', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
          const SizedBox(height: 14),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.5,
            children: [
              _statCard('Today\'s Earnings', '₹${stats?['todayEarnings'] ?? 0}', '💰', AppColors.success),
              _statCard('Total Earned', '₹${stats?['totalEarnings'] ?? 0}', '🏦', AppColors.primary),
              _statCard('Completed Jobs', '${stats?['completedBookings'] ?? 0}', '✅', const Color(0xFF10B981)),
              _statCard('Rating', '${stats?['rating'] ?? 0} ⭐', '⭐', AppColors.accent),
            ],
          ),
        ]),
      )),

      // New Bookings Alert
      if ((wp.pendingBookings.length) > 0) SliverToBoxAdapter(child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        child: GestureDetector(
          onTap: () {},
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withOpacity(0.2), AppColors.primary.withOpacity(0.05)]),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.primary.withOpacity(0.4)),
            ),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(gradient: AppColors.primaryGradient, borderRadius: BorderRadius.circular(12)),
                child: const Text('🔔', style: TextStyle(fontSize: 22)),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${wp.pendingBookings.length} New Booking${wp.pendingBookings.length > 1 ? 's' : ''}!',
                    style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                Text('Tap the New tab to accept or reject', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
              ])),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(gradient: AppColors.primaryGradient, borderRadius: BorderRadius.circular(10)),
                child: Text('View →', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ]),
          ),
        ),
      )),

      const SliverToBoxAdapter(child: SizedBox(height: 100)),
    ]);
  }

  Widget _statCard(String label, String value, String icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(icon, style: const TextStyle(fontSize: 22)),
        const Spacer(),
        Text(value, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.text)),
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
      ]),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }
}
