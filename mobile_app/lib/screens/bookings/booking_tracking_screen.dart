import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
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

  @override
  Widget build(BuildContext context) {
    int currentIdx = _getCurrentStep();
    final worker = widget.booking['workerId'];

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

            if (worker != null) ...[
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
