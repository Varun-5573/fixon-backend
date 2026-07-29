import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:flutter/services.dart';
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';

class WorkerRegisterScreen extends StatefulWidget {
  const WorkerRegisterScreen({super.key});

  @override
  State<WorkerRegisterScreen> createState() => _WorkerRegisterScreenState();
}

class _WorkerRegisterScreenState extends State<WorkerRegisterScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  // Tab 1: Registration Form
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _aadhaarNumCtrl = TextEditingController();
  final _panNumCtrl = TextEditingController();
  final _expCtrl = TextEditingController();
  final _bankAccCtrl = TextEditingController();
  final _bankIfscCtrl = TextEditingController();
  final _bankNameCtrl = TextEditingController();

  String _selectedCity = 'Hyderabad';
  String _selectedCategory = 'Plumbing';
  
  File? _profilePhoto;
  File? _aadhaarPhoto;
  File? _panPhoto;

  bool _loading = false;
  String? _error;
  String? _successMsg;

  // Tab 2: Status check
  final _statusPhoneCtrl = TextEditingController();
  bool _checkingStatus = false;
  Map<String, dynamic>? _statusResult;
  String? _statusError;

  final List<String> _cities = ['Hyderabad', 'Secunderabad', 'Cyberabad', 'Godavarikhani', 'Warangal', 'Nizamabad'];
  final List<String> _categories = ['Plumbing', 'Electrical', 'AC Repair', 'Cleaning', 'Carpentry', 'Painting', 'Appliance Repair'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _aadhaarNumCtrl.dispose();
    _panNumCtrl.dispose();
    _expCtrl.dispose();
    _bankAccCtrl.dispose();
    _bankIfscCtrl.dispose();
    _bankNameCtrl.dispose();
    _statusPhoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(int type) async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 50);
      if (picked != null) {
        setState(() {
          if (type == 1) _profilePhoto = File(picked.path);
          if (type == 2) _aadhaarPhoto = File(picked.path);
          if (type == 3) _panPhoto = File(picked.path);
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error picking image: $e')),
      );
    }
  }

  Future<String?> _toBase64(File? file) async {
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    return 'data:image/jpeg;base64,${base64Encode(bytes)}';
  }

  Future<void> _submitRegistration() async {
    if (!_formKey.currentState!.validate()) return;
    if (_profilePhoto == null) {
      setState(() => _error = 'Please select a profile photo');
      return;
    }
    if (_aadhaarPhoto == null) {
      setState(() => _error = 'Please upload your Aadhaar Card photo');
      return;
    }
    if (_panPhoto == null) {
      setState(() => _error = 'Please upload your PAN Card photo');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _successMsg = null;
    });

    try {
      final wp = context.read<WorkerProvider>();
      
      final profileBase64 = await _toBase64(_profilePhoto);
      final aadhaarBase64 = await _toBase64(_aadhaarPhoto);
      final panBase64 = await _toBase64(_panPhoto);

      final payload = {
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'city': _selectedCity,
        'category': _selectedCategory,
        'experience': _expCtrl.text.trim(),
        'aadhaarNumber': _aadhaarNumCtrl.text.trim(),
        'panNumber': _panNumCtrl.text.trim(),
        'profilePhotoUrl': profileBase64,
        'aadhaarPhotoUrl': aadhaarBase64,
        'panPhotoUrl': panBase64,
        'bankAccount': _bankAccCtrl.text.trim(),
        'bankIFSC': _bankIfscCtrl.text.trim(),
        'bankName': _bankNameCtrl.text.trim(),
      };

      final res = await wp.registerWorker(payload);
      if (res['success'] == true) {
        setState(() {
          _successMsg = res['message'] ?? 'Registration submitted successfully!';
          _nameCtrl.clear();
          _emailCtrl.clear();
          _phoneCtrl.clear();
          _addressCtrl.clear();
          _aadhaarNumCtrl.clear();
          _panNumCtrl.clear();
          _expCtrl.clear();
          _bankAccCtrl.clear();
          _bankIfscCtrl.clear();
          _bankNameCtrl.clear();
          _profilePhoto = null;
          _aadhaarPhoto = null;
          _panPhoto = null;
        });
        _tabCtrl.animateTo(1); // Switch to check status tab
        _statusPhoneCtrl.text = payload['phone'] as String;
        _checkStatus();
      } else {
        setState(() => _error = res['error'] ?? 'Registration failed');
      }
    } catch (e) {
      setState(() => _error = 'Error submitting registration: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _checkStatus() async {
    final phone = _statusPhoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _statusError = 'Please enter your registered phone number');
      return;
    }

    setState(() {
      _checkingStatus = true;
      _statusError = null;
      _statusResult = null;
    });

    try {
      final wp = context.read<WorkerProvider>();
      final res = await wp.checkRegistrationStatus(phone);
      if (res['success'] == true) {
        setState(() {
          _statusResult = res;
        });
      } else {
        setState(() => _statusError = res['error'] ?? 'No registration found');
      }
    } catch (e) {
      setState(() => _statusError = 'Error checking status: $e');
    } finally {
      setState(() => _checkingStatus = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF060612), Color(0xFF0D0528), const Color(0xFF1A0533)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                    Expanded(
                      child: Text(
                        'Worker Onboarding',
                        style: GoogleFonts.outfit(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // TabBar
              TabBar(
                controller: _tabCtrl,
                indicatorColor: AppColors.primary,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white38,
                labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold),
                tabs: const [
                  Tab(text: 'Register as Worker'),
                  Tab(text: 'Check Status'),
                ],
              ),

              Expanded(
                child: TabBarView(
                  controller: _tabCtrl,
                  children: [
                    // Form Tab
                    _buildRegisterForm(),

                    // Status Tab
                    _buildStatusCheck(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRegisterForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: AppColors.error, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: GoogleFonts.inter(color: AppColors.error, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            Text('Profile Photo', style: _labelStyle),
            const SizedBox(height: 10),
            Center(
              child: GestureDetector(
                onTap: () => _pickImage(1),
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(50),
                    border: Border.all(color: Colors.white12, width: 2),
                    image: _profilePhoto != null
                        ? DecorationImage(image: FileImage(_profilePhoto!), fit: BoxFit.cover)
                        : null,
                  ),
                  child: _profilePhoto == null
                      ? const Icon(Icons.add_a_photo_outlined, color: Colors.white54, size: 30)
                      : null,
                ),
              ),
            ),
            const SizedBox(height: 24),

            _buildField('Full Name', _nameCtrl, 'Enter your full name', Icons.person_outline),
            _buildField('Email Address', _emailCtrl, 'Enter email address', Icons.email_outlined, type: TextInputType.emailAddress, required: false),
            _buildField('Phone Number', _phoneCtrl, '10-digit phone number', Icons.phone_outlined, type: TextInputType.phone),
            _buildField('Full Address', _addressCtrl, 'Enter your home address', Icons.home_outlined),
            _buildField('Experience (Years)', _expCtrl, 'e.g. 5', Icons.timeline_outlined, type: TextInputType.number),

            // Dropdowns
            Text('Service Area (City)', style: _labelStyle),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedCity,
                  dropdownColor: const Color(0xFF1E1E2F),
                  style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
                  isExpanded: true,
                  items: _cities.map((city) => DropdownMenuItem(value: city, child: Text(city))).toList(),
                  onChanged: (val) => setState(() => _selectedCity = val!),
                ),
              ),
            ),
            const SizedBox(height: 18),

            Text('Service Category', style: _labelStyle),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedCategory,
                  dropdownColor: const Color(0xFF1E1E2F),
                  style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
                  isExpanded: true,
                  items: _categories.map((cat) => DropdownMenuItem(value: cat, child: Text(cat))).toList(),
                  onChanged: (val) => setState(() => _selectedCategory = val!),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Aadhaar info
            _buildField('Aadhaar Card Number', _aadhaarNumCtrl, 'Enter 12-digit Aadhaar number', Icons.credit_card),
            Text('Aadhaar Card Photo', style: _labelStyle),
            const SizedBox(height: 8),
            _buildImageUploadTile(_aadhaarPhoto, () => _pickImage(2), 'Aadhaar Card Front'),
            const SizedBox(height: 20),

            // PAN info
            _buildField('PAN Card Number', _panNumCtrl, 'Enter 10-digit PAN number', Icons.credit_card),
            Text('PAN Card Photo', style: _labelStyle),
            const SizedBox(height: 8),
            _buildImageUploadTile(_panPhoto, () => _pickImage(3), 'PAN Card Front'),
            const SizedBox(height: 24),

            // Optional bank details
            Text('Bank Details (Optional)', style: GoogleFonts.outfit(color: AppColors.secondary, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildField('Bank Name', _bankNameCtrl, 'e.g. State Bank of India', Icons.account_balance_outlined, required: false),
            _buildField('Account Number', _bankAccCtrl, 'Enter account number', Icons.password_outlined, required: false),
            _buildField('IFSC Code', _bankIfscCtrl, 'e.g. SBIN0001234', Icons.code, required: false),

            const SizedBox(height: 32),

            // Submit button
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _loading ? null : _submitRegistration,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  padding: EdgeInsets.zero,
                ),
                child: Ink(
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6))],
                  ),
                  child: Center(
                    child: _loading
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                        : Text('Submit Registration 🚀', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCheck() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Check Application Status 🔍',
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter your registered phone number to verify if your application has been approved by the administration.',
            style: GoogleFonts.inter(fontSize: 13, color: Colors.white60, height: 1.5),
          ),
          const SizedBox(height: 24),

          _buildField('Registered Phone Number', _statusPhoneCtrl, 'Enter phone number', Icons.phone_outlined, type: TextInputType.phone),

          if (_statusError != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withOpacity(0.3)),
              ),
              child: Text(
                _statusError!,
                style: GoogleFonts.inter(color: AppColors.error, fontSize: 13),
              ),
            ),
          ],

          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _checkingStatus ? null : _checkStatus,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _checkingStatus
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('Check Status', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
            ),
          ),

          const SizedBox(height: 32),

          if (_statusResult != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Status Result', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16)),
                      _buildStatusBadge(_statusResult!['status']),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text('Worker Name: ${_statusResult!['name']}', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),

                  if (_statusResult!['status'] == 'approved') ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      margin: const EdgeInsets.only(top: 10),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.success.withOpacity(0.2)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '🎉 Congratulations! Your worker account has been approved. Use the credentials below to log in:',
                            style: GoogleFonts.inter(fontSize: 12, color: Colors.white70, height: 1.4),
                          ),
                          const SizedBox(height: 14),
                          _buildCredentialDisplay('Worker ID', _statusResult!['workerId']),
                          const SizedBox(height: 10),
                          _buildCredentialDisplay('Password', _statusResult!['workerPassword']),
                        ],
                      ),
                    ),
                  ] else if (_statusResult!['status'] == 'rejected') ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      margin: const EdgeInsets.only(top: 10),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.error.withOpacity(0.2)),
                      ),
                      child: Text(
                        'Reason for rejection: ${_statusResult!['rejectionReason'] ?? "Document details mismatch"}',
                        style: GoogleFonts.inter(color: AppColors.error, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ] else ...[
                    Text(
                      '⏳ Your application is currently under review by our administration. Please check back in a few hours.',
                      style: GoogleFonts.inter(fontSize: 13, color: Colors.white60, height: 1.5),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCredentialDisplay(String label, String? value) {
    final strVal = value ?? '—';
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: GoogleFonts.inter(fontSize: 10, color: Colors.white38)),
              const SizedBox(height: 2),
              Text(strVal, style: GoogleFonts.robotoMono(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white)),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.copy, size: 18, color: Colors.white54),
          onPressed: () {
            Clipboard.setData(ClipboardData(text: strVal));
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('$label copied to clipboard')),
            );
          },
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String? status) {
    Color bg = AppColors.warning.withOpacity(0.12);
    Color fg = AppColors.warning;
    String label = 'Pending Review';

    if (status == 'approved') {
      bg = AppColors.success.withOpacity(0.12);
      fg = AppColors.success;
      label = 'Approved';
    } else if (status == 'rejected') {
      bg = AppColors.error.withOpacity(0.12);
      fg = AppColors.error;
      label = 'Rejected';
    } else if (status == 'blocked') {
      bg = AppColors.error.withOpacity(0.12);
      fg = AppColors.error;
      label = 'Blocked';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }

  TextStyle get _labelStyle => GoogleFonts.inter(color: Colors.white60, fontSize: 13, fontWeight: FontWeight.w600);

  Widget _buildField(
    String label,
    TextEditingController ctrl,
    String hint,
    IconData icon, {
    TextInputType type = TextInputType.text,
    bool required = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _labelStyle),
        const SizedBox(height: 8),
        TextFormField(
          controller: ctrl,
          keyboardType: type,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, color: Colors.white38, size: 20),
            hintStyle: const TextStyle(color: Colors.white24),
            filled: true,
            fillColor: Colors.white.withOpacity(0.06),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: AppColors.primary, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
          validator: required
              ? (val) => val == null || val.trim().isEmpty ? 'This field is required' : null
              : null,
        ),
        const SizedBox(height: 18),
      ],
    );
  }

  Widget _buildImageUploadTile(File? file, VoidCallback onTap, String title) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 120,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white10),
        ),
        child: file != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.file(file, fit: BoxFit.cover),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.cloud_upload_outlined, color: Colors.white38, size: 28),
                  const SizedBox(height: 8),
                  Text(
                    'Upload $title',
                    style: GoogleFonts.inter(color: Colors.white38, fontSize: 13),
                  ),
                ],
              ),
      ),
    );
  }
}
