import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart'; // ignore: unused_import
import '../../providers/location_provider.dart';
import '../../utils/constants.dart';
import '../booking/service_detail_screen.dart';
import 'qr_scanner_screen.dart';
import '../bookings/my_bookings_screen.dart';
import '../profile/profile_screen.dart';
import '../notifications/notifications_screen.dart';
import '../chat/chat_screen.dart';
import '../location/location_picker_screen.dart';
import '../profile/worker_verification_screen.dart';
import '../../widgets/smart_recommendations_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:latlong2/latlong.dart';
import 'dart:math' as math;

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
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _loadCachedServices();
      _initLocation();
      _loadServices(); // Load live services from server
      final auth = context.read<AuthProvider>();
      if (auth.isLoggedIn) {
        context.read<BookingProvider>().fetchBookings(auth.token!, userId: auth.user?['_id']);
      }
    });
  }

  String _selectedCity = 'Hyderabad';

  static const List<String> _cities = [
    'Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam', 'Nalgonda', 'Suryapet'
  ];

  Future<void> _initLocation() async {
    final auth = context.read<AuthProvider>();
    final loc = context.read<LocationProvider>();
    final userId = auth.user?['_id'] ?? 'guest';
    final userName = auth.user?['name'] ?? 'Customer';

    // Load cached city first
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedCity = prefs.getString('selected_city');
      if (savedCity != null && _cities.contains(savedCity)) {
        setState(() => _selectedCity = savedCity);
      }
    } catch (_) {}

    await loc.fetchLocation(userId, userName: userName);
    // Auto-detect city from GPS address
    _autoSelectCity(loc.address);
  }

  double _getDistance(double lat1, double lon1, double lat2, double lon2) {
    var p = 0.017453292519943295;
    var c = math.cos;
    var a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * 
          (1 - c((lon2 - lon1) * p))/2;
    return 12742 * math.asin(math.sqrt(a)); // Distance in km
  }

  void _autoSelectCity(String address) {
    final loc = context.read<LocationProvider>();
    final pos = loc.position;

    if (pos != null) {
      // Coordinates mapping for supported cities
      final cityCoords = {
        'Hyderabad': const LatLng(17.3850, 78.4867),
        'Warangal': const LatLng(17.9689, 79.5941),
        'Karimnagar': const LatLng(18.4386, 79.1288),
        'Nizamabad': const LatLng(18.6725, 78.0941),
        'Khammam': const LatLng(17.2473, 80.1514),
        'Nalgonda': const LatLng(17.0575, 79.2684),
        'Suryapet': const LatLng(17.1500, 79.6167),
      };

      String closestCity = 'Hyderabad';
      double minDistance = double.infinity;

      cityCoords.forEach((cityName, coords) {
        final dist = _getDistance(
          pos.latitude,
          pos.longitude,
          coords.latitude,
          coords.longitude,
        );
        if (dist < minDistance) {
          minDistance = dist;
          closestCity = cityName;
        }
      });

      if (mounted && _selectedCity != closestCity) {
        setState(() => _selectedCity = closestCity);
        SharedPreferences.getInstance().then((prefs) {
          prefs.setString('selected_city', closestCity);
        });
      }
      return;
    }

    // Fallback to text search if position coordinates are not loaded yet
    final lower = address.toLowerCase();
    for (final city in _cities) {
      if (lower.contains(city.toLowerCase())) {
        if (mounted && _selectedCity != city) {
          setState(() => _selectedCity = city);
          SharedPreferences.getInstance().then((prefs) {
            prefs.setString('selected_city', city);
          });
        }
        return;
      }
    }
  }

  String _getShortAddress(String fullAddress) {
    if (fullAddress == 'Detecting location...' || fullAddress == 'Location unavailable' || fullAddress == 'Permission denied') {
      return fullAddress;
    }
    final parts = fullAddress.split(',');
    if (parts.isNotEmpty) {
      if (parts.length > 2) {
        return '${parts[0].trim()}, ${parts[1].trim()}';
      }
      return parts[0].trim();
    }
    return 'Select Location';
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  List<Map<String, dynamic>> _services = kServices; // fallback to hardcoded

  Future<void> _loadCachedServices() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString('cached_services');
      if (cached != null) {
        final decoded = jsonDecode(cached);
        if (decoded is List) {
          setState(() {
            _services = List<Map<String, dynamic>>.from(
              decoded.map((s) => Map<String, dynamic>.from(s))
            );
          });
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error loading cached services: $e');
    }
  }

  Future<void> _loadServices() async {
    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/services'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['services'] != null) {
        final list = List<Map<String, dynamic>>.from(
          (data['services'] as List).map((s) => Map<String, dynamic>.from(s))
        );
        setState(() {
          _services = list;
        });
        // Save to cache
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_services', jsonEncode(list));
      }
    } catch (e) {
      // Keep using previously loaded cached/fallback services
    }
  }

  List<Map<String, dynamic>> get _filteredServices => _search.isEmpty
      ? _services
      : _services.where((s) => s['name'].toString().toLowerCase().contains(_search.toLowerCase())).toList();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.bgGradient),
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
        icon: Icon(Icons.support_agent_rounded, color: Colors.white),
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
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const QRScannerScreen())),
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                  child: Icon(Icons.qr_code_scanner, color: AppColors.primary, size: 22),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => setState(() => _tab = 2),
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                  child: Icon(Icons.notifications_outlined, color: AppColors.text, size: 22),
                ),
              ),
              const SizedBox(width: 8),
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

        // ── Live Location & City Bar ──────────────────────────
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
          child: Consumer<LocationProvider>(
            builder: (context, loc, _) => GestureDetector(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const LocationPickerScreen()),
              ).then((_) {
                // When coming back, auto-detect city from selected address
                _autoSelectCity(loc.address);
              }),
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
                    child: Icon(Icons.location_on_rounded, color: AppColors.primary, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _getShortAddress(loc.address),
                            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.text),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(Icons.keyboard_arrow_down, color: AppColors.primary, size: 16),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      loc.address,
                      style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSub),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ])),
                  IconButton(
                    icon: Icon(Icons.my_location, color: AppColors.primary, size: 18),
                    onPressed: () async {
                      final uid = context.read<AuthProvider>().user?['_id'] ?? 'guest';
                      await loc.fetchLocation(uid);
                      _autoSelectCity(loc.address);
                    },
                  ),
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
            style: TextStyle(color: AppColors.text),
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: '🔍  Search services...',
              prefixIcon: Icon(Icons.search, color: AppColors.textSub),
              suffixIcon: _search.isNotEmpty
                  ? IconButton(icon: Icon(Icons.clear, color: AppColors.textSub, size: 18), onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); })
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


        // ── Smart Recommendations ─────────────────────────────
        if (_search.isEmpty) SliverToBoxAdapter(
          child: SmartRecommendationsWidget(
            onServiceTap: (category) {
              final svc = _services.firstWhere(
                (s) => s['name'].toString().toLowerCase() == category.toLowerCase(),
                orElse: () => _services.isNotEmpty ? _services.first : {'name': category, 'icon': '🔧', 'color': 0xFF7C3AED, 'price': 499},
              );
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => ServiceDetailScreen(service: svc),
              ));
            },
          ),
        ),

        // ── Section Title ─────────────────────────────────────
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_search.isEmpty ? '🛠️ Our Services' : '🔍 Search Results',
                style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
              if (_search.isEmpty) Text('${_services.length} services',
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
                Color color = AppColors.primary;
                if (s['color'] is int) color = Color(s['color'] as int);
                else if (s['color'] is String) {
                  String hex = s['color'].toString().replaceAll('#', '');
                  if (hex.length == 6) hex = 'FF$hex';
                  color = Color(int.tryParse(hex, radix: 16) ?? 0xFF7C3AED);
                }
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
                          child: Center(child: Text(s['icon'] as String, style: TextStyle(fontSize: 28))),
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


