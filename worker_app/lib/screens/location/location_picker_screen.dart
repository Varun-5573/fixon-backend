import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class LocationPickerScreen extends StatefulWidget {
  const LocationPickerScreen({super.key});

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  final MapController _mapController = MapController();
  LatLng _center = const LatLng(17.3850, 78.4867); // default Hyderabad
  String _address = 'Dragging to select address...';
  bool _isGeocoding = false;
  bool _isDragging = false;
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _detailCtrl = TextEditingController();
  String _addressType = 'Home'; // Home, Work, Other

  @override
  void initState() {
    super.initState();
    _loadCurrentLocation();
  }

  Future<void> _loadCurrentLocation() async {
    setState(() => _isGeocoding = true);
    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      final newCenter = LatLng(position.latitude, position.longitude);
      _mapController.move(newCenter, 16.0);
      _center = newCenter;
      await _reverseGeocode(newCenter);
    } catch (e) {
      debugPrint('Error getting GPS: $e');
      _reverseGeocode(_center);
    }
  }

  Future<void> _reverseGeocode(LatLng coords) async {
    if (!mounted) return;
    setState(() => _isGeocoding = true);
    try {
      final placemarks = await placemarkFromCoordinates(
        coords.latitude,
        coords.longitude,
      );
      if (placemarks.isNotEmpty && mounted) {
        final p = placemarks.first;
        final street = p.street ?? '';
        final area = p.subLocality ?? p.locality ?? '';
        final city = p.locality ?? p.administrativeArea ?? '';
        final state = p.administrativeArea ?? '';
        
        setState(() {
          _address = [
            if (street.isNotEmpty) street,
            if (area.isNotEmpty) area,
            if (city.isNotEmpty) city,
            if (state.isNotEmpty) state,
          ].join(', ');
          _isGeocoding = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _address = '${coords.latitude.toStringAsFixed(5)}, ${coords.longitude.toStringAsFixed(5)}';
          _isGeocoding = false;
        });
      }
    }
  }

  Future<void> _searchLocation(String query) async {
    if (query.trim().isEmpty) return;
    setState(() => _isGeocoding = true);
    try {
      final locations = await locationFromAddress(query);
      if (locations.isNotEmpty && mounted) {
        final loc = locations.first;
        final newCenter = LatLng(loc.latitude, loc.longitude);
        _mapController.move(newCenter, 16.0);
        _center = newCenter;
        await _reverseGeocode(newCenter);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isGeocoding = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not find location. Try typing city/area name.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          // ── Map view ───────────────────────────────────────────
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 15.0,
              onMapEvent: (event) {
                if (event is MapEventMove) {
                  setState(() {
                    _center = event.camera.center;
                    _isDragging = true;
                  });
                } else if (event is MapEventMoveEnd) {
                  setState(() {
                    _isDragging = false;
                  });
                  _reverseGeocode(_center);
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: dark
                    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                userAgentPackageName: 'com.fixon.app',
              ),
            ],
          ),

          // ── Center Pin Marker (Swiggy / Zomato style) ─────────
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: EdgeInsets.only(bottom: _isDragging ? 20 : 0),
                  child: Icon(
                    Icons.location_on_rounded,
                    size: 48,
                    color: AppColors.primary,
                  ),
                ),
                // Pin Shadow
                Container(
                  width: 8,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.black38,
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: const [
                      BoxShadow(color: Colors.black26, blurRadius: 4, spreadRadius: 1)
                    ],
                  ),
                ),
                const SizedBox(height: 48), // Match offset of pin base
              ],
            ),
          ),

          // ── Search & Header overlay ──────────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  // Header Back Button & title
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppColors.card,
                        child: IconButton(
                          icon: Icon(Icons.arrow_back, color: AppColors.text),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          'Choose location',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.text),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Search Bar
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _searchCtrl,
                      style: TextStyle(color: AppColors.text),
                      textInputAction: TextInputAction.search,
                      onSubmitted: _searchLocation,
                      decoration: InputDecoration(
                        hintText: 'Search city, area or street...',
                        hintStyle: TextStyle(color: AppColors.textSub),
                        prefixIcon: Icon(Icons.search, color: AppColors.primary),
                        suffixIcon: IconButton(
                          icon: Icon(Icons.send_rounded, color: AppColors.primary, size: 20),
                          onPressed: () => _searchLocation(_searchCtrl.text),
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Locate Me Floating Action Button ────────────────
          Positioned(
            right: 16,
            bottom: 290, // Position just above the bottom panel
            child: FloatingActionButton(
              mini: true,
              backgroundColor: AppColors.card,
              foregroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: AppColors.border),
              ),
              onPressed: _loadCurrentLocation,
              child: const Icon(Icons.my_location_rounded, size: 20),
            ),
          ),

          // ── Swiggy/Zomato style Bottom Details Panel ─────────
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(top: BorderSide(color: AppColors.border)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.25),
                    blurRadius: 20,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded, color: AppColors.primary, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Select Address',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.text,
                        ),
                      ),
                      const Spacer(),
                      if (_isGeocoding)
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  // Human Readable Address Box
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      _address,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: AppColors.text,
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Flat / House No / Landmark
                  TextField(
                    controller: _detailCtrl,
                    style: TextStyle(color: AppColors.text, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'House No, Flat, Landmark (Optional)',
                      hintStyle: TextStyle(color: AppColors.textSub, fontSize: 13),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Save address type selector (Home / Work / Other)
                  Row(
                    children: ['Home', 'Work', 'Other'].map((type) {
                      final active = _addressType == type;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text(type),
                          selected: active,
                          onSelected: (val) {
                            if (val) setState(() => _addressType = type);
                          },
                          labelStyle: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: active ? Colors.white : AppColors.textSub,
                          ),
                          selectedColor: AppColors.primary,
                          backgroundColor: AppColors.surface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(color: active ? AppColors.primary : AppColors.border),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Confirm Location Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      onPressed: _isGeocoding
                          ? null
                          : () {
                              final finalAddr = _detailCtrl.text.trim().isNotEmpty
                                  ? '${_detailCtrl.text.trim()}, $_address'
                                  : _address;
                              
                              // Update location provider
                              context.read<LocationProvider>().setManualLocation(
                                    _center.latitude,
                                    _center.longitude,
                                    finalAddr,
                                  );

                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('📍 Location set to $_addressType!'),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                              Navigator.pop(context);
                            },
                      child: Text(
                        'Confirm Location',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
