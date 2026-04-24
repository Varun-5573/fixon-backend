import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import '../../providers/location_provider.dart';
import '../../utils/constants.dart';
import '../home/home_screen.dart';

class BookingConfirmScreen extends StatefulWidget {
  final Map<String, dynamic> service;
  final Map<String, dynamic> subService;
  final String address;
  final DateTime scheduledTime;
  const BookingConfirmScreen({super.key, required this.service, required this.subService, required this.address, required this.scheduledTime});
  @override
  State<BookingConfirmScreen> createState() => _BookingConfirmScreenState();
}

class _BookingConfirmScreenState extends State<BookingConfirmScreen> {
  bool _confirming = false;
  bool _done = false;
  String _coupon = '';
  final _couponCtrl = TextEditingController();
  int _discount = 0;

  final _coupons = {'FIRST50': 50, 'FIXON10': 10, 'SUMMER25': 25};

  int get _total => (widget.subService['price'] as int) - _discount;

  void _applyCoupon() {
    final code = _couponCtrl.text.trim().toUpperCase();
    if (_coupons.containsKey(code)) {
      final pct = _coupons[code]!;
      setState(() {
        _coupon = code;
        _discount = ((widget.subService['price'] as int) * pct / 100).round();
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('🎉 Coupon applied! $pct% off'),
        backgroundColor: AppColors.success,
      ));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invalid coupon code'), backgroundColor: AppColors.error));
    }
  }

  Future<void> _confirm() async {
    setState(() => _confirming = true);
    final auth = context.read<AuthProvider>();
    final loc = context.read<LocationProvider>();
    final bookings = context.read<BookingProvider>();
    
    final ok = await bookings.createBooking({
      'userId': auth.user?['_id'] ?? 'guest',
      'name': auth.user?['name'] ?? 'Customer',
      'service': widget.service['name'],
      'price': _total,
      'scheduledTime': widget.scheduledTime.toIso8601String(),
      'address': widget.address,
      'lat': loc.lat,
      'lng': loc.lng,
      'location': { 'address': widget.address, 'lat': loc.lat, 'lng': loc.lng }, // frontend compat
      'category': widget.service['name'],
      'coupon': _coupon.isEmpty ? null : _coupon,
    }, auth.token ?? '');

    if (ok && mounted) setState(() { _confirming = false; _done = true; });
    else if (mounted) setState(() => _confirming = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return _buildSuccess();
    final color = Color(widget.service['color'] as int);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(children: [
                  GestureDetector(onTap: () => Navigator.pop(context),
                    child: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                      child: const Icon(Icons.arrow_back_ios, color: AppColors.text, size: 18))),
                  const SizedBox(width: 14),
                  Text('Confirm Booking', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
                ]),
              ),

              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Service Card
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: color.withOpacity(0.25)),
                      ),
                      child: Row(children: [
                        Container(width: 56, height: 56, decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(14)),
                          child: Center(child: Text(widget.service['icon'] as String, style: const TextStyle(fontSize: 28)))),
                        const SizedBox(width: 14),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(widget.subService['name'] as String, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                          const SizedBox(height: 4),
                          Text('⏱ ${widget.subService['time']}', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
                        ])),
                        Text('₹${widget.subService['price']}', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
                      ]),
                    ),

                    const SizedBox(height: 18),

                    // Details
                    _DetailCard(items: [
                      _DetailItem(icon: Icons.location_on, label: 'Address', value: widget.address),
                      _DetailItem(icon: Icons.calendar_today, label: 'Date & Time',
                        value: '${widget.scheduledTime.day}/${widget.scheduledTime.month}/${widget.scheduledTime.year} at ${widget.scheduledTime.hour.toString().padLeft(2,'0')}:${widget.scheduledTime.minute.toString().padLeft(2,'0')}'),
                      _DetailItem(icon: Icons.payments_outlined, label: 'Payment', value: 'Pay on Service'),
                    ]),

                    const SizedBox(height: 18),

                    // Coupon
                    Text('🎟️ Apply Coupon', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: TextField(
                          controller: _couponCtrl,
                          style: const TextStyle(color: AppColors.text, fontFamily: 'monospace', letterSpacing: 2),
                          decoration: const InputDecoration(hintText: 'FIRST50, FIXON10...', prefixIcon: Icon(Icons.local_offer_outlined, color: AppColors.primary)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton(onPressed: _applyCoupon,
                        style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14)),
                        child: Text('Apply', style: GoogleFonts.outfit(fontWeight: FontWeight.w700))),
                    ]),

                    const SizedBox(height: 18),

                    // Price Summary
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
                      child: Column(children: [
                        _PriceRow('Service Charge', '₹${widget.subService['price']}'),
                        if (_discount > 0) _PriceRow('Discount (${ _coupon})', '-₹$_discount', color: AppColors.success),
                        const Divider(color: AppColors.border, height: 24),
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          Text('Total', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                          Text('₹$_total', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.success)),
                        ]),
                      ]),
                    ),
                    const SizedBox(height: 30),
                  ]),
                ),
              ),

              // Confirm Button
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _confirming ? null : _confirm,
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: AppColors.success,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    child: _confirming
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('✅ Confirm Booking · ₹$_total', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuccess() {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 600),
                  curve: Curves.elasticOut,
                  builder: (_, v, __) => Transform.scale(scale: v,
                    child: Container(width: 100, height: 100, decoration: BoxDecoration(color: AppColors.success.withOpacity(0.15), shape: BoxShape.circle),
                      child: const Icon(Icons.check_circle, color: AppColors.success, size: 60))),
                ),
                const SizedBox(height: 28),
                Text('Booking Confirmed! 🎉', style: GoogleFonts.outfit(fontSize: 26, fontWeight: FontWeight.w900, color: AppColors.text), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                Text('Your ${widget.service['name']} booking is confirmed.\nA worker will be assigned shortly!',
                  style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSub, height: 1.6), textAlign: TextAlign.center),
                const SizedBox(height: 32),
                Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
                  child: Column(children: [
                    _PriceRow('Service', widget.service['name'] as String),
                    _PriceRow('Amount Paid', '₹$_total'),
                    _PriceRow('Status', '🟡 Worker Being Assigned'),
                  ])),
                const SizedBox(height: 30),
                SizedBox(width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (r) => false),
                    icon: const Icon(Icons.home),
                    label: Text('Back to Home', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700)),
                  )),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  final List<_DetailItem> items;
  const _DetailCard({required this.items});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
    child: Column(children: items.map((item) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: Icon(item.icon, color: AppColors.primary, size: 18)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(item.label, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
          Text(item.value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
        ])),
      ]),
    )).toList()),
  );
}

class _DetailItem { final IconData icon; final String label, value; const _DetailItem({required this.icon, required this.label, required this.value}); }

class _PriceRow extends StatelessWidget {
  final String label, value;
  final Color? color;
  const _PriceRow(this.label, this.value, {this.color});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
      Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: color ?? AppColors.text)),
    ]),
  );
}
