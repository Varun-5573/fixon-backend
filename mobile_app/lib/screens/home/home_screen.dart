import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart'; // ignore: unused_import
import '../../providers/location_provider.dart';
import '../../utils/constants.dart';
import '../booking/service_detail_screen.dart';
import '../bookings/my_bookings_screen.dart';
import '../profile/profile_screen.dart';
import '../notifications/notifications_screen.dart';
import '../chat/chat_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  String _search = '';
  final _searchCtrl = TextEditingController();

  final List<Map<String, dynamic>> _banners = [
    {'title': '50% OFF First Booking!', 'sub': 'Use code FIRST50', 'color': AppColors.primary, 'icon': '🎉'},
    {'title': 'AC Service ₹799 Only', 'sub': 'Summer special deal', 'color': AppColors.secondary, 'icon': '❄️'},
    {'title': 'Refer & Earn ₹200', 'sub': 'Share with friends', 'color': Color(0xFF10B981), 'icon': '🎁'},
  ];
  int _bannerIndex = 0;

  @override
  void initState() {
    super.initState();
    // Auto-fetch GPS location once home screen loads
    WidgetsBinding.instance.addPostFrameCallback((_) => _initLocation());
  }

  Future<void> _initLocation() async {
    final auth = context.read<AuthProvider>();
    final loc = context.read<LocationProvider>();
    final userId = auth.user?['_id'] ?? 'guest';
    await loc.fetchLocation(userId);
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  List<Map<String, dynamic>> get _filteredServices => _search.isEmpty
      ? kServices
      : kServices.where((s) => s['name'].toString().toLowerCase().contains(_search.toLowerCase())).toList();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: IndexedStack(
            index: _tab,
            children: [
              _buildHome(user),
              const MyBookingsScreen(),
              const NotificationsScreen(),
              const ProfileScreen(),
            ],
          ),
        ),
      ),
      floatingActionButton: _tab == 0 ? FloatingActionButton.extended(
        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ChatScreen())),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.support_agent_rounded, color: Colors.white),
        label: Text('Live Support', style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: Colors.white)),
      ) : null,
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    const items = [
      {'icon': Icons.home_rounded, 'label': 'Home'},
      {'icon': Icons.calendar_today_rounded, 'label': 'Bookings'},
      {'icon': Icons.notifications_rounded, 'label': 'Alerts'},
      {'icon': Icons.person_rounded, 'label': 'Profile'},
    ];
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, -5))],
      ),
      child: Row(
        children: List.generate(items.length, (i) {
          final active = _tab == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _tab = i),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.all(active ? 8 : 0),
                      decoration: BoxDecoration(
                        color: active ? AppColors.primary.withOpacity(0.15) : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(items[i]['icon'] as IconData,
                        color: active ? AppColors.primary : AppColors.textSub, size: 24),
                    ),
                    const SizedBox(height: 4),
                    Text(items[i]['label'] as String,
                      style: GoogleFonts.inter(fontSize: 10, fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                        color: active ? AppColors.primary : AppColors.textSub)),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildHome(Map<String, dynamic>? user) {
    return CustomScrollView(
      slivers: [
        // ── App Bar ───────────────────────────────────────────
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: Row(
            children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Good ${_greeting()} 👋', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
                  const SizedBox(height: 2),
                  Text(user?['name'] ?? 'User', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
                ]),
              ),
              GestureDetector(
                onTap: () => setState(() => _tab = 2),
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                  child: const Icon(Icons.notifications_outlined, color: AppColors.text, size: 22),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () => setState(() => _tab = 3),
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(gradient: AppColors.primaryGradient, borderRadius: BorderRadius.circular(14)),
                  child: Center(child: Text((user?['name'] ?? 'U')[0].toUpperCase(), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white))),
                ),
              ),
            ],
          ),
        )),

        // ── Live Location Bar ─────────────────────────────────
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
          child: Consumer<LocationProvider>(
            builder: (context, loc, _) => GestureDetector(
              onTap: () {
                // Refresh location on tap
                final auth = context.read<AuthProvider>();
                loc.fetchLocation(auth.user?['_id'] ?? 'guest');
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                  boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.08), blurRadius: 12)],
                ),
                child: Row(children: [
                  Container(
                    width: 34, height: 34,
                    decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                    child: loc.loading
                        ? const Padding(
                            padding: EdgeInsets.all(8),
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                          )
                        : const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Your Location', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSub, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(
                      loc.loading ? 'Detecting...' : loc.address,
                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                  ])),
                  const Icon(Icons.refresh_rounded, color: AppColors.textSub, size: 16),
                ]),
              ),
            ),
          ),
        )),

        // ── Search Bar ────────────────────────────────────────
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
          child: TextField(
            controller: _searchCtrl,
            style: const TextStyle(color: AppColors.text),
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: '🔍  Search services...',
              prefixIcon: const Icon(Icons.search, color: AppColors.textSub),
              suffixIcon: _search.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear, color: AppColors.textSub, size: 18), onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); })
                  : null,
            ),
          ),
        )),

        // ── Promotional Banner ────────────────────────────────
        if (_search.isEmpty) SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: SizedBox(
            height: 160,
            child: PageView.builder(
              onPageChanged: (i) => setState(() => _bannerIndex = i),
              itemCount: _banners.length,
              itemBuilder: (_, i) {
                final b = _banners[i];
                return Container(
                  margin: const EdgeInsets.only(right: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(colors: [(b['color'] as Color).withOpacity(0.85), (b['color'] as Color)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                    boxShadow: [BoxShadow(color: (b['color'] as Color).withOpacity(0.4), blurRadius: 20, offset: const Offset(0, 8))],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(b['title'] as String, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white)),
                      const SizedBox(height: 4),
                      Text(b['sub'] as String, style: GoogleFonts.inter(fontSize: 12, color: Colors.white70)),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
                        child: Text('Book Now →', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                    ]),
                  ),
                );
              },
            ),
          ),
        )),

        // Banner Dots
        if (_search.isEmpty) SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_banners.length, (i) => AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: _bannerIndex == i ? 20 : 6, height: 6,
              decoration: BoxDecoration(color: _bannerIndex == i ? AppColors.primary : AppColors.textSub, borderRadius: BorderRadius.circular(3)),
            )),
          ),
        )),

        // ── Section Title ─────────────────────────────────────
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_search.isEmpty ? '🛠️ Our Services' : '🔍 Search Results',
                style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
              if (_search.isEmpty) Text('${kServices.length} services',
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
            ],
          ),
        )),

        // ── Services Grid ─────────────────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
          sliver: SliverGrid(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) {
                final s = _filteredServices[i];
                final color = Color(s['color'] as int);
                return GestureDetector(
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailScreen(service: s))),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 58, height: 58,
                          decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(16)),
                          child: Center(child: Text(s['icon'] as String, style: const TextStyle(fontSize: 28))),
                        ),
                        const SizedBox(height: 10),
                        Text(s['name'] as String, textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.text)),
                        const SizedBox(height: 4),
                        Text('From ₹${s['price']}',
                          style: GoogleFonts.inter(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                );
              },
              childCount: _filteredServices.length,
            ),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, crossAxisSpacing: 14, mainAxisSpacing: 14, childAspectRatio: 1.05,
            ),
          ),
        ),
      ],
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }
}
