import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../../utils/constants.dart';
import '../../widgets/live_map_widget.dart';
import '../chat/worker_chat_screen.dart';

class BookingTrackingScreen extends StatefulWidget {
  final Map<String, dynamic> booking;
  const BookingTrackingScreen({super.key, required this.booking});

  @override
  State<BookingTrackingScreen> createState() => _BookingTrackingScreenState();
}

class _BookingTrackingScreenState extends State<BookingTrackingScreen> {
  late Map<String, dynamic> _booking;
  Timer? _refreshTimer;

  final List<Map<String, dynamic>> _steps = [
    {'status': 'pending', 'label': 'Booking Placed', 'desc': 'Matching the best professional for you'},
    {'status': 'accepted', 'label': 'Confirmed', 'desc': 'Work has been assigned & confirmed'},
    {'status': 'on_the_way', 'label': 'On The Way', 'desc': 'Professional is heading to your location'},
    {'status': 'arrived', 'label': 'Arrived', 'desc': 'Professional has arrived at your address'},
    {'status': 'started', 'label': 'Job Started', 'desc': 'Quality work is in progress'},
    {'status': 'completed', 'label': 'Completed', 'desc': 'Job finished! Hope you liked FixoN'},
  ];

  int _selectedStars = 0;
  final _commentCtrl = TextEditingController();
  bool _isAlreadyRated = false;
  bool _submittingRating = false;

  @override
  void initState() {
    super.initState();
    _booking = Map<String, dynamic>.from(widget.booking);
    _isAlreadyRated = _booking['rated'] == true;

    _refreshBooking();
    _refreshTimer = Timer.periodic(const Duration(seconds: 4), (_) => _refreshBooking());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _refreshBooking() async {
    try {
      final bId = _booking['_id'];
      final res = await http.get(Uri.parse('$kBaseUrl/api/bookings/$bId/photos'), headers: kHeaders).timeout(const Duration(seconds: 3));
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['photos'] != null) {
        if (mounted) {
          setState(() {
            _booking = { ..._booking, ...data['photos'] };
          });
        }
      }
    } catch (_) {}
  }

  int _getCurrentStep() {
    final status = _booking['status']?.toString().toLowerCase() ?? 'pending';
    if (status == 'cancelled') return -1;
    
    // Status normalization
    final mappedStatus = (status == 'ongoing' || status == 'in_progress') ? 'started' : status;
    
    for (int i = 0; i < _steps.length; i++) {
      if (_steps[i]['status'] == mappedStatus) return i;
    }
    return 0;
  }

  Future<void> _submitRating() async {
    if (_selectedStars == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('⭐ Please select at least 1 star'), backgroundColor: Colors.orange),
      );
      return;
    }
    final worker = widget.booking['workerId'];
    if (worker == null) return;
    setState(() => _submittingRating = true);
    try {
      final res = await http.post(
        Uri.parse('$kBaseUrl/api/ratings'),
        headers: kHeaders,
        body: jsonEncode({
          'bookingId': widget.booking['_id'],
          'workerId': worker['_id'],
          'rating': _selectedStars,
          'comment': _commentCtrl.text.trim(),
        }),
      ).timeout(const Duration(seconds: 45));

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
      ).timeout(const Duration(seconds: 45));
      
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
    final worker = _booking['workerId'];
    final isCompleted = _booking['status']?.toString().toLowerCase() == 'completed';

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
            // ── Photo Proof Section (Problem, Before, After) ─────
            if (_booking['customerProblemPhoto'] != null ||
                _booking['problemPhoto'] != null ||
                _booking['workerBeforePhoto'] != null ||
                _booking['beforePhoto'] != null ||
                _booking['workerAfterPhoto'] != null ||
                _booking['afterPhoto'] != null) ...[
              const Divider(height: 30),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '📷 Service Photo Proofs',
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.text),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        if (_booking['customerProblemPhoto'] != null || _booking['problemPhoto'] != null)
                          Expanded(
                            child: Column(
                              children: [
                                Text('Problem Photo', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSub)),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    _booking['customerProblemPhoto'] ?? _booking['problemPhoto'],
                                    height: 90, width: double.infinity, fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, size: 40, color: Colors.grey),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (_booking['workerBeforePhoto'] != null || _booking['beforePhoto'] != null) ...[
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              children: [
                                Text('Before Work', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSub)),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    _booking['workerBeforePhoto'] ?? _booking['beforePhoto'],
                                    height: 90, width: double.infinity, fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, size: 40, color: Colors.grey),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_booking['workerAfterPhoto'] != null || _booking['afterPhoto'] != null) ...[
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              children: [
                                Text('After Work', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSub)),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    _booking['workerAfterPhoto'] ?? _booking['afterPhoto'],
                                    height: 90, width: double.infinity, fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, size: 40, color: Colors.grey),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],

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
                      Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: List.generate(5, (index) {
                            final starVal = index + 1;
                            return SizedBox(
                              width: 52,
                              height: 52,
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(26),
                                  onTap: () {
                                    setState(() {
                                      _selectedStars = starVal;
                                    });
                                  },
                                  child: Center(
                                    child: Icon(
                                      starVal <= _selectedStars ? Icons.star_rounded : Icons.star_outline_rounded,
                                      color: starVal <= _selectedStars ? Colors.amber : AppColors.textSub,
                                      size: 40,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Center(
                        child: Text(
                          _selectedStars == 0 ? 'Tap a star to rate'
                            : _selectedStars == 1 ? '😞 Poor'
                            : _selectedStars == 2 ? '😕 Below Average'
                            : _selectedStars == 3 ? '😐 Average'
                            : _selectedStars == 4 ? '😊 Good'
                            : '🤩 Excellent!',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _selectedStars >= 4 ? AppColors.success : _selectedStars >= 2 ? AppColors.accent : AppColors.textSub,
                          ),
                        ),
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

            if (worker != null) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your Assigned Professional',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: AppColors.primaryGradient,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: Text(
                              worker['name'][0].toUpperCase(),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 20,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    worker['name'].toString().toUpperCase(),
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.text,
                                      fontSize: 15,
                                    ),
                                  ),
                                  if (worker['verification'] != null &&
                                      worker['verification']['status'] == 'approved') ...[
                                    const SizedBox(width: 6),
                                    const Icon(
                                      Icons.verified,
                                      color: Color(0xFF10B981),
                                      size: 16,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Aadhaar Verified',
                                      style: GoogleFonts.inter(
                                        color: const Color(0xFF10B981),
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(Icons.star_rounded, size: 14, color: Colors.amber),
                                  const SizedBox(width: 2),
                                  Text(
                                    '${worker['rating'] ?? '4.8'} Rating',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: AppColors.textSub,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text('•', style: TextStyle(color: AppColors.textSub)),
                                  const SizedBox(width: 8),
                                  Icon(Icons.work_history_outlined, size: 13, color: AppColors.textSub),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${worker['experience'] ?? '5 Years'} Experience',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: AppColors.textSub,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (!isCompleted) ...[
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final phone = worker['phone']?.toString() ?? '';
                                if (phone.isNotEmpty) {
                                  final uri = Uri.parse('tel:$phone');
                                  if (await canLaunchUrl(uri)) {
                                    await launchUrl(uri);
                                  }
                                }
                              },
                              icon: const Icon(Icons.phone, size: 16),
                              label: const Text('Call Professional'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.success,
                                side: BorderSide(color: AppColors.success.withOpacity(0.5)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => WorkerChatScreen(
                                      workerId: worker['_id'],
                                      workerName: worker['name'],
                                      workerCategory: worker['category'] ?? 'Technician',
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.chat_bubble_outline, size: 16, color: Colors.white),
                              label: const Text('Chat', style: TextStyle(color: Colors.white)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
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
