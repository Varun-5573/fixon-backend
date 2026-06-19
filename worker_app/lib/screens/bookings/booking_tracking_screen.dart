import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../../utils/constants.dart';
import '../../widgets/live_map_widget.dart';

class BookingTrackingScreen extends StatefulWidget {
  final Map<String, dynamic> booking;
  const BookingTrackingScreen({super.key, required this.booking});

  @override
  State<BookingTrackingScreen> createState() => _BookingTrackingScreenState();
}

class _BookingTrackingScreenState extends State<BookingTrackingScreen> {
  final List<Map<String, dynamic>> _steps = [
    {'status': 'pending', 'label': 'Booking Placed', 'desc': 'Matching the best professional for you'},
    {'status': 'accepted', 'label': 'Confirmed', 'desc': 'Work has been assigned & confirmed'},
    {'status': 'on_the_way', 'label': 'On The Way', 'desc': 'Professional is heading to your location'},
    {'status': 'started', 'label': 'Job Started', 'desc': 'Quality work is in progress'},
    {'status': 'completed', 'label': 'Completed', 'desc': 'Job finished! Hope you liked FixoN'},
  ];

  int _selectedStars = 5;
  final _commentCtrl = TextEditingController();
  bool _isAlreadyRated = false;
  bool _submittingRating = false;

  @override
  void initState() {
    super.initState();
    _isAlreadyRated = widget.booking['rated'] == true;
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  int _getCurrentStep() {
    final status = widget.booking['status']?.toString().toLowerCase() ?? 'pending';
    if (status == 'cancelled') return -1;
    
    // Status normalization
    final mappedStatus = status == 'ongoing' ? 'started' : status;
    
    for (int i = 0; i < _steps.length; i++) {
      if (_steps[i]['status'] == mappedStatus) return i;
    }
    return 0;
  }

  Future<void> _submitRating() async {
    final worker = widget.booking['workerId'];
    if (worker == null) return;
    setState(() => _submittingRating = true);
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/ratings'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'bookingId': widget.booking['_id'],
          'workerId': worker['_id'],
          'rating': _selectedStars,
          'comment': _commentCtrl.text.trim(),
        }),
      ).timeout(const Duration(seconds: 8));

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        setState(() {
          _isAlreadyRated = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('⭐ Thank you for your feedback!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('⚠️ Rating submission failed. Please try again.'), backgroundColor: Colors.red),
      );
    }
    setState(() => _submittingRating = false);
  }

  Future<void> _fetchAndShowInvoice() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator(color: Colors.white)),
    );
    try {
      final res = await http.get(
        Uri.parse('$kBaseUrl/api/bookings/${widget.booking['_id']}/invoice'),
      ).timeout(const Duration(seconds: 8));
      
      Navigator.pop(context); // Dismiss loading dialog

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        final inv = data['invoice'];
        _showInvoiceDialog(inv);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('⚠️ Invoice not generated yet.')),
        );
      }
    } catch (e) {
      Navigator.pop(context); // Dismiss loading dialog
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('⚠️ Failed to load invoice. Server offline?')),
      );
    }
  }

  void _showInvoiceDialog(Map<String, dynamic> inv) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(topLeft: Radius.circular(28), topRight: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(inv['company']['name'], style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                    Text('Ph: ${inv['company']['phone']}', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('TAX INVOICE', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.primary)),
                    Text('Invoice: ${inv['invoiceNo']}', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
                  ],
                ),
              ],
            ),
            const Divider(height: 30),
            Text('CUSTOMER: ${inv['customer']['name']}', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey[700])),
            Text('ADDRESS: ${inv['address']}', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
            const SizedBox(height: 15),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(inv['items'][0]['description'] ?? 'Service charge', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                  Text('₹${inv['items'][0]['amount']}', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 15),
            _invoiceRow('Subtotal', '₹${inv['subtotal']}'),
            _invoiceRow('GST (18%)', '₹${inv['gst']}'),
            if (inv['discount'] > 0)
              _invoiceRow('Coupon Discount', '-₹${inv['discount']}', isDiscount: true),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total Bill', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey[800])),
                Text('₹${inv['total']}', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.success)),
              ],
            ),
            const SizedBox(height: 30),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.download_done_outlined, color: Colors.white),
                label: const Text('Download Receipt & Close', style: TextStyle(color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _invoiceRow(String label, String value, {bool isDiscount = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 13, color: isDiscount ? Colors.red : Colors.grey[600])),
          Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: isDiscount ? Colors.red : Colors.grey[800])),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    int currentIdx = _getCurrentStep();
    final worker = widget.booking['workerId'];
    final isCompleted = widget.booking['status']?.toString().toLowerCase() == 'completed';

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Text('Track Booking', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Top Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                children: [
                  Container(
                    width: 60, height: 60,
                    decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(16)),
                    child: Center(child: Text(widget.booking['icon'] ?? '🛠️', style: const TextStyle(fontSize: 30))),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.booking['service'] ?? 'Service', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                        Text('Booking ID: ${widget.booking['_id']}', style: GoogleFonts.inter(fontSize: 12, color: Colors.white70)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 30),
            
            // Timeline
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _steps.length,
              itemBuilder: (ctx, i) {
                final isDone = i < currentIdx;
                final isCurrent = i == currentIdx;
                final isLast = i == _steps.length - 1;
                
                return IntrinsicHeight(
                  child: Row(
                    children: [
                      // Line & Dot
                      Column(
                        children: [
                          Container(
                            width: 24, height: 24,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDone || isCurrent ? AppColors.primary : Colors.transparent,
                              border: Border.all(color: isDone || isCurrent ? AppColors.primary : AppColors.border, width: 2),
                            ),
                            child: isDone ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                          ),
                          if (!isLast)
                            Expanded(child: Container(width: 2, color: isDone ? AppColors.primary : AppColors.border)),
                        ],
                      ),
                      const SizedBox(width: 20),
                      // Content
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 30),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_steps[i]['label'], style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDone || isCurrent ? AppColors.text : AppColors.textSub)),
                              Text(_steps[i]['desc'], style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
                              
                              // Show Live Map only on the 'On The Way' step if it's active or passed
                              if ((isDone || isCurrent) && _steps[i]['status'] == 'on_the_way') ...[
                                const SizedBox(height: 16),
                                LiveMapWidget(booking: widget.booking),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),

            if (isCompleted) ...[
              const Divider(height: 40),
              // Invoice Download Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.receipt_long),
                  label: const Text('View & Download Tax Invoice', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: _fetchAndShowInvoice,
                ),
              ),
              const SizedBox(height: 20),

              // Rating Form
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Rate Worker Experience ⭐', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.text)),
                    const SizedBox(height: 10),
                    if (_isAlreadyRated)
                      Text('✅ You already rated this service. Thank you!', style: GoogleFonts.inter(color: AppColors.success, fontSize: 13, fontWeight: FontWeight.bold))
                    else ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(5, (index) {
                          final starVal = index + 1;
                          return IconButton(
                            icon: Icon(
                              starVal <= _selectedStars ? Icons.star : Icons.star_border,
                              color: Colors.amber,
                              size: 36,
                            ),
                            onPressed: () => setState(() => _selectedStars = starVal),
                          );
                        }),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _commentCtrl,
                        maxLines: 2,
                        style: TextStyle(color: AppColors.text),
                        decoration: InputDecoration(
                          hintText: 'Share feedback (optional)',
                          hintStyle: TextStyle(color: AppColors.textSub),
                        ),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _submittingRating ? null : _submitRating,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: _submittingRating 
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text('Submit Rating', style: TextStyle(color: Colors.white)),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],

            if (worker != null && !isCompleted) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
                child: Row(
                  children: [
                    CircleAvatar(radius: 24, backgroundColor: AppColors.primary, child: Text(worker['name'][0].toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(worker['name'], style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.text)),
                        Text('Professional Technician', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
                      ]),
                    ),
                    IconButton(
                      icon: Icon(Icons.call, color: AppColors.success),
                      onPressed: () {}, // Launch caller
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
