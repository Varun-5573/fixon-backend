import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'dart:async';
import 'dart:math' as math;
import '../utils/constants.dart';

class LiveMapWidget extends StatefulWidget {
  final Map<String, dynamic> booking;
  const LiveMapWidget({super.key, required this.booking});

  @override
  State<LiveMapWidget> createState() => _LiveMapWidgetState();
}

class _LiveMapWidgetState extends State<LiveMapWidget> {
  late LatLng _customerLocation;
  late LatLng _workerLocation;
  final MapController _mapController = MapController();
  Timer? _animTimer;
  double _fraction = 0.0;

  @override
  void initState() {
    super.initState();
    // Safety check: location might be a String in older demo bookings
    var loc = widget.booking['location'];
    double lat = 17.3850;
    double lng = 78.4867;
    
    if (loc is Map<String, dynamic>) {
      lat = loc['lat']?.toDouble() ?? 17.3850;
      lng = loc['lng']?.toDouble() ?? 78.4867;
    }
    
    _customerLocation = LatLng(lat, lng);
    
    // Simulate worker starting from 2km away
    _workerLocation = LatLng(lat - 0.015, lng - 0.015);
    
    // Animate worker towards customer slowly
    _animTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        _fraction += 0.02; // Move 2% every second
        if (_fraction >= 1.0) _fraction = 1.0;
        
        final currLat = _workerLocation.latitude + ((_customerLocation.latitude - _workerLocation.latitude) * _fraction);
        final currLng = _workerLocation.longitude + ((_customerLocation.longitude - _workerLocation.longitude) * _fraction);
        
        _workerLocation = LatLng(currLat, currLng);
      });
    });
  }

  @override
  void dispose() {
    _animTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 220,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.hardEdge,
      child: FlutterMap(
        mapController: _mapController,
        options: MapOptions(
          initialCenter: _customerLocation,
          initialZoom: 13.5,
          interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.fixon.app',
          ),
          PolylineLayer<Object>(
            polylines: [
              Polyline(
                points: [_workerLocation, _customerLocation],
                color: AppColors.primary,
                strokeWidth: 4.0,
              ),
            ],
          ),
          MarkerLayer(
            markers: [
              // Customer Destination
              Marker(
                point: _customerLocation,
                width: 40, height: 40,
                child: Icon(Icons.location_on, color: AppColors.error, size: 40),
              ),
              // Worker Location (Moving)
              Marker(
                point: _workerLocation,
                width: 50, height: 50,
                child: Container(
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white, boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)]),
                  child: const Center(child: Text('🏍️', style: TextStyle(fontSize: 24))),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
