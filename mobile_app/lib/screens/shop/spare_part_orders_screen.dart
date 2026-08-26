import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/spare_parts_provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import 'track_delivery_screen.dart';

class SparePartOrdersScreen extends StatefulWidget {
  const SparePartOrdersScreen({super.key});

  @override
  State<SparePartOrdersScreen> createState() => _SparePartOrdersScreenState();
}

class _SparePartOrdersScreenState extends State<SparePartOrdersScreen> {
  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  void _loadOrders() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final custId = auth.user?['_id'] ?? auth.user?['userId'] ?? 'GUEST';
    Provider.of<SparePartsProvider>(context, listen: false).fetchMyOrders(custId);
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'DELIVERED': return const Color(0xFF10B981);
      case 'CANCELLED': return const Color(0xFFEF4444);
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY': return const Color(0xFF3B82F6);
      case 'CONFIRMED':
      case 'PACKED': return const Color(0xFF8B5CF6);
      default: return const Color(0xFFF59E0B);
    }
  }

  int _getStatusStepIndex(String status) {
    switch (status) {
      case 'NEW': return 0;
      case 'CONFIRMED': return 1;
      case 'PACKED': return 2;
      case 'SHIPPED': return 3;
      case 'OUT_FOR_DELIVERY': return 4;
      case 'DELIVERED': return 5;
      default: return -1; // Cancelled or unknown
    }
  }

  Widget _buildStatusStepper(String currentStatus) {
    if (currentStatus == 'CANCELLED') {
      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFEF4444).withOpacity(0.15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFEF4444)),
        ),
        child: Row(
          children: [
            const Icon(Icons.cancel, color: Color(0xFFEF4444), size: 20),
            const SizedBox(width: 8),
            Text('This order was cancelled', style: GoogleFonts.inter(color: const Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 13)),
          ],
        ),
      );
    }

    final steps = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Out', 'Delivered'];
    final currentIdx = _getStatusStepIndex(currentStatus);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(steps.length, (idx) {
            final isCompleted = idx <= currentIdx;
            final isCurrent = idx == currentIdx;

            return Expanded(
              child: Column(
                children: [
                  Row(
                    children: [
                      if (idx > 0)
                        Expanded(
                          child: Container(
                            height: 3,
                            color: idx <= currentIdx ? const Color(0xFF10B981) : const Color(0xFF334155),
                          ),
                        ),
                      Container(
                        width: isCurrent ? 22 : 16,
                        height: isCurrent ? 22 : 16,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isCompleted ? const Color(0xFF10B981) : const Color(0xFF1E293B),
                          border: Border.all(
                            color: isCompleted ? const Color(0xFF10B981) : const Color(0xFF64748B),
                            width: isCurrent ? 3 : 2,
                          ),
                        ),
                        child: isCompleted
                            ? const Icon(Icons.check, size: 10, color: Colors.white)
                            : null,
                      ),
                      if (idx < steps.length - 1)
                        Expanded(
                          child: Container(
                            height: 3,
                            color: idx < currentIdx ? const Color(0xFF10B981) : const Color(0xFF334155),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    steps[idx],
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                      color: isCurrent ? const Color(0xFF38BDF8) : (isCompleted ? Colors.white70 : Colors.white38),
                    ),
                  ),
                ],
              ),
            );
          }),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Text('My Spare Part Orders', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            onPressed: _loadOrders,
          ),
        ],
      ),
      body: Consumer<SparePartsProvider>(
        builder: (context, provider, _) {
          if (provider.myOrders.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('📦', style: TextStyle(fontSize: 50)),
                  const SizedBox(height: 12),
                  Text('No Orders Found', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                  const SizedBox(height: 6),
                  Text('You have not placed any spare part orders yet.', style: GoogleFonts.inter(color: Colors.white54, fontSize: 13)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => _loadOrders(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.myOrders.length,
              itemBuilder: (context, index) {
                final order = provider.myOrders[index];
                final String orderId = order['orderId'] ?? '#SP1000';
                final String orderStatus = order['orderStatus'] ?? 'NEW';
                final num partsAmount = order['partsAmount'] ?? order['subtotal'] ?? 0;
                final num deliveryCharge = order['deliveryCharge'] ?? 40;
                final num installationFee = order['installationFee'] ?? 0;
                final num grandTotal = order['totalAmount'] ?? (partsAmount + deliveryCharge + installationFee);
                final bool combo = order['comboWithTechnician'] == true;
                final List<dynamic> items = order['items'] ?? [];
                final List<dynamic> history = order['statusHistory'] ?? [];
                final String paymentStatus = order['paymentStatus'] ?? 'PENDING';

                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(orderId, style: GoogleFonts.outfit(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 18)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _getStatusColor(orderStatus).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: _getStatusColor(orderStatus)),
                            ),
                            child: Text(
                              orderStatus,
                              style: GoogleFonts.inter(color: _getStatusColor(orderStatus), fontWeight: FontWeight.bold, fontSize: 11),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 4),
                      Text(
                        'Placed on: ${order['createdAt'] != null ? DateTime.tryParse(order['createdAt'].toString())?.toLocal().toString().split('.')[0] ?? '' : 'Recently'}',
                        style: GoogleFonts.inter(color: Colors.white54, fontSize: 11),
                      ),

                      const SizedBox(height: 14),

                      // Order Visual Stepper
                      _buildStatusStepper(orderStatus),

                      if (combo) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFA855F7).withOpacity(0.4)),
                          ),
                          child: Row(
                            children: [
                              const Text('🛠️', style: TextStyle(fontSize: 16)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Combo Order: FixoN Technician Installation included (+₹$installationFee)',
                                  style: GoogleFonts.inter(color: const Color(0xFFA855F7), fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      if (order['deliveryWorkerName'] != null) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              const Text('🛵', style: TextStyle(fontSize: 16)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Delivery Partner: ${order['deliveryWorkerName']}',
                                      style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                                    ),
                                    if (order['deliveryWorkerPhone'] != null)
                                      Text(
                                        'Phone: ${order['deliveryWorkerPhone']}',
                                        style: GoogleFonts.inter(color: Colors.white70, fontSize: 11),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Live Delivery GPS Tracking Box
                      if (orderStatus == 'OUT_FOR_DELIVERY') ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.5)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Text('🚚', style: TextStyle(fontSize: 18)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('Live Delivery Tracking', style: GoogleFonts.outfit(color: const Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13)),
                                        Text(
                                          order['deliveryWorkerName'] != null
                                              ? '🛵 ${order['deliveryWorkerName']} is on the way with your parts!'
                                              : '📍 Real-time GPS active',
                                          style: GoogleFonts.inter(color: Colors.white70, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => TrackDeliveryScreen(order: order),
                                      ),
                                    );
                                  },
                                  icon: const Icon(Icons.location_on, color: Colors.white, size: 16),
                                  label: Text('📍 TRACK DELIVERY', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF0284C7),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    padding: const EdgeInsets.symmetric(vertical: 10),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else if (orderStatus == 'DELIVERED') ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '✅ Delivery Completed • Live tracking ended',
                                  style: GoogleFonts.inter(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],


                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFF334155)),

                      // Items List
                      Text('Ordered Items', style: GoogleFonts.inter(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      ...items.map((item) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '• ${item['partName']} x ${item['quantity']}',
                                style: GoogleFonts.inter(color: Colors.white70, fontSize: 13),
                              ),
                              Text(
                                '₹${item['subtotal'] ?? item['price']}',
                                style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ],
                          ),
                        );
                      }).toList(),

                      const SizedBox(height: 8),
                      const Divider(color: Color(0xFF334155)),

                      // Price Breakdown
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Parts Subtotal:', style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
                          Text('₹$partsAmount', style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Delivery Charge:', style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
                          Text('₹$deliveryCharge', style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
                        ],
                      ),
                      if (installationFee > 0) ...[
                        const SizedBox(height: 2),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Technician Installation:', style: GoogleFonts.inter(color: const Color(0xFFA855F7), fontSize: 12)),
                            Text('₹$installationFee', style: GoogleFonts.inter(color: const Color(0xFFA855F7), fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ],
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Total Amount (COD):', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                              Text(
                                'Payment: ${paymentStatus == 'PAID' ? '✅ Paid' : '⌛ Pending on Delivery'}',
                                style: GoogleFonts.inter(color: paymentStatus == 'PAID' ? const Color(0xFF10B981) : const Color(0xFFF59E0B), fontSize: 10),
                              ),
                            ],
                          ),
                          Text('₹$grandTotal', style: GoogleFonts.outfit(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 18)),
                        ],
                      ),

                      // History Timeline
                      if (history.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            tilePadding: EdgeInsets.zero,
                            title: Text('Order Status Timeline (${history.length})', style: GoogleFonts.inter(color: const Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold)),
                            children: history.map<Widget>((h) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('• ', style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text('${h['status']} - ${h['note'] ?? ''}', style: GoogleFonts.inter(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                                          if (h['timestamp'] != null)
                                            Text(DateTime.tryParse(h['timestamp'].toString())?.toLocal().toString().split('.')[0] ?? '', style: GoogleFonts.inter(color: Colors.white54, fontSize: 10)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

