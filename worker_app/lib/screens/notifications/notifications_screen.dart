import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../utils/constants.dart';
import '../../providers/booking_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<BookingProvider>(context, listen: false).fetchNotifications();
    });
  }

  Color _resolveColor(String? type) {
    switch (type) {
      case 'booking':
        return AppColors.success;
      case 'payment':
        return AppColors.primary;
      case 'promo':
        return AppColors.accent;
      case 'worker':
        return AppColors.secondary;
      default:
        return AppColors.primary;
    }
  }

  String _formatTime(dynamic createdAt, dynamic fallbackTime) {
    if (createdAt == null) return fallbackTime?.toString() ?? 'Just now';
    try {
      final dt = DateTime.parse(createdAt.toString());
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
      if (diff.inHours < 24) return '${diff.inHours} hr ago';
      return '${diff.inDays} days ago';
    } catch (_) {
      return fallbackTime?.toString() ?? 'Just now';
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookingProvider = Provider.of<BookingProvider>(context);
    final notifs = bookingProvider.notifications;
    final unreadCount = notifs.where((n) => n['unread'] == true).length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Notifications 🔔', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.text)),
              if (unreadCount > 0) GestureDetector(
                onTap: () => bookingProvider.markAllNotificationsRead(),
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
          child: notifs.isEmpty
              ? Center(
                  child: Text(
                    'No notifications yet 📭',
                    style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSub),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                  itemCount: notifs.length,
                  itemBuilder: (_, i) {
                    final n = notifs[i];
                    final color = _resolveColor(n['type']?.toString());
                    final notifId = n['_id']?.toString() ?? '';

                    return GestureDetector(
                      onTap: () {
                        if (notifId.isNotEmpty) {
                          bookingProvider.markNotificationRead(notifId);
                        }
                      },
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
                            child: Center(child: Text(n['icon']?.toString() ?? '🔔', style: const TextStyle(fontSize: 24)))),
                          const SizedBox(width: 14),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(child: Text(n['title']?.toString() ?? '', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.text))),
                              if (n['unread'] == true) Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                            ]),
                            const SizedBox(height: 4),
                            Text(n['body']?.toString() ?? '', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub, height: 1.4)),
                            const SizedBox(height: 6),
                            Text(_formatTime(n['createdAt'], n['time']), style: GoogleFonts.inter(fontSize: 10, color: AppColors.textDim)),
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
