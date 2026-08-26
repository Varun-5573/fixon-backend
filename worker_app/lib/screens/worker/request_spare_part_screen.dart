import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class RequestSparePartScreen extends StatefulWidget {
  final String? bookingId;
  const RequestSparePartScreen({super.key, this.bookingId});

  @override
  State<RequestSparePartScreen> createState() => _RequestSparePartScreenState();
}

class _RequestSparePartScreenState extends State<RequestSparePartScreen> {
  final TextEditingController _partNameCtrl = TextEditingController();
  final TextEditingController _bookingIdCtrl = TextEditingController();
  final TextEditingController _reasonCtrl = TextEditingController();
  int _quantity = 1;
  String _category = 'AC Parts';
  bool _isSubmitting = false;

  final List<String> _categories = [
    'AC Parts',
    'Washing Machine Parts',
    'Refrigerator Parts',
    'RO Water Purifier Parts',
    'Microwave & Oven Parts',
    'TV & Electronics Parts',
    'Geyser & Water Heater Parts',
    'Plumbing & Pipes',
    'Electrical & Switches',
    'General Tools & Accessories'
  ];

  @override
  void initState() {
    super.initState();
    if (widget.bookingId != null) {
      _bookingIdCtrl.text = widget.bookingId!;
    }
  }

  @override
  void dispose() {
    _partNameCtrl.dispose();
    _bookingIdCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  void _submitRequest() async {
    if (_partNameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter the part name')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final workerId = auth.user?['_id'] ?? auth.user?['workerId'] ?? 'WRK_101';
      final workerName = auth.user?['name'] ?? 'Technician';

      final body = json.encode({
        'workerId': workerId,
        'workerName': workerName,
        'bookingId': _bookingIdCtrl.text.trim().isNotEmpty ? _bookingIdCtrl.text.trim() : 'N/A',
        'partName': _partNameCtrl.text.trim(),
        'category': _category,
        'quantity': _quantity,
        'reason': _reasonCtrl.text.trim().isNotEmpty ? _reasonCtrl.text.trim() : 'Part replacement required during service job',
      });

      final baseUrl = await resolveBaseUrl();
      final res = await http.post(
        Uri.parse('$baseUrl/api/worker/spare-part-request'),
        headers: {'Content-Type': 'application/json'},
        body: body,
      );

      final data = json.decode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('✅', style: TextStyle(fontSize: 40)),
                const SizedBox(height: 10),
                Text('Request Submitted!', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 6),
                Text('Admin has been notified. Stock will be dispatched to your location.', textAlign: TextAlign.center, style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  child: const Text('OK', style: TextStyle(color: Colors.white)),
                )
              ],
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to submit request')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Text('Request Spare Part', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('🔧 Request Required Component', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
            const SizedBox(height: 4),
            Text('Request parts directly from inventory for active customer repair jobs.', style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
            const SizedBox(height: 20),

            // Booking ID (Optional)
            Text('Booking ID / Job Reference', style: GoogleFonts.inter(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _bookingIdCtrl,
              style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'e.g. BK_178229',
                hintStyle: GoogleFonts.inter(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
              ),
            ),

            const SizedBox(height: 16),

            // Part Name
            Text('Spare Part Name *', style: GoogleFonts.inter(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _partNameCtrl,
              style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'e.g. LG AC 35uF Running Capacitor',
                hintStyle: GoogleFonts.inter(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
              ),
            ),

            const SizedBox(height: 16),

            // Category Dropdown
            Text('Category', style: GoogleFonts.inter(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _category,
                  isExpanded: true,
                  dropdownColor: const Color(0xFF1E293B),
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
                  items: _categories.map((c) {
                    return DropdownMenuItem(value: c, child: Text(c));
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _category = val);
                  },
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Quantity Counter
            Text('Quantity Required', style: GoogleFonts.inter(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            Row(
              children: [
                IconButton(
                  onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                  icon: const Icon(Icons.remove_circle_outline, color: Colors.white70, size: 28),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(10)),
                  child: Text('$_quantity', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                ),
                IconButton(
                  onPressed: () => setState(() => _quantity++),
                  icon: const Icon(Icons.add_circle_outline, color: Colors.white70, size: 28),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Reason / Notes
            Text('Reason / Notes for Admin', style: GoogleFonts.inter(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _reasonCtrl,
              maxLines: 3,
              style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'e.g. Existing capacitor blown out causing AC fan motor trip.',
                hintStyle: GoogleFonts.inter(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
              ),
            ),

            const SizedBox(height: 30),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitRequest,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isSubmitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text('Submit Part Request 🚀', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
