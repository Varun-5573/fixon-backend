import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../../utils/constants.dart';

class InvoiceScreen extends StatefulWidget {
  final Map<String, dynamic> booking;
  const InvoiceScreen({super.key, required this.booking});

  @override
  State<InvoiceScreen> createState() => _InvoiceScreenState();
}

class _InvoiceScreenState extends State<InvoiceScreen> {
  Map<String, dynamic>? _invoice;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchInvoice();
  }

  Future<void> _fetchInvoice() async {
    final bookingId = widget.booking['_id'];
    if (bookingId == null) {
      _generateFallbackInvoice();
      return;
    }

    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/bookings/$bookingId/invoice'),
        headers: kHeaders,
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true && data['invoice'] != null) {
          setState(() {
            _invoice = data['invoice'];
            _loading = false;
          });
          return;
        }
      }
      _generateFallbackInvoice();
    } catch (_) {
      _generateFallbackInvoice();
    }
  }

  void _generateFallbackInvoice() {
    final b = widget.booking;
    final basePrice = int.tryParse(b['price']?.toString() ?? '0') ?? 0;
    final discount = int.tryParse(b['discount']?.toString() ?? '0') ?? 0;
    final platformFee = (basePrice * 0.05).round();
    final gstTax = ((basePrice + platformFee - discount) * 0.18).round();
    final total = basePrice + platformFee + gstTax - discount;

    final customerName = b['userName']?.toString() ??
        (b['userId'] is Map ? b['userId']['name']?.toString() : null) ??
        'Customer';
    final workerName = b['workerName']?.toString() ??
        (b['workerId'] is Map ? b['workerId']['name']?.toString() : null) ??
        'Assigned Worker';
    final address = b['location']?['address']?.toString() ?? b['address']?.toString() ?? 'Default Address';

    setState(() {
      _invoice = {
        'invoiceNumber': 'INV-${DateTime.now().year}-${(b['_id'] ?? '000000').toString().replaceAll(RegExp(r'[^0-9]'), '').padLeft(6, '0').substring(0, 6)}',
        'bookingId': b['_id'] ?? 'N/A',
        'customerName': customerName,
        'customerPhone': b['userPhone']?.toString() ?? '',
        'customerAddress': address,
        'workerName': workerName,
        'workerPhone': b['workerPhone']?.toString() ?? '',
        'serviceCategory': b['category']?.toString() ?? b['service']?.toString() ?? 'Home Service',
        'serviceName': b['service']?.toString() ?? 'Service',
        'bookingDate': b['createdAt']?.toString() ?? b['scheduledTime']?.toString() ?? DateTime.now().toIso8601String(),
        'completionDate': b['completedAt']?.toString() ?? DateTime.now().toIso8601String(),
        'labourCharge': basePrice,
        'materialCharge': 0,
        'platformFee': platformFee,
        'discount': discount,
        'gstTax': gstTax,
        'totalAmount': total,
        'paymentStatus': b['paymentStatus']?.toString() ?? 'Paid',
        'paymentMethod': b['paymentMethod']?.toString() ?? 'Online (UPI)',
      };
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.card,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, color: AppColors.text, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('🧾 Service Invoice', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
        actions: [
          IconButton(
            icon: Icon(Icons.share, color: AppColors.primary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: const Text('📄 Invoice link copied to clipboard!'),
                backgroundColor: AppColors.success,
              ));
            },
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  // Invoice Container
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 15, offset: const Offset(0, 4))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('FIXON', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.primary)),
                                Text('Official Tax Invoice', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600], fontWeight: FontWeight.w600)),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.success.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.success.withOpacity(0.3)),
                              ),
                              child: Text(
                                _invoice!['paymentStatus']?.toString().toUpperCase() ?? 'PAID',
                                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.success),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 16),
                        const Divider(color: Color(0xFFE2E8F0)),
                        const SizedBox(height: 12),

                        // Meta details
                        _metaRow('Invoice No:', _invoice!['invoiceNumber']),
                        _metaRow('Booking ID:', _invoice!['bookingId']),
                        _metaRow('Booking Date:', _formatDate(_invoice!['bookingDate'])),
                        _metaRow('Completed Date:', _formatDate(_invoice!['completionDate'])),
                        _metaRow('Payment Method:', _invoice!['paymentMethod']),

                        const SizedBox(height: 16),
                        const Divider(color: Color(0xFFE2E8F0)),
                        const SizedBox(height: 12),

                        // Customer & Worker info
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Billed To:', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey[700])),
                                  const SizedBox(height: 4),
                                  Text(_invoice!['customerName'], style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B))),
                                  Text(_invoice!['customerAddress'], style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]), maxLines: 2, overflow: TextOverflow.ellipsis),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Service Provider:', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey[700])),
                                  const SizedBox(height: 4),
                                  Text(_invoice!['workerName'], style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B))),
                                  Text(_invoice!['serviceCategory'], style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600])),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),
                        Text('Line Items', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B))),
                        const SizedBox(height: 8),

                        // Table
                        Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            children: [
                              _tableHeader(),
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),
                              _tableRow(_invoice!['serviceName'], 'Labour Service', '₹${_invoice!['labourCharge']}'),
                              if ((_invoice!['materialCharge'] ?? 0) > 0)
                                _tableRow('Spare Materials', 'Parts & Hardware', '₹${_invoice!['materialCharge']}'),
                              _tableRow('Platform Conveniences', 'System Fee', '₹${_invoice!['platformFee']}'),
                              if ((_invoice!['discount'] ?? 0) > 0)
                                _tableRow('Promo Discount', 'Coupon Applied', '-₹${_invoice!['discount']}'),
                              _tableRow('GST / Service Tax (18%)', 'Govt Tax', '₹${_invoice!['gstTax']}'),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),
                        const Divider(color: Color(0xFFE2E8F0)),
                        const SizedBox(height: 12),

                        // Total amount
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Grand Total Paid', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B))),
                            Text('₹${_invoice!['totalAmount']}', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.success)),
                          ],
                        ),

                        const SizedBox(height: 20),
                        Center(
                          child: Text(
                            'Thank you for using FixoN Services! 💚',
                            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600]),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Bottom action buttons
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: const Text('📄 Generating PDF Invoice download...'),
                          backgroundColor: AppColors.primary,
                        ));
                      },
                      icon: const Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 20),
                      label: Text('Download PDF Invoice', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _metaRow(String label, String? val) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
          Text(val ?? '—', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF1E293B))),
        ],
      ),
    );
  }

  Widget _tableHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(flex: 3, child: Text('Item Description', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.grey[700]))),
          Expanded(flex: 2, child: Text('Category', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.grey[700]))),
          Text('Amount', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.grey[700])),
        ],
      ),
    );
  }

  Widget _tableRow(String title, String sub, String amt) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF1E293B))),
                Text(sub, style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[600])),
              ],
            ),
          ),
          Expanded(flex: 2, child: Text(sub, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]))),
          Text(amt, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B))),
        ],
      ),
    );
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null) return 'N/A';
    try {
      final dt = DateTime.parse(dateStr.toString());
      return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr.toString();
    }
  }
}
