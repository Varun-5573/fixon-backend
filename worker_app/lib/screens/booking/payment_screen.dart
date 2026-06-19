import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../utils/constants.dart';

class PaymentScreen extends StatefulWidget {
  final int amount;

  const PaymentScreen({super.key, required this.amount});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool _verifying = false;

  void _verifyPayment() async {
    setState(() => _verifying = true);
    await Future.delayed(const Duration(seconds: 3));
    if (mounted) {
      Navigator.pop(context, true); // payment success
    }
  }

  void _launchUPIApp(String upiString) async {
    final uri = Uri.parse(upiString);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      _verifyPayment();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No UPI app found on this device. Please scan the QR with another phone.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Standard UPI string format
    final upiString = 'upi://pay?pa=9000853346@axl&pn=FixoN&am=${widget.amount}&cu=INR';

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D), // dark phonepe like bg
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 20),
            
            // FixoN Logo or Bank Logo
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.account_balance, color: Colors.blue, size: 30),
            ),
            const SizedBox(height: 16),
            Text('FixoN Services', style: GoogleFonts.inter(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('Scan to Pay ₹${widget.amount}', style: GoogleFonts.inter(color: Colors.white70, fontSize: 14)),
            
            const SizedBox(height: 50),
            
            // Amount Display
            Text('Payment Amount', style: GoogleFonts.inter(color: Colors.white54, fontSize: 16)),
            const SizedBox(height: 12),
            Text('₹${widget.amount}', style: GoogleFonts.outfit(color: Colors.white, fontSize: 48, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Ref: FX-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}', style: GoogleFonts.inter(color: Colors.white30, fontSize: 12)),
            
            const SizedBox(height: 60),

            // Direct payment via App Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _verifying ? null : () => _launchUPIApp(upiString),
                  icon: _verifying 
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.security, color: Colors.white),
                  label: Text(_verifying ? 'Verifying...' : 'Pay using UPI App', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blueAccent,
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
            ),
            
            const Spacer(),
            
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Text(
                'Supported on PhonePe, GPay, Paytm, BHIM',
                style: GoogleFonts.inter(color: Colors.white30, fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}


