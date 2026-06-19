import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../utils/constants.dart';

class WorkerLiveMapScreen extends StatefulWidget {
  final Map<String, dynamic> booking;
  const WorkerLiveMapScreen({super.key, required this.booking});

  @override
  State<WorkerLiveMapScreen> createState() => _WorkerLiveMapScreenState();
}

class _WorkerLiveMapScreenState extends State<WorkerLiveMapScreen>
    with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  LatLng? _workerLocation;
  LatLng? _customerLocation;
  StreamSubscription<Position>? _positionStream;
  bool _locationPermissionGranted = false;
  bool _mapReady = false;
  double _distanceKm = 0.0;
  String _estimatedTime = '...';

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _pulseAnimation =
        Tween<double>(begin: 0.8, end: 1.4).animate(_pulseController);

    _initCustomerLocation();
    _initGps();
  }

  void _initCustomerLocation() {
    final loc = widget.booking['location'];
    if (loc is Map) {
      final lat = (loc['lat'] as num?)?.toDouble();
      final lng = (loc['lng'] as num?)?.toDouble();
      if (lat != null && lng != null && lat != 0 && lng != 0) {
        _customerLocation = LatLng(lat, lng);
      }
    }
    // Fallback: Karimnagar city center if no customer GPS provided
    _customerLocation ??= const LatLng(18.4386, 79.1288);
  }

  Future<void> _initGps() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _showError('Location services are disabled.');
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _showError('Location permission denied.');
        return;
      }
    }
    if (permission == LocationPermission.deniedForever) {
      _showError('Location permission permanently denied. Enable in Settings.');
      return;
    }

    setState(() => _locationPermissionGranted = true);

    // Get initial position immediately
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      _updateWorkerLocation(pos);
    } catch (_) {}

    // Then stream updates every ~5 seconds
    _positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // update every 10 meters
      ),
    ).listen((Position pos) {
      _updateWorkerLocation(pos);
    });
  }

  void _updateWorkerLocation(Position pos) {
    if (!mounted) return;
    final workerLatLng = LatLng(pos.latitude, pos.longitude);
    setState(() {
      _workerLocation = workerLatLng;
      if (_customerLocation != null) {
        final dist = const Distance().as(
          LengthUnit.Kilometer,
          workerLatLng,
          _customerLocation!,
        );
        _distanceKm = dist;
        final mins = (dist / 0.4 * 60).round(); // ~40 km/h average speed
        _estimatedTime = mins < 1 ? '< 1 min' : '$mins min';
      }
    });

    // Animate map to fit both markers if map is ready
    if (_mapReady && _customerLocation != null) {
      final bounds = LatLngBounds(workerLatLng, _customerLocation!);
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.all(80),
        ),
      );
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _openGoogleMapsNavigation() async {
    if (_customerLocation == null) return;
    final lat = _customerLocation!.latitude;
    final lng = _customerLocation!.longitude;

    // Try Google Maps native navigation first, fallback to browser
    final googleMapsUrl = 'google.navigation:q=$lat,$lng&mode=d';
    final fallbackUrl =
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';

    final uri = Uri.parse(googleMapsUrl);
    final fallback = Uri.parse(fallbackUrl);

    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      await launchUrl(fallback, mode: LaunchMode.externalApplication);
    }
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bookingAddress =
        widget.booking['location']?['address'] as String? ??
            widget.booking['address']?.toString() ??
            'Customer Location';
    final customerName =
        widget.booking['userName']?.toString() ?? 'Customer';
    final service = widget.booking['service']?.toString() ?? 'Service';

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Stack(
        children: [
          // ── Full-screen Map ───────────────────────────────────
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _customerLocation ?? const LatLng(18.4386, 79.1288),
              initialZoom: 13.0,
              onMapReady: () => setState(() => _mapReady = true),
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.fixon.worker',
              ),

              // Route line between worker and customer
              if (_workerLocation != null && _customerLocation != null)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: [_workerLocation!, _customerLocation!],
                      color: AppColors.primary,
                      strokeWidth: 4.5,
                      pattern: StrokePattern.dashed(segments: [12, 6]),
                    ),
                  ],
                ),

              // Markers
              MarkerLayer(
                markers: [
                  // Customer location (red pin)
                  if (_customerLocation != null)
                    Marker(
                      point: _customerLocation!,
                      width: 60,
                      height: 70,
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.error,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              customerName.split(' ').first,
                              style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                          const Icon(Icons.location_on,
                              color: Color(0xFFEF4444), size: 36),
                        ],
                      ),
                    ),

                  // Worker location (green bike icon) with pulse
                  if (_workerLocation != null)
                    Marker(
                      point: _workerLocation!,
                      width: 70,
                      height: 70,
                      child: AnimatedBuilder(
                        animation: _pulseAnimation,
                        builder: (_, child) => Transform.scale(
                          scale: _pulseAnimation.value,
                          child: child,
                        ),
                        child: Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withOpacity(0.5),
                                blurRadius: 16,
                                spreadRadius: 4,
                              ),
                            ],
                            border: Border.all(
                                color: AppColors.primary, width: 3),
                          ),
                          child: const Center(
                            child: Text('🏍️',
                                style: TextStyle(fontSize: 26)),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),

          // ── Top Bar (back button + title) ────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                                color: Colors.black.withOpacity(0.15),
                                blurRadius: 8)
                          ],
                        ),
                        child: const Icon(Icons.arrow_back,
                            color: Color(0xFF1E293B), size: 20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 8)
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '📍 Live Tracking',
                              style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: AppColors.textSub,
                                  fontWeight: FontWeight.w600),
                            ),
                            Text(
                              '$service • $customerName',
                              style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.text),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Bottom Info Card ─────────────────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 24,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Distance + ETA chips
                  Row(
                    children: [
                      _infoChip(
                        Icons.straighten,
                        '${_distanceKm.toStringAsFixed(1)} km',
                        'Distance',
                        AppColors.primary,
                      ),
                      const SizedBox(width: 12),
                      _infoChip(
                        Icons.access_time_rounded,
                        _estimatedTime,
                        'Est. Arrival',
                        AppColors.success,
                      ),
                      const SizedBox(width: 12),
                      _infoChip(
                        Icons.location_searching,
                        _workerLocation != null ? 'Live' : 'Off',
                        'GPS',
                        _workerLocation != null
                            ? AppColors.success
                            : AppColors.error,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Address
                  Row(
                    children: [
                      const Icon(Icons.pin_drop,
                          color: Color(0xFFEF4444), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          bookingAddress,
                          style: GoogleFonts.inter(
                              fontSize: 13,
                              color: AppColors.textSub,
                              fontWeight: FontWeight.w500),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Navigate Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _openGoogleMapsNavigation,
                      icon: const Icon(Icons.navigation_rounded,
                          color: Colors.white, size: 20),
                      label: Text(
                        'Navigate with Google Maps',
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: Colors.white,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        padding:
                            const EdgeInsets.symmetric(vertical: 15),
                        elevation: 0,
                      ),
                    ),
                  ),

                  // Show GPS permission warning
                  if (!_locationPermissionGranted)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Row(
                        children: [
                          Icon(Icons.warning_rounded,
                              color: AppColors.warning, size: 16),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Enable location permission to see your position on map',
                              style: GoogleFonts.inter(
                                  fontSize: 11,
                                  color: AppColors.warning),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),

          // ── Re-center Button ────────────────────────────────
          if (_workerLocation != null)
            Positioned(
              bottom: 200,
              right: 20,
              child: FloatingActionButton.small(
                heroTag: 'recenter',
                backgroundColor: Colors.white,
                onPressed: () {
                  if (_workerLocation != null && _customerLocation != null) {
                    final bounds =
                        LatLngBounds(_workerLocation!, _customerLocation!);
                    _mapController.fitCamera(
                      CameraFit.bounds(
                        bounds: bounds,
                        padding: const EdgeInsets.all(80),
                      ),
                    );
                  } else if (_workerLocation != null) {
                    _mapController.move(_workerLocation!, 15.0);
                  }
                },
                child: Icon(Icons.my_location,
                    color: AppColors.primary, size: 20),
              ),
            ),
        ],
      ),
    );
  }

  Widget _infoChip(
      IconData icon, String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(height: 4),
            Text(value,
                style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.text)),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 10, color: AppColors.textSub)),
          ],
        ),
      ),
    );
  }
}
