import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../utils/constants.dart';
import 'booking_confirm_screen.dart';

class ServiceDetailScreen extends StatefulWidget {
  final Map<String, dynamic> service;
  const ServiceDetailScreen({super.key, required this.service});
  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  final List<Map<String, dynamic>> _subServices = [];
  String? _selected;
  DateTime _date = DateTime.now().add(const Duration(hours: 2));
  final _addrCtrl = TextEditingController();

  List<Map<String, dynamic>> _workers = [];
  Map<String, dynamic>? _selectedWorker;
  bool _loadingWorkers = true;

  @override
  void initState() {
    super.initState();
    int basePrice = int.tryParse(widget.service['price']?.toString() ?? '0') ?? 0;
    
    // Syllabus 17.4: Check for dynamic packages from Admin Panel
    final dynamicPkgs = widget.service['packages'];
    if (dynamicPkgs is List && dynamicPkgs.isNotEmpty) {
      for (var p in dynamicPkgs) {
        _subServices.add({
          'name': p['name']?.toString() ?? 'Package',
          'price': int.tryParse(p['price']?.toString() ?? '0') ?? basePrice,
          'time': 'Estimated 1-2 hrs',
          'popular': false,
        });
      }
    } else {
      // Fallback to defaults
      _subServices.addAll([
        {'name': 'Basic ${widget.service['name']}', 'price': basePrice, 'time': '1-2 hrs', 'popular': false},
        {'name': 'Standard ${widget.service['name']}', 'price': basePrice + 300, 'time': '2-3 hrs', 'popular': true},
        {'name': 'Premium ${widget.service['name']}', 'price': basePrice + 700, 'time': '3-4 hrs', 'popular': false},
      ]);
    }
    
    _selected = _subServices.isNotEmpty ? _subServices[0]['name'] as String : null;
    _fetchWorkers();
  }

  Future<void> _fetchWorkers() async {
    try {
      final res = await http.get(Uri.parse('$kBaseUrl/api/workers')).timeout(const Duration(seconds: 10));
      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        final allWorkers = List<Map<String, dynamic>>.from(data['workers']);
        final serviceName = widget.service['name']?.toString().toLowerCase() ?? '';

        // First try to match by skills/category
        var matched = allWorkers.where((w) {
          if (w['active'] == false || w['isActive'] == false) return false;
          final List skills = (w['skills'] ?? []).map((s) => s.toString().toLowerCase()).toList();
          final category = (w['category']?.toString() ?? '').toLowerCase();
          return skills.contains(serviceName) || category == serviceName;
        }).toList();

        // If no match found, show ALL active workers so user is never left with empty list
        if (matched.isEmpty) {
          matched = allWorkers.where((w) => w['active'] != false && w['isActive'] != false).toList();
        }

        setState(() {
          _workers = matched;
          _loadingWorkers = false;
        });
      } else {
        setState(() => _loadingWorkers = false);
      }
    } catch (e) {
      debugPrint('⚠️ fetchWorkers error: $e');
      setState(() => _loadingWorkers = false);
    }
  }

  Map<String, dynamic> get _selectedService =>
      _subServices.firstWhere((s) => s['name'] == _selected, orElse: () => _subServices[1]);

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (ctx, child) => Theme(data: ThemeData.dark().copyWith(colorScheme: ColorScheme.dark(primary: AppColors.primary)), child: child!),
    );
    if (d != null) {
      final t = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(_date),
        builder: (ctx, child) => Theme(data: ThemeData.dark().copyWith(colorScheme: ColorScheme.dark(primary: AppColors.primary)), child: child!),
      );
      if (t != null) setState(() => _date = DateTime(d.year, d.month, d.day, t.hour, t.minute));
    }
  }

  void _book() {
    if (_addrCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Please enter your address'), backgroundColor: AppColors.error));
      return;
    }
    Navigator.push(context, MaterialPageRoute(builder: (_) => BookingConfirmScreen(
      service: widget.service,
      subService: _selectedService,
      address: _addrCtrl.text,
      scheduledTime: _date,
      worker: _selectedWorker,
    )));
  }

  @override
  Widget build(BuildContext context) {
    Color color = AppColors.primary;
    if (widget.service['color'] is int) color = Color(widget.service['color'] as int);
    else if (widget.service['color'] is String) {
      String hex = widget.service['color'].toString().replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      color = Color(int.tryParse(hex, radix: 16) ?? 0xFF7C3AED);
    }
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              _header(color),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _sectionTitle('📦 Choose Package'),
                    const SizedBox(height: 14),
                    // Packages
                    ..._subServices.map((s) => _PackageCard(
                      service: s,
                      isSelected: _selected == s['name'],
                      onTap: () => setState(() => _selected = s['name'] as String),
                    )),

                    const SizedBox(height: 22),
                    _sectionTitle('👷 Select Worker (Optional)'),
                    const SizedBox(height: 10),
                    if (_loadingWorkers)
                      Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: AppColors.primary)))
                    else if (_workers.isEmpty)
                      Text('No specific workers available. We will assign one automatically.', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub))
                    else
                      SizedBox(
                        height: 90,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _workers.length,
                          itemBuilder: (ctx, i) {
                            final w = _workers[i];
                            final isSel = _selectedWorker?['_id'] == w['_id'];
                            return GestureDetector(
                              onTap: () => setState(() => _selectedWorker = isSel ? null : w),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                width: 80,
                                margin: const EdgeInsets.only(right: 12),
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isSel ? AppColors.primary.withOpacity(0.15) : AppColors.card,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: isSel ? AppColors.primary : AppColors.border, width: isSel ? 2 : 1),
                                ),
                                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  CircleAvatar(radius: 18, backgroundColor: AppColors.primary, child: Text(w['name'][0].toUpperCase(), style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
                                  const SizedBox(height: 6),
                                  Text(w['name'], style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.text), maxLines: 1, overflow: TextOverflow.ellipsis),
                                ]),
                              ),
                            );
                          },
                        ),
                      ),
                      
                    const SizedBox(height: 22),
                    _sectionTitle('📍 Your Address'),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _addrCtrl,
                      style: TextStyle(color: AppColors.text),
                      maxLines: 2,
                      decoration: InputDecoration(
                        hintText: 'Enter your full address...',
                        prefixIcon: Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Icon(Icons.location_on, color: AppColors.primary)),
                      ),
                    ),

                    const SizedBox(height: 22),
                    _sectionTitle('📅 Schedule'),
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: _pickDate,
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                        child: Row(children: [
                          Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                            child: Icon(Icons.calendar_today, color: AppColors.primary, size: 20)),
                          const SizedBox(width: 14),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('Scheduled For', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
                            Text('${_date.day}/${_date.month}/${_date.year} at ${_date.hour.toString().padLeft(2,'0')}:${_date.minute.toString().padLeft(2,'0')}',
                                style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.text)),
                          ])),
                          Icon(Icons.edit_outlined, color: AppColors.textSub, size: 18),
                        ]),
                      ),
                    ),

                    const SizedBox(height: 22),
                    // Why FixoN
                    _sectionTitle('✅ Why FixoN?'),
                    const SizedBox(height: 10),
                    _buildFeatures(),
                    const SizedBox(height: 30),
                  ]),
                ),
              ),
              // Book Button
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                decoration: BoxDecoration(color: AppColors.card, border: Border(top: BorderSide(color: AppColors.border))),
                child: Row(children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Total', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
                    Text('₹${_selectedService['price']}', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.success)),
                  ]),
                  const SizedBox(width: 16),
                  Expanded(child: ElevatedButton.icon(
                    onPressed: _book,
                    icon: Icon(Icons.check_circle_outline),
                    label: Text('Book Now', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700)),
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                  )),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [color.withOpacity(0.3), Colors.transparent], begin: Alignment.topCenter, end: Alignment.bottomCenter),
      ),
      child: Row(children: [
        GestureDetector(onTap: () => Navigator.pop(context),
          child: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Icon(Icons.arrow_back_ios, color: AppColors.text, size: 18))),
        const SizedBox(width: 14),
        Container(width: 50, height: 50, decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(14)),
          child: Center(child: Text(widget.service['icon'] as String, style: TextStyle(fontSize: 26)))),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.service['name'] as String, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
          Text('Professional service at your doorstep', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
        ])),
      ]),
    );
  }

  Widget _sectionTitle(String t) => Text(t, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text));

  Widget _buildFeatures() => Column(
    children: [
      for (final f in ['✅ Verified & trained professionals', '🔒 Safe & secure service', '⭐ Rated 4.8+ by customers', '💰 Transparent pricing'])
        Padding(padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            Text(f.substring(0, 2), style: TextStyle(fontSize: 16)),
            const SizedBox(width: 10),
            Text(f.substring(2), style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSub)),
          ])),
    ],
  );
}

class _PackageCard extends StatelessWidget {
  final Map<String, dynamic> service;
  final bool isSelected;
  final VoidCallback onTap;
  const _PackageCard({required this.service, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withOpacity(0.1) : AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.border, width: isSelected ? 2 : 1),
        ),
        child: Row(children: [
          AnimatedContainer(duration: const Duration(milliseconds: 200),
            width: 20, height: 20,
            decoration: BoxDecoration(shape: BoxShape.circle, color: isSelected ? AppColors.primary : Colors.transparent, border: Border.all(color: isSelected ? AppColors.primary : AppColors.textSub, width: 2)),
            child: isSelected ? Icon(Icons.check, color: Colors.white, size: 12) : null),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(service['name'] as String, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
              if (service['popular'] == true) ...[
                const SizedBox(width: 8),
                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.accent.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                  child: Text('Popular', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.accent))),
              ],
            ]),
            const SizedBox(height: 3),
            Text('⏱ ${service['time']}', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSub)),
          ])),
          Text('₹${service['price']}', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: isSelected ? AppColors.primary : AppColors.text)),
        ]),
      ),
    );
  }
}


