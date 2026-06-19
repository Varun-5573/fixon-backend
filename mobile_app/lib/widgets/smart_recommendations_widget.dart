import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/booking_provider.dart';
import '../utils/constants.dart';

/// Smart AI-powered service recommendations based on
/// booking history, season, and time of day
class SmartRecommendationsWidget extends StatelessWidget {
  final Function(String serviceName) onServiceTap;

  const SmartRecommendationsWidget({
    super.key,
    required this.onServiceTap,
  });

  List<Map<String, dynamic>> _getRecommendations(
      List<dynamic> bookings) {
    final month = DateTime.now().month;
    final hour = DateTime.now().hour;

    // Analyze booking history
    final bookedCategories = bookings
        .map((b) => (b['category'] ?? b['service'] ?? '').toString())
        .toList();

    final categoryCount = <String, int>{};
    for (final c in bookedCategories) {
      categoryCount[c] = (categoryCount[c] ?? 0) + 1;
    }

    final recs = <Map<String, dynamic>>[];

    // History-based upsells
    if (categoryCount['AC Repair'] != null) {
      recs.add({
        'name': 'AC Deep Clean',
        'icon': '❄️',
        'color': 0xFF06B6D4,
        'price': 799,
        'tag': '🔁 Based on past booking',
        'reason': 'You had AC serviced before — time for a deep clean!',
        'category': 'AC Repair',
      });
    }
    if (categoryCount['Cleaning'] != null) {
      recs.add({
        'name': 'Sofa & Carpet Cleaning',
        'icon': '🛋️',
        'color': 0xFF10B981,
        'price': 1499,
        'tag': '🔁 Upsell',
        'reason': 'Customers who book cleaning also love sofa cleaning.',
        'category': 'Cleaning',
      });
    }
    if (categoryCount['Plumbing'] != null) {
      recs.add({
        'name': 'Full Bathroom Waterproofing',
        'icon': '🚿',
        'color': 0xFF7C3AED,
        'price': 2499,
        'tag': '🔁 Follow-up service',
        'reason': 'Prevent future leaks with full bathroom waterproofing.',
        'category': 'Plumbing',
      });
    }

    // Seasonal recommendations
    if (month >= 3 && month <= 6) {
      // Summer
      if (!recs.any((r) => r['category'] == 'AC Repair')) {
        recs.insert(0, {
          'name': 'AC Service & Gas Refill',
          'icon': '❄️',
          'color': 0xFF06B6D4,
          'price': 799,
          'tag': '☀️ Summer Special',
          'reason': 'Summer is here! Get your AC serviced before it fails.',
          'category': 'AC Repair',
        });
      }
      recs.add({
        'name': 'Ceiling Fan Installation',
        'icon': '🌀',
        'color': 0xFFF59E0B,
        'price': 399,
        'tag': '☀️ Summer Special',
        'reason': 'Beat the heat with a new fan installation.',
        'category': 'Electrical',
      });
    } else if (month >= 7 && month <= 9) {
      // Monsoon
      recs.insert(0, {
        'name': 'Waterproofing & Pest Control',
        'icon': '🌧️',
        'color': 0xFF8B5CF6,
        'price': 999,
        'tag': '🌧️ Monsoon Ready',
        'reason': 'Protect your home from monsoon leaks and insects.',
        'category': 'Pest Control',
      });
    } else if (month >= 10 && month <= 11) {
      // Festival season
      recs.insert(0, {
        'name': 'Festival Deep Cleaning',
        'icon': '🪔',
        'color': 0xFFF59E0B,
        'price': 1299,
        'tag': '🪔 Festival Season',
        'reason': 'Get your home sparkling clean for the festival season!',
        'category': 'Cleaning',
      });
    }

    // Time-of-day based
    if (hour >= 20 || hour < 7) {
      // Night / early morning
      recs.insert(0, {
        'name': '⚡ Emergency Electrical Fix',
        'icon': '⚡',
        'color': 0xFFEF4444,
        'price': 599,
        'tag': '🌙 Available Now',
        'reason': 'Electrical issue at night? Our workers are available 24/7.',
        'category': 'Electrical',
      });
    }

    // Always include popular
    if (recs.length < 3) {
      recs.addAll([
        {
          'name': 'Home Deep Cleaning',
          'icon': '🧹',
          'color': 0xFF10B981,
          'price': 1299,
          'tag': '🔥 Most Popular',
          'reason': 'Trending in your area this week.',
          'category': 'Cleaning',
        },
        {
          'name': 'Electrical Safety Check',
          'icon': '⚡',
          'color': 0xFFF59E0B,
          'price': 599,
          'tag': '⭐ Top Rated',
          'reason': 'Our most-rated service with 4.9 stars.',
          'category': 'Electrical',
        },
      ]);
    }

    // Deduplicate by name and limit to 5
    final seen = <String>{};
    final unique = <Map<String, dynamic>>[];
    for (final r in recs) {
      if (!seen.contains(r['name'])) {
        seen.add(r['name'] as String);
        unique.add(r);
        if (unique.length >= 5) break;
      }
    }

    return unique;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BookingProvider>(
      builder: (context, bp, _) {
        final recs = _getRecommendations(bp.bookings);
        if (recs.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('💡',
                      style: TextStyle(fontSize: 14)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Recommended for You',
                          style: GoogleFonts.outfit(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppColors.text)),
                      Text('AI-powered personalised picks',
                          style: GoogleFonts.inter(
                              fontSize: 11, color: AppColors.textSub)),
                    ],
                  ),
                ),
              ]),
            ),
            SizedBox(
              height: 185,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: recs.length,
                itemBuilder: (_, i) {
                  final rec = recs[i];
                  final color = Color(rec['color'] as int);
                  return GestureDetector(
                    onTap: () => onServiceTap(rec['category'] as String),
                    child: Container(
                      width: 185,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                            color: color.withOpacity(0.25)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.12),
                                    borderRadius:
                                        BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                      rec['icon'] as String,
                                      style: const TextStyle(
                                          fontSize: 24)),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.12),
                                    borderRadius:
                                        BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '₹${rec['price']}',
                                    style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: color),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              rec['name'] as String,
                              style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.text),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              rec['reason'] as String,
                              style: GoogleFonts.inter(
                                  fontSize: 10,
                                  color: AppColors.textSub,
                                  height: 1.4),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.08),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                    color: color.withOpacity(0.2)),
                              ),
                              child: Text(
                                rec['tag'] as String,
                                style: GoogleFonts.inter(
                                    fontSize: 10,
                                    color: color,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
