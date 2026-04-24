import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../utils/constants.dart';

final _notifications = [
  {'icon': '🎉', 'title': 'Booking Confirmed!', 'body': 'Your Plumbing Repair is confirmed. Worker assigned.', 'time': '2 min ago', 'color': AppColors.success, 'unread': true},
  {'icon': '💰', 'title': 'Payment Received', 'body': '₹499 payment successful for Plumbing service.', 'time': '1 hour ago', 'color': AppColors.primary, 'unread': true},
  {'icon': '🎁', 'title': 'Special Offer!', 'body': 'Get 25% off on your next booking. Use code SUMMER25', 'time': '3 hours ago', 'color': AppColors.accent, 'unread': false},
  {'icon': '⭐', 'title': 'Rate Your Service', 'body': 'How was your cleaning service? Share your experience!', 'time': 'Yesterday', 'color': AppColors.accent, 'unread': false},
  {'icon': '👷', 'title': 'Worker Arrived', 'body': 'Your worker Varun has arrived at your location.', 'time': '2 days ago', 'color': AppColors.secondary, 'unread': false},
  {'icon': '🔔', 'title': 'New Service Available', 'body': 'CCTV Installation now available in your area!', 'time': '3 days ago', 'color': AppColors.primary, 'unread': false},
];

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late List<Map<String, dynamic>> _notifs;

  @override
  void initState() {
    super.initState();
    _notifs = _notifications.map((n) => Map<String, dynamic>.from(n)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifs.where((n) => n['unread'] == true).length;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Notifications 🔔', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.text)),
              if (unreadCount > 0) GestureDetector(
                onTap: () => setState(() { for (final n in _notifs) n['unread'] = false; }),
                child: Text('Mark all read', style: GoogleFonts.inter(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
        if (unreadCount > 0) Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: Align(alignment: Alignment.centerLeft,
            child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
              child: Text('$unreadCount unread', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)))),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
            itemCount: _notifs.length,
            itemBuilder: (_, i) {
              final n = _notifs[i];
              final color = n['color'] as Color;
              return GestureDetector(
                onTap: () => setState(() => n['unread'] = false),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: (n['unread'] == true) ? color.withOpacity(0.06) : AppColors.card,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: (n['unread'] == true) ? color.withOpacity(0.25) : AppColors.border),
                  ),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(width: 48, height: 48, decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(14)),
                      child: Center(child: Text(n['icon'] as String, style: const TextStyle(fontSize: 24)))),
                    const SizedBox(width: 14),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(n['title'] as String, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.text))),
                        if (n['unread'] == true) Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                      ]),
                      const SizedBox(height: 4),
                      Text(n['body'] as String, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub, height: 1.4)),
                      const SizedBox(height: 6),
                      Text(n['time'] as String, style: GoogleFonts.inter(fontSize: 10, color: AppColors.textDim)),
                    ])),
                  ]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
