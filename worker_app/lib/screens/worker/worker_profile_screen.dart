import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';
import '../profile/worker_verification_screen.dart';
import 'worker_login_screen.dart';

class WorkerProfileScreen extends StatefulWidget {
  const WorkerProfileScreen({super.key});
  @override
  State<WorkerProfileScreen> createState() => _WorkerProfileScreenState();
}

class _WorkerProfileScreenState extends State<WorkerProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final wp = context.watch<WorkerProvider>();
    final worker = wp.worker ?? {};

    final aadhaarVerified = worker['aadhaarVerified'] == true;
    final panVerified = worker['panVerified'] == true;
    // Legacy: if old verification field exists and approved
    final legacyVerified = worker['verification'] != null &&
        worker['verification']['status'] == 'approved';
    final isFullyVerified = (aadhaarVerified || legacyVerified) && panVerified;

    final skillsList = worker['skills'] is List
        ? List<String>.from(worker['skills'])
        : <String>[];
    final regStatus = worker['registrationStatus']?.toString() ?? (worker['isActive'] == true ? 'approved' : 'pending');

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('My Profile 👤', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text)),
              const SizedBox(height: 16),

              // Profile Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [AppColors.primary.withOpacity(0.15), AppColors.secondary.withOpacity(0.08)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 72, height: 72,
                          decoration: BoxDecoration(
                            gradient: worker['profilePhotoUrl'] != null && worker['profilePhotoUrl'].toString().isNotEmpty ? null : AppColors.primaryGradient,
                            image: worker['profilePhotoUrl'] != null && worker['profilePhotoUrl'].toString().isNotEmpty
                              ? DecorationImage(image: NetworkImage(worker['profilePhotoUrl'].toString()), fit: BoxFit.cover)
                              : null,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.4), blurRadius: 16)],
                          ),
                          child: worker['profilePhotoUrl'] == null || worker['profilePhotoUrl'].toString().isEmpty
                            ? Center(child: Text((worker['name'] ?? 'W').toString()[0].toUpperCase(), style: GoogleFonts.outfit(fontSize: 30, fontWeight: FontWeight.w900, color: Colors.white)))
                            : null,
                        ),
                        const SizedBox(width: 16),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text(worker['name']?.toString() ?? 'Worker', style: GoogleFonts.outfit(fontSize: 19, fontWeight: FontWeight.w800, color: AppColors.text))),
                            if (isFullyVerified) const Icon(Icons.verified, color: Color(0xFF10B981), size: 20),
                          ]),
                          const SizedBox(height: 3),
                          Text('🆔 ${worker['workerId']?.toString() ?? 'Not assigned yet'}', style: GoogleFonts.inter(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 3),
                          if (worker['email'] != null && worker['email'].toString().isNotEmpty)
                            Text('📧 ${worker['email']}', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
                          if (worker['phone'] != null)
                            Text('📱 ${worker['phone']}', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSub)),
                        ])),
                      ],
                    ),
                    const SizedBox(height: 14),
                    // Registration status banner
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                      decoration: BoxDecoration(
                        color: regStatus == 'approved' ? AppColors.success.withOpacity(0.1) : regStatus == 'rejected' ? AppColors.error.withOpacity(0.1) : AppColors.warning.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: regStatus == 'approved' ? AppColors.success.withOpacity(0.3) : regStatus == 'rejected' ? AppColors.error.withOpacity(0.3) : AppColors.warning.withOpacity(0.3)),
                      ),
                      child: Text(
                        regStatus == 'approved' ? '✅ Account Approved & Active' : regStatus == 'rejected' ? '❌ Application Rejected' : '⏳ Awaiting Admin Approval',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: regStatus == 'approved' ? AppColors.success : regStatus == 'rejected' ? AppColors.error : AppColors.warning),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // Verification Badges Row
              Row(children: [
                Expanded(child: _verifyBadge('🪪 Aadhaar', aadhaarVerified || legacyVerified)),
                const SizedBox(width: 10),
                Expanded(child: _verifyBadge('💳 PAN Card', panVerified)),
              ]),

              const SizedBox(height: 18),

              // Professional Info
              _buildSectionTitle('Professional Info'),
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
                child: Column(children: [
                  _buildInfoRow(Icons.category_rounded, 'Category', worker['category']?.toString() ?? 'N/A', color: AppColors.secondary),
                  _buildDivider(),
                  _buildInfoRow(Icons.work_rounded, 'Experience', worker['experience']?.toString() ?? 'N/A', color: AppColors.primary),
                  _buildDivider(),
                  _buildInfoRow(Icons.star_rounded, 'Rating', '${worker['rating'] ?? 0} / 5.0', color: AppColors.accent),
                  _buildDivider(),
                  _buildInfoRow(Icons.location_city_rounded, 'Service Area', worker['city']?.toString() ?? 'Hyderabad', color: AppColors.error),
                  _buildDivider(),
                  _buildInfoRow(Icons.home_rounded, 'Address', worker['address']?.toString().isEmpty == true ? 'Not set' : worker['address']?.toString() ?? 'Not set', color: AppColors.success),
                  _buildDivider(),
                  _buildInfoRow(
                    worker['isOnline'] == true ? Icons.circle : Icons.circle_outlined,
                    'Online Status',
                    worker['isOnline'] == true ? '🟢 Online' : '⚫ Offline',
                    color: worker['isOnline'] == true ? AppColors.success : AppColors.textSub,
                  ),
                ]),
              ),

              const SizedBox(height: 18),

              // Skills
              if (skillsList.isNotEmpty) ...[
                _buildSectionTitle('Skills & Expertise'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: skillsList.map((skill) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                    child: Text(skill, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
                  )).toList(),
                ),
                const SizedBox(height: 18),
              ],

              // Verify Button
              if (!aadhaarVerified && !legacyVerified) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED), padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WorkerVerificationScreen())),
                    icon: const Icon(Icons.verified_user_outlined, color: Colors.white),
                    label: Text('Submit Aadhaar Verification', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15)),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (!panVerified) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF06B6D4), padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WorkerVerificationScreen())),
                    icon: const Icon(Icons.credit_card, color: Colors.white),
                    label: Text('Submit PAN Verification', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15)),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Logout Button
              SizedBox(
                width: double.infinity,
                child: GestureDetector(
                  onTap: () async {
                    await wp.logout();
                    if (context.mounted) {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const WorkerLoginScreen(),
                        ),
                      );
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.error.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.error.withOpacity(0.25)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.logout, color: AppColors.error, size: 22),
                        const SizedBox(width: 14),
                        Text(
                          'Log Out',
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _verifyBadge(String label, bool isVerified) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: isVerified ? const Color(0xFF10B981).withOpacity(0.08) : AppColors.error.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isVerified ? const Color(0xFF10B981).withOpacity(0.2) : AppColors.error.withOpacity(0.2),
        ),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isVerified ? Icons.verified : Icons.error_outline,
                size: 14,
                color: isVerified ? const Color(0xFF10B981) : AppColors.error,
              ),
              const SizedBox(width: 4),
              Text(
                isVerified ? 'Verified' : 'Not Verified',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isVerified ? const Color(0xFF10B981) : AppColors.error,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: GoogleFonts.outfit(
        fontSize: 16,
        fontWeight: FontWeight.w800,
        color: AppColors.text,
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value,
      {required Color color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.textSub,
              ),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Divider(
      color: AppColors.border,
      height: 1,
      indent: 16,
      endIndent: 16,
    );
  }
}
