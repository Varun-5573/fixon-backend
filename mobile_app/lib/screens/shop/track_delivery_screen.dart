import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geocoding/geocoding.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../providers/spare_parts_provider.dart';
import '../../utils/constants.dart';

class TrackDeliveryScreen extends StatefulWidget {
  final Map<String, dynamic> order;

  const TrackDeliveryScreen({super.key, required this.order});

  @override
  State<TrackDeliveryScreen> createState() => _TrackDeliveryScreenState();
}

class _TrackDeliveryScreenState extends State<TrackDeliveryScreen> with TickerProviderStateMixin {
  final MapController _mapController = MapController();

  LatLng? _workerLocation;
  LatLng _customerLocation = const LatLng(17.3850, 78.4867); // Safe default (Hyderabad)
  bool _locationLoaded = false;

  String _lastUpdatedText = 'Waiting for worker GPS...';
  double _distanceKm = 0.0;
  String _estimatedTime = 'Calculating...';
  bool _mapReady = false;
  bool _hasTileError = false;

  IO.Socket? _socket;
  Timer? _tickerTimer;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  double? _parseDouble(dynamic val) {
    if (val == null) return null;
    if (val is num) return val.toDouble();
    if (val is String) {
      return double.tryParse(val.trim());
    }
    return null;
  }

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.35).animate(_pulseController);

    _initLocations();
    _connectSocket();
    _fetchLatestTrackingInfo();

    _tickerTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _updateLastUpdatedText();
    });
  }

  void _initLocations() async {
    final order = widget.order;

    // Development logging as required by section 2
    debugPrint('--- TRACK_DELIVERY_SCREEN_OPENED ---');
    debugPrint('ORDER_ID: ${order['orderId'] ?? order['_id']}');
    debugPrint('ORDER_STATUS: ${order['orderStatus']}');
    debugPrint('WORKER_LATITUDE: ${order['workerLatitude']}');
    debugPrint('WORKER_LONGITUDE: ${order['workerLongitude']}');

    // 1. Initial Worker Location (if available from order object)
    final wLat = _parseDouble(order['workerLatitude']) ?? _parseDouble(order['workerLat']);
    final wLng = _parseDouble(order['workerLongitude']) ?? _parseDouble(order['workerLng']);

    if (wLat != null && wLng != null && wLat != 0 && wLng != 0) {
      _workerLocation = LatLng(wLat, wLng);
      _lastUpdatedText = 'GPS Active';
    } else {
      _workerLocation = null; // No fake worker GPS!
      _lastUpdatedText = 'Waiting for worker GPS broadcast...';
      _estimatedTime = 'Awaiting GPS...';
    }

    // 2. Extract Customer Location
    await _extractAndInitCustomerLocation();

    debugPrint('CUSTOMER_LATITUDE: ${_customerLocation.latitude}');
    debugPrint('CUSTOMER_LONGITUDE: ${_customerLocation.longitude}');

    if (_workerLocation != null) {
      _calculateDistanceAndEta();
    }
  }

  Future<void> _extractAndInitCustomerLocation() async {
    final order = widget.order;
    double? lat;
    double? lng;

    // 1. Direct fields on order
    lat = _parseDouble(order['customerLat']) ??
          _parseDouble(order['customerLatitude']) ??
          _parseDouble(order['latitude']) ??
          _parseDouble(order['lat']);

    lng = _parseDouble(order['customerLng']) ??
          _parseDouble(order['customerLongitude']) ??
          _parseDouble(order['longitude']) ??
          _parseDouble(order['lng']);

    // 2. Map inside deliveryAddress
    final delAddr = order['deliveryAddress'];
    if (lat == null || lng == null) {
      if (delAddr is Map) {
        lat = _parseDouble(delAddr['lat']) ?? _parseDouble(delAddr['latitude']);
        lng = _parseDouble(delAddr['lng']) ?? _parseDouble(delAddr['longitude']);
      } else if (delAddr is String && delAddr.trim().startsWith('{')) {
        try {
          final parsedMap = jsonDecode(delAddr);
          if (parsedMap is Map) {
            lat = _parseDouble(parsedMap['lat']) ?? _parseDouble(parsedMap['latitude']);
            lng = _parseDouble(parsedMap['lng']) ?? _parseDouble(parsedMap['longitude']);
          }
        } catch (_) {}
      }
    }

    // 3. Geocode address string if coordinates are missing
    if (lat == null || lng == null) {
      String addressStr = '';
      if (delAddr is String && delAddr.isNotEmpty && !delAddr.startsWith('{')) {
        addressStr = delAddr;
      } else if (delAddr is Map) {
        final street = delAddr['address'] ?? delAddr['street'] ?? delAddr['area'] ?? '';
        final city = delAddr['city'] ?? delAddr['state'] ?? '';
        addressStr = '$street $city'.trim();
      }

      if (addressStr.isNotEmpty) {
        try {
          final locations = await locationFromAddress(addressStr).timeout(const Duration(seconds: 4));
          if (locations.isNotEmpty) {
            lat = locations.first.latitude;
            lng = locations.first.longitude;
            debugPrint('📍 Geocoded customer address "$addressStr" -> ($lat, $lng)');
          }
        } catch (e) {
          debugPrint('⚠️ Geocoding failed for "$addressStr": $e');
        }
      }
    }

    final finalLat = lat ?? 17.3850;
    final finalLng = lng ?? 78.4867;

    if (mounted) {
      setState(() {
        _customerLocation = LatLng(finalLat, finalLng);
        _locationLoaded = true;
      });
      _fitMapBounds();
    }
  }

  Future<void> _fetchLatestTrackingInfo() async {
    final rawId = widget.order['orderId'] ?? widget.order['_id'];
    if (rawId == null) return;
    final cleanId = rawId.toString().replaceAll('#', '');

    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/spare-part-orders/$cleanId/tracking'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true && mounted) {
          final wLat = _parseDouble(data['workerLatitude']);
          final wLng = _parseDouble(data['workerLongitude']);
          final cLat = _parseDouble(data['customerLat']);
          final cLng = _parseDouble(data['customerLng']);

          setState(() {
            if (cLat != null && cLng != null) {
              _customerLocation = LatLng(cLat, cLng);
            }
            if (wLat != null && wLng != null && wLat != 0 && wLng != 0) {
              _workerLocation = LatLng(wLat, wLng);
              _lastUpdatedText = 'GPS Updated';
              _calculateDistanceAndEta();
            }
          });
          _fitMapBounds();
        }
      }
    } catch (_) {}
  }

  void _connectSocket() {
    try {
      final provider = Provider.of<SparePartsProvider>(context, listen: false);
      _socket = provider.socket;

      if (_socket == null) {
        _socket = IO.io(
          kBaseUrl,
          IO.OptionBuilder()
              .setTransports(['websocket', 'polling'])
              .enableAutoConnect()
              .build(),
        );
      }

      _socket?.on('spare_part_delivery_location', _onLocationReceived);
    } catch (e) {
      debugPrint('⚠️ Error attaching socket to tracking screen: $e');
    }
  }

  void _onLocationReceived(dynamic data) {
    if (!mounted || data == null || data is! Map) return;

    final eventOrderId = data['orderId']?.toString();
    final currentOrderId = widget.order['orderId']?.toString();
    final currentLookupId = widget.order['lookupId']?.toString() ?? currentOrderId?.replaceAll('#', '');

    if (eventOrderId != null &&
        (eventOrderId == currentOrderId ||
         eventOrderId == currentLookupId ||
         eventOrderId.replaceAll('#', '') == currentLookupId)) {

      final lat = _parseDouble(data['latitude'] ?? data['lat']);
      final lng = _parseDouble(data['longitude'] ?? data['lng']);

      if (lat != null && lng != null) {
        debugPrint('--- DELIVERY_LOCATION_RECEIVED ---');
        debugPrint('LAT: $lat, LNG: $lng');

        setState(() {
          _workerLocation = LatLng(lat, lng);
          _lastUpdatedText = 'Live • Active tracking';
          _hasTileError = false;
        });
        _calculateDistanceAndEta();
        _fitMapBounds();
      }
    }
  }

  void _calculateDistanceAndEta() {
    if (_workerLocation == null) return;
    final dist = const Distance().as(LengthUnit.Kilometer, _workerLocation!, _customerLocation);
    setState(() {
      _distanceKm = dist;
      final mins = (dist / 0.4 * 60).round(); // ~40 km/h avg speed
      _estimatedTime = mins < 1 ? 'Under 1 min' : '$mins min';
    });
  }

  void _updateLastUpdatedText() {
    if (!mounted) return;
    if (_workerLocation != null) {
      setState(() {
        _lastUpdatedText = 'Live • GPS Active';
      });
    }
  }

  void _fitMapBounds() {
    if (!_mapReady) return;
    try {
      if (_workerLocation != null && _workerLocation != _customerLocation) {
        final bounds = LatLngBounds(_workerLocation!, _customerLocation);
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: bounds,
            padding: const EdgeInsets.all(80),
          ),
        );
      } else {
        _mapController.move(_customerLocation, 14.5);
      }
    } catch (e) {
      debugPrint('⚠️ Error fitting map bounds: $e');
    }
  }

  void _zoomIn() {
    if (_mapReady) {
      _mapController.move(_mapController.camera.center, _mapController.camera.zoom + 1);
    }
  }

  void _zoomOut() {
    if (_mapReady) {
      _mapController.move(_mapController.camera.center, _mapController.camera.zoom - 1);
    }
  }

  @override
  void dispose() {
    _socket?.off('spare_part_delivery_location', _onLocationReceived);
    _pulseController.dispose();
    _tickerTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final orderId = widget.order['orderId'] ?? '#SP1000';
    final workerName = widget.order['deliveryWorkerName'] ?? 'FixoN Delivery Partner';
    final workerPhone = widget.order['deliveryWorkerPhone'] ?? '';
    final orderStatus = widget.order['orderStatus'] ?? 'OUT_FOR_DELIVERY';

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Stack(
        children: [
          // ── Map View ─────────────────────────────────────────
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _workerLocation ?? _customerLocation,
              initialZoom: 14.2,
              onMapReady: () {
                _mapReady = true;
                _fitMapBounds();
              },
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.fixon.app',
                errorTileCallback: (tile, error, stackTrace) {
                  if (mounted && !_hasTileError) {
                    setState(() {
                      _hasTileError = true;
                    });
                  }
                },
              ),

              // Route Line (if worker position available)
              if (_workerLocation != null)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: [_workerLocation!, _customerLocation],
                      color: const Color(0xFF0284C7),
                      strokeWidth: 4.5,
                      pattern: StrokePattern.dashed(segments: [12, 6]),
                    ),
                  ],
                ),

              // Markers Layer
              MarkerLayer(
                markers: [
                  // Customer Destination (Red Pin)
                  Marker(
                    point: _customerLocation,
                    width: 60,
                    height: 60,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.error,
                            borderRadius: BorderRadius.circular(6),
                            boxShadow: [
                              BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 4),
                            ],
                          ),
                          child: Text(
                            'Delivery Location',
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const Icon(Icons.location_on, color: Color(0xFFEF4444), size: 32),
                      ],
                    ),
                  ),

                  // Worker Marker (Green Pulse Bike)
                  if (_workerLocation != null)
                    Marker(
                      point: _workerLocation!,
                      width: 65,
                      height: 65,
                      child: AnimatedBuilder(
                        animation: _pulseAnimation,
                        builder: (_, child) => Transform.scale(
                          scale: _pulseAnimation.value,
                          child: child,
                        ),
                        child: Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF10B981).withOpacity(0.5),
                                blurRadius: 14,
                                spreadRadius: 4,
                              ),
                            ],
                            border: Border.all(color: const Color(0xFF10B981), width: 3),
                          ),
                          child: const Center(
                            child: Text('🛵', style: TextStyle(fontSize: 24)),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),

          // ── Tile Loading Error Banner ─────────────────────────
          if (_hasTileError)
            Positioned(
              top: 100,
              left: 20,
              right: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFB91C1C),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 8)],
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '⚠️ Map tiles loading issue. Please check internet connection.',
                        style: GoogleFonts.inter(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _hasTileError = false;
                        });
                        _fetchLatestTrackingInfo();
                      },
                      child: Text('RETRY', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)),
                    ),
                  ],
                ),
              ),
            ),

          // ── Header Bar ────────────────────────────────────────
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
                          color: const Color(0xFF1E293B),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 8),
                          ],
                        ),
                        child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFF334155)),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 8),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Live Spare Part Tracking', style: GoogleFonts.inter(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w600)),
                                Text(orderId, style: GoogleFonts.outfit(color: const Color(0xFF38BDF8), fontSize: 15, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0284C7).withOpacity(0.2),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFF38BDF8)),
                              ),
                              child: Text(
                                orderStatus == 'DELIVERED' ? '✅ DELIVERED' : '🚚 OUT FOR DELIVERY',
                                style: GoogleFonts.inter(color: const Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 10),
                              ),
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

          // ── Map Control Buttons (+, -, Re-center) ─────────────
          Positioned(
            right: 16,
            bottom: 220,
            child: Column(
              children: [
                FloatingActionButton.small(
                  heroTag: 'zoom_in_spare',
                  backgroundColor: const Color(0xFF1E293B),
                  onPressed: _zoomIn,
                  child: const Icon(Icons.add, color: Colors.white, size: 20),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'zoom_out_spare',
                  backgroundColor: const Color(0xFF1E293B),
                  onPressed: _zoomOut,
                  child: const Icon(Icons.remove, color: Colors.white, size: 20),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'recenter_spare_delivery',
                  backgroundColor: const Color(0xFF1E293B),
                  onPressed: _fitMapBounds,
                  child: const Icon(Icons.my_location, color: Color(0xFF38BDF8), size: 20),
                ),
              ],
            ),
          ),

          // ── Bottom Telemetry Card ─────────────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF334155)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.35), blurRadius: 20, offset: const Offset(0, -4)),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Partner Info
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withOpacity(0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Text('🛵', style: TextStyle(fontSize: 22)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(workerName, style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                            Text(_lastUpdatedText, style: GoogleFonts.inter(color: const Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      if (workerPhone.isNotEmpty)
                        ElevatedButton.icon(
                          onPressed: () async {
                            final uri = Uri.parse('tel:$workerPhone');
                            if (await canLaunchUrl(uri)) launchUrl(uri);
                          },
                          icon: const Icon(Icons.phone, size: 14, color: Colors.white),
                          label: Text('CALL', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 14),
                  const Divider(color: Color(0xFF334155)),
                  const SizedBox(height: 12),

                  // Distance, ETA Chips
                  Row(
                    children: [
                      _telemetryChip(
                        Icons.straighten,
                        _workerLocation != null ? '${_distanceKm.toStringAsFixed(1)} km' : 'Waiting...',
                        'Distance',
                        const Color(0xFF38BDF8),
                      ),
                      const SizedBox(width: 12),
                      _telemetryChip(
                        Icons.access_time_filled,
                        _estimatedTime,
                        'Est. Arrival',
                        const Color(0xFF10B981),
                      ),
                      const SizedBox(width: 12),
                      _telemetryChip(
                        Icons.sensors,
                        _workerLocation != null ? 'Active' : 'Standby',
                        'GPS Status',
                        const Color(0xFFA855F7),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _telemetryChip(IconData icon, String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(height: 4),
            Text(value, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
            Text(label, style: GoogleFonts.inter(fontSize: 9, color: Colors.white60)),
          ],
        ),
      ),
    );
  }
}
