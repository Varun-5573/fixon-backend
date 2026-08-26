import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/spare_parts_provider.dart';
import '../../utils/constants.dart';
import 'cart_screen.dart';

class SparePartDetailScreen extends StatelessWidget {
  final Map<String, dynamic> part;

  const SparePartDetailScreen({super.key, required this.part});

  @override
  Widget build(BuildContext context) {
    final String name = part['name'] ?? 'Spare Part';
    final String category = part['category'] ?? '';
    final String brand = part['brand'] ?? 'Generic';
    final String partNumber = part['partNumber'] ?? 'N/A';
    final String quality = part['quality'] ?? 'Original';
    final num price = part['price'] ?? 0;
    final num? discountPrice = part['discountPrice'];
    final int stock = (part['stock'] as num?)?.toInt() ?? 0;
    final String description = part['description'] ?? 'High quality genuine spare part for appliances.';
    final String warranty = part['warranty'] ?? 'Standard Manufacturer Warranty';
    final String photo = part['photo'] ?? '';
    final List<dynamic> compatibleModels = part['compatibleModels'] ?? [];
    final bool isOutOfStock = stock == 0;

    final double effectivePrice = (discountPrice != null && discountPrice < price)
        ? discountPrice.toDouble()
        : price.toDouble();

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Text(
          'Part Details',
          style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image Header
            Container(
              width: double.infinity,
              height: 250,
              color: const Color(0xFF0F172A),
              child: Stack(
                children: [
                  Center(
                    child: Image.network(
                      photo.isNotEmpty ? photo : 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: double.infinity,
                      errorBuilder: (_, __, ___) => const Icon(Icons.build_rounded, size: 80, color: Colors.white38),
                    ),
                  ),

                  // Quality Tag
                  Positioned(
                    top: 16,
                    left: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: quality == 'Original' ? const Color(0xFF059669) : const Color(0xFF2563EB),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '✨ $quality Genuine',
                        style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title & Category
                  Text(
                    name,
                    style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 22),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFF334155)),
                        ),
                        child: Text(
                          category,
                          style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Brand: $brand | Part #: $partNumber',
                        style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Price & Stock Banner
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('PART PRICE', style: GoogleFonts.inter(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Text(
                                  '₹${effectivePrice.toStringAsFixed(0)}',
                                  style: GoogleFonts.outfit(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 26),
                                ),
                                if (discountPrice != null && discountPrice < price) ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    '₹${price.toStringAsFixed(0)}',
                                    style: GoogleFonts.outfit(color: Colors.white38, fontSize: 16, decoration: TextDecoration.lineThrough),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),

                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: isOutOfStock ? const Color(0xFF7F1D1D) : const Color(0xFF065F46),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            isOutOfStock ? '❌ Out of Stock' : '✅ In Stock ($stock units)',
                            style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Warranty & Description
                  Text('Overview & Description', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  Text(description, style: GoogleFonts.inter(color: Colors.white70, fontSize: 14, height: 1.4)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.verified_user_rounded, color: AppColors.primary, size: 18),
                      const SizedBox(width: 8),
                      Text('Warranty: $warranty', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Compatible Models Section
                  Text('Fits & Compatible Appliance Models', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 10),
                  if (compatibleModels.isEmpty)
                    Text('Compatible with standard models in this category.', style: GoogleFonts.inter(color: Colors.white54, fontSize: 13))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: compatibleModels.map((model) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFF334155)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 14),
                              const SizedBox(width: 6),
                              Text(model.toString(), style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
                            ],
                          ),
                        );
                      }).toList(),
                    ),

                  const SizedBox(height: 30),

                  // Combo Callout Banner: "Need Expert Installation?"
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text('🛠️', style: TextStyle(fontSize: 22)),
                            const SizedBox(width: 8),
                            Text(
                              'Buy Part + Book FixoN Technician',
                              style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Select "Combo Workflow" at checkout to have a certified technician deliver and install this part at your home for just ₹299!',
                          style: GoogleFonts.inter(color: Colors.white70, fontSize: 12, height: 1.3),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 100), // Bottom padding for fixed buttons
                ],
              ),
            ),
          ],
        ),
      ),

      // Fixed Bottom Action Bar
      bottomSheet: Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: Color(0xFF1E293B),
          border: Border(top: BorderSide(color: Color(0xFF334155))),
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: isOutOfStock
                    ? null
                    : () {
                        Provider.of<SparePartsProvider>(context, listen: false).addToCart(part);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Added "$name" to cart!'),
                            backgroundColor: const Color(0xFF10B981),
                          ),
                        );
                      },
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: AppColors.primary, width: 2),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Add to Cart 🛒', style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: isOutOfStock
                    ? null
                    : () {
                        final provider = Provider.of<SparePartsProvider>(context, listen: false);
                        provider.addToCart(part);
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen()));
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: isOutOfStock ? const Color(0xFF334155) : const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Buy Now ⚡', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
