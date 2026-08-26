import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/spare_parts_provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import 'spare_part_orders_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final TextEditingController _addressController = TextEditingController(text: 'Flat 402, Sai Residency, Hitech City, Hyderabad');
  final TextEditingController _phoneController = TextEditingController();
  bool _comboWithTechnician = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.user != null) {
      if (auth.user!['phone'] != null) _phoneController.text = auth.user!['phone'].toString();
      if (auth.user!['address'] != null && auth.user!['address'].toString().isNotEmpty) {
        _addressController.text = auth.user!['address'].toString();
      }
    }
  }

  @override
  void dispose() {
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _handleCheckout() async {
    final provider = Provider.of<SparePartsProvider>(context, listen: false);
    final auth = Provider.of<AuthProvider>(context, listen: false);

    if (provider.cart.isEmpty) return;

    if (_addressController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid delivery address')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final String custId = auth.user?['_id'] ?? auth.user?['userId'] ?? 'CUST_${DateTime.now().millisecondsSinceEpoch}';
    final String custName = auth.user?['name'] ?? 'Valued Customer';
    final String custPhone = _phoneController.text.isNotEmpty ? _phoneController.text : (auth.user?['phone'] ?? '9876543210');

    final result = await provider.placeOrder(
      customerId: custId,
      customerName: custName,
      customerPhone: custPhone,
      deliveryAddress: {'address': _addressController.text.trim()},
      comboWithTechnician: _comboWithTechnician,
      installationFee: 299.0,
    );

    setState(() => _isSubmitting = false);

    if (result['success'] == true) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎉', style: TextStyle(fontSize: 50)),
              const SizedBox(height: 12),
              Text(
                'Order Placed Successfully!',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
              ),
              const SizedBox(height: 8),
              Text(
                'Order ${result['order']['orderId']}\nPayment: Cash / UPI on Delivery',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 12),
              if (_comboWithTechnician)
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '🛠️ FixoN Technician has been booked for doorstep installation!',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(color: Colors.white70, fontSize: 12),
                  ),
                ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const SparePartOrdersScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Track My Order 🚚', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to place order'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Text('My Shopping Cart', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: Consumer<SparePartsProvider>(
        builder: (context, provider, _) {
          if (provider.cart.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('🛒', style: TextStyle(fontSize: 60)),
                  const SizedBox(height: 16),
                  Text('Your Cart is Empty', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
                  const SizedBox(height: 8),
                  Text('Browse spare parts and add items to your cart', style: GoogleFonts.inter(color: Colors.white54, fontSize: 13)),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                    child: Text('Explore Spare Parts', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          }

          final double subtotal = provider.cartSubtotal;
          final double delivery = provider.cartDelivery;
          final double installationFee = _comboWithTechnician ? 299.0 : 0.0;
          final double grandTotal = subtotal + delivery + installationFee;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Cart Items List
                Text('Cart Items (${provider.cartCount})', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),

                ...provider.cart.map((item) {
                  final part = item.part;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            part['photo'] ?? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
                            width: 60,
                            height: 60,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(color: const Color(0xFF0F172A), width: 60, height: 60, child: const Icon(Icons.build, color: Colors.white38)),
                          ),
                        ),
                        const SizedBox(width: 12),

                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(part['name'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                              const SizedBox(height: 4),
                              Text('₹${item.price.toStringAsFixed(0)} each', style: GoogleFonts.inter(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13)),
                            ],
                          ),
                        ),

                        // Quantity Controls
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, color: Colors.white70, size: 22),
                              onPressed: () => provider.updateCartQty(part['_id'], item.quantity - 1),
                            ),
                            Text('${item.quantity}', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline, color: Colors.white70, size: 22),
                              onPressed: () => provider.updateCartQty(part['_id'], item.quantity + 1),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }).toList(),

                const SizedBox(height: 20),

                // Combo Card: Buy Part + Technician Installation
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _comboWithTechnician ? AppColors.primary : const Color(0xFF334155), width: _comboWithTechnician ? 2 : 1),
                  ),
                  child: Row(
                    children: [
                      Checkbox(
                        value: _comboWithTechnician,
                        activeColor: AppColors.primary,
                        onChanged: (val) {
                          setState(() => _comboWithTechnician = val ?? false);
                        },
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '🛠️ Add FixoN Technician Installation (+₹299)',
                              style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'A certified expert will visit your home to fit and test this spare part!',
                              style: GoogleFonts.inter(color: Colors.white70, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Delivery Details
                Text('Delivery Details', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 10),
                TextField(
                  controller: _addressController,
                  maxLines: 2,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Delivery Address',
                    labelStyle: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF1E293B),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Contact Phone Number',
                    labelStyle: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF1E293B),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
                  ),
                ),

                const SizedBox(height: 24),

                // Price Summary Breakdown
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Column(
                    children: [
                      _buildSummaryRow('Spare Parts Total', '₹${subtotal.toStringAsFixed(0)}'),
                      const SizedBox(height: 8),
                      _buildSummaryRow('Delivery Charge', '₹${delivery.toStringAsFixed(0)}'),
                      if (_comboWithTechnician) ...[
                        const SizedBox(height: 8),
                        _buildSummaryRow('Technician Installation Fee', '₹299'),
                      ],
                      const Divider(color: Color(0xFF334155), height: 20),
                      _buildSummaryRow('Grand Total (COD / UPI)', '₹${grandTotal.toStringAsFixed(0)}', isBold: true, color: const Color(0xFF10B981)),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Place Order Button
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _handleCheckout,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: _isSubmitting
                        ? const CircularProgressIndicator(color: Colors.white)
                        : Text(
                            'Place Order (₹${grandTotal.toStringAsFixed(0)}) 🚀',
                            style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                  ),
                ),

                const SizedBox(height: 40),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.inter(color: isBold ? Colors.white : Colors.white70, fontWeight: isBold ? FontWeight.bold : FontWeight.normal, fontSize: 13)),
        Text(value, style: GoogleFonts.outfit(color: color ?? (isBold ? Colors.white : Colors.white70), fontWeight: isBold ? FontWeight.bold : FontWeight.normal, fontSize: isBold ? 18 : 14)),
      ],
    );
  }
}
