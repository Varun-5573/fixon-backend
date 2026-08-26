import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';
import 'worker_live_map_screen.dart';

class WorkerSparePartDeliveriesScreen extends StatefulWidget {
  const WorkerSparePartDeliveriesScreen({super.key});

  @override
  State<WorkerSparePartDeliveriesScreen> createState() => _WorkerSparePartDeliveriesScreenState();
}

class _WorkerSparePartDeliveriesScreenState extends State<WorkerSparePartDeliveriesScreen> {
  List<dynamic> _deliveries = [];
  bool _loading = true;
  bool _error = false;
  static Timer? _gpsStreamTimer;

  @override
  void initState() {
    super.initState();
    _fetchDeliveries();
  }

  Future<void> _fetchDeliveries() async {
    setState(() {
      _loading = true;
      _error = false;
    });

    final wp = Provider.of<WorkerProvider>(context, listen: false);
    final workerId = wp.worker?['_id'] ?? wp.worker?['workerId'] ?? '';

    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/worker/spare-part-deliveries?workerId=$workerId'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          setState(() {
            _deliveries = data['deliveries'] ?? [];
            _loading = false;
          });
          return;
        }
      }
      setState(() {
        _loading = false;
        _error = true;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<void> _startDelivery(Map<String, dynamic> delivery) async {
    final rawId = delivery['orderId'] ?? delivery['_id'];
    final cleanId = rawId.toString().replaceAll('#', '');
    final wp = Provider.of<WorkerProvider>(context, listen: false);
    final workerId = wp.worker?['_id'] ?? wp.worker?['workerId'] ?? '';

    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/spare-part-orders/$cleanId/start-delivery'),
        headers: kHeaders,
        body: jsonEncode({
          'workerId': workerId,
          'workerName': wp.worker?['name'] ?? 'Worker',
          'workerPhone': wp.worker?['phone'] ?? '',
        }),
      ).timeout(const Duration(seconds: 10));

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _snack('🚚 Delivery started! Live GPS tracking activated.', AppColors.success);
        _startGpsBroadcasting(cleanId, workerId);
        _fetchDeliveries();

        // Navigate to live map screen for navigation
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => WorkerLiveMapScreen(
                booking: {
                  ...delivery,
                  'service': 'Spare Parts Delivery (${delivery['orderId'] ?? ''})',
                  'location': delivery['deliveryAddress'],
                  'userName': delivery['customerName'],
                  'userPhone': delivery['customerPhone'],
                  'orderId': cleanId,
                },
              ),
            ),
          );
        }
      } else {
        _snack(data['message'] ?? 'Could not start delivery', AppColors.error);
      }
    } catch (e) {
      _snack('Connection error starting delivery', AppColors.error);
    }
  }

  void _startGpsBroadcasting(String cleanOrderId, String workerId) async {
    _gpsStreamTimer?.cancel();

    // Check permission
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;

    // Send initial immediate location update
    _pushGpsLocation(cleanOrderId, workerId);

    // Broadcast GPS location to server every 10 seconds
    _gpsStreamTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _pushGpsLocation(cleanOrderId, workerId);
    });
  }

  static Future<void> _pushGpsLocation(String cleanOrderId, String workerId) async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 6));

      await http.post(
        Uri.parse('$kBaseUrl/api/worker/spare-part-orders/$cleanOrderId/location'),
        headers: kHeaders,
        body: jsonEncode({
          'workerId': workerId,
          'latitude': pos.latitude,
          'longitude': pos.longitude,
          'timestamp': DateTime.now().toIso8601String(),
        }),
      ).timeout(const Duration(seconds: 6));
    } catch (_) {}
  }

  Future<void> _markDelivered(Map<String, dynamic> delivery) async {
    final rawId = delivery['orderId'] ?? delivery['_id'];
    final cleanId = rawId.toString().replaceAll('#', '');

    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/worker/spare-part-orders/$cleanId/delivered'),
        headers: kHeaders,
      ).timeout(const Duration(seconds: 10));

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        _gpsStreamTimer?.cancel();
        _snack('✅ Order marked DELIVERED! Cash collected.', AppColors.success);
        _fetchDeliveries();
      } else {
        _snack(data['message'] ?? 'Could not mark delivered', AppColors.error);
      }
    } catch (e) {
      _snack('Connection error completing delivery', AppColors.error);
    }
  }

  void _snack(String msg, Color bg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: bg,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.card,
        elevation: 0,
        title: Text('📦 Spare Part Deliveries', style: GoogleFonts.outfit(color: AppColors.text, fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: AppColors.textSub),
            onPressed: _fetchDeliveries,
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.textSub),
                      const SizedBox(height: 12),
                      Text('Failed to load deliveries', style: GoogleFonts.outfit(color: AppColors.text, fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _fetchDeliveries,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _deliveries.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('🛵', style: TextStyle(fontSize: 50)),
                          const SizedBox(height: 12),
                          Text('No Spare Part Deliveries Assigned', style: GoogleFonts.outfit(color: AppColors.text, fontWeight: FontWeight.bold, fontSize: 18)),
                          const SizedBox(height: 6),
                          Text('Deliveries assigned to you will appear here.', style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 13)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchDeliveries,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _deliveries.length,
                        itemBuilder: (ctx, idx) {
                          final item = _deliveries[idx];
                          final orderId = item['orderId'] ?? '#SP1000';
                          final status = item['orderStatus'] ?? 'NEW';
                          final custName = item['customerName'] ?? 'Customer';
                          final custPhone = item['customerPhone'] ?? '';
                          final rawAddress = item['deliveryAddress'];
                          final address = rawAddress is Map ? (rawAddress['address'] ?? 'N/A') : rawAddress?.toString() ?? 'N/A';
                          final num totalAmount = item['totalAmount'] ?? 0;
                          final itemsList = item['items'] as List? ?? [];

                          final isOutForDelivery = status == 'OUT_FOR_DELIVERY';
                          final isDelivered = status == 'DELIVERED';

                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.card,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isOutForDelivery ? AppColors.primary : AppColors.border,
                                width: isOutForDelivery ? 2 : 1,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(orderId, style: GoogleFonts.outfit(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 17)),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: isOutForDelivery
                                            ? AppColors.primary.withOpacity(0.2)
                                            : isDelivered ? AppColors.success.withOpacity(0.2) : AppColors.warning.withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        status,
                                        style: GoogleFonts.inter(
                                          color: isOutForDelivery
                                              ? AppColors.primary
                                              : isDelivered ? AppColors.success : AppColors.warning,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Divider(color: AppColors.border),
                                const SizedBox(height: 8),

                                // Customer details
                                _infoRow(Icons.person_outline, 'Customer: $custName'),
                                const SizedBox(height: 4),
                                _infoRow(Icons.location_on_outlined, 'Address: $address'),
                                if (custPhone.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Icon(Icons.phone_outlined, size: 14, color: AppColors.textSub),
                                      const SizedBox(width: 8),
                                      Expanded(child: Text('Phone: $custPhone', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub))),
                                      GestureDetector(
                                        onTap: () async {
                                          final uri = Uri.parse('tel:$custPhone');
                                          if (await canLaunchUrl(uri)) launchUrl(uri);
                                        },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: AppColors.success.withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Row(
                                            children: [
                                              Icon(Icons.phone, size: 12, color: AppColors.success),
                                              const SizedBox(width: 4),
                                              Text('Call', style: GoogleFonts.inter(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 11)),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],

                                const SizedBox(height: 10),
                                Text('Items to Deliver:', style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 11, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 4),
                                ...itemsList.map((i) => Padding(
                                  padding: const EdgeInsets.only(bottom: 2),
                                  child: Text('• ${i['partName']} x ${i['quantity']}', style: GoogleFonts.inter(color: AppColors.text, fontSize: 12)),
                                )),

                                const SizedBox(height: 10),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Collect Cash on Delivery:', style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 12)),
                                    Text('₹$totalAmount', style: GoogleFonts.outfit(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 17)),
                                  ],
                                ),

                                const SizedBox(height: 14),
                                // Action buttons
                                if (!isOutForDelivery && !isDelivered) ...[
                                  SizedBox(
                                    width: double.infinity,
                                    child: ElevatedButton.icon(
                                      onPressed: () => _startDelivery(item),
                                      icon: const Icon(Icons.delivery_dining, color: Colors.white),
                                      label: Text('🚀 START DELIVERY & TRACKING', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: AppColors.primary,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      ),
                                    ),
                                  ),
                                ] else if (isOutForDelivery) ...[
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () {
                                            final rawId = item['orderId'] ?? item['_id'];
                                            final cleanId = rawId.toString().replaceAll('#', '');
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) => WorkerLiveMapScreen(
                                                  booking: {
                                                    ...item,
                                                    'service': 'Spare Parts Delivery ($orderId)',
                                                    'location': item['deliveryAddress'],
                                                    'userName': custName,
                                                    'userPhone': custPhone,
                                                    'orderId': cleanId,
                                                  },
                                                ),
                                              ),
                                            );
                                          },
                                          icon: const Icon(Icons.map, size: 16),
                                          label: Text('📍 Map & Nav', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12)),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: AppColors.primary,
                                            side: BorderSide(color: AppColors.primary),
                                            padding: const EdgeInsets.symmetric(vertical: 12),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: ElevatedButton.icon(
                                          onPressed: () => _markDelivered(item),
                                          icon: const Icon(Icons.check_circle, size: 16, color: Colors.white),
                                          label: Text('✅ Delivered', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white)),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: AppColors.success,
                                            padding: const EdgeInsets.symmetric(vertical: 12),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else if (isDelivered) ...[
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: AppColors.success.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Center(
                                      child: Text('✅ Order Delivered & Payment Collected', style: GoogleFonts.inter(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 12)),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.textSub),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
