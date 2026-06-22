import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../providers/worker_provider.dart';
import '../../utils/constants.dart';
import '../profile/worker_verification_screen.dart';
import 'worker_login_screen.dart';

class WorkerProfileScreen extends StatelessWidget {
  const WorkerProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final wp = context.watch<WorkerProvider>();
    final worker = wp.worker ?? {};

    final isVerified = worker['verification'] != null &&
        worker['verification']['status'] == 'approved';

    final skillsList = worker['skills'] is List
        ? List<String>.from(worker['skills'])
        : <String>[];

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Text(
                'My Profile 👤',
                style: GoogleFonts.outfit(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: 24),

              // Profile Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.primary.withOpacity(0.15),
                      AppColors.secondary.withOpacity(0.08),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.4),
                            blurRadius: 16,
                          )
                        ],
                      ),
                      child: Center(
                        child: Text(
                          (worker['name'] ?? 'W').toString()[0].toUpperCase(),
                          style: GoogleFonts.outfit(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                worker['name']?.toString() ?? 'Worker',
                                style: GoogleFonts.outfit(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.text,
                                ),
                              ),
                              if (isVerified) ...[
                                const SizedBox(width: 6),
                                const Icon(
                                  Icons.verified,
                                  color: Color(0xFF10B981),
                                  size: 20,
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            worker['workerId']?.toString() ?? 'ID: N/A',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: AppColors.textSub,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: isVerified
                                  ? const Color(0xFF10B981).withOpacity(0.12)
                                  : AppColors.warning.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: isVerified
                                    ? const Color(0xFF10B981).withOpacity(0.3)
                                    : AppColors.warning.withOpacity(0.3),
                              ),
                            ),
                            child: Text(
                              isVerified ? '✅ Aadhaar Verified' : '⏳ Verification Pending',
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: isVerified
                                    ? const Color(0xFF10B981)
                                    : AppColors.warning,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Profile Details List
              _buildSectionTitle('Professional Info'),
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    _buildInfoRow(
                      Icons.star_rounded,
                      'Rating',
                      '${worker['rating'] ?? 5.0} / 5.0',
                      color: AppColors.accent,
                    ),
                    _buildDivider(),
                    _buildInfoRow(
                      Icons.work_rounded,
                      'Experience',
                      worker['experience']?.toString() ?? 'N/A',
                      color: AppColors.primary,
                    ),
                    _buildDivider(),
                    _buildInfoRow(
                      Icons.category_rounded,
                      'Category',
                      worker['category']?.toString() ?? 'N/A',
                      color: AppColors.secondary,
                    ),
                    _buildDivider(),
                    _buildInfoRow(
                      Icons.phone_rounded,
                      'Phone Number',
                      worker['phone']?.toString() ?? 'N/A',
                      color: AppColors.success,
                    ),
                    _buildDivider(),
                    _buildInfoRow(
                      Icons.location_on_rounded,
                      'Service Area',
                      'Godavarikhani & Surroundings',
                      color: AppColors.error,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Skills Section
              _buildSectionTitle('Skills & Expertise'),
              const SizedBox(height: 10),
              if (skillsList.isEmpty)
                Text(
                  'No specific skills listed.',
                  style: GoogleFonts.inter(color: AppColors.textSub, fontSize: 13),
                )
              else
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: skillsList.map((skill) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        skill,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text,
                        ),
                      ),
                    );
                  }).toList(),
                ),

              const SizedBox(height: 32),

              // Verify Account / Document submission Button
              if (!isVerified) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7C3AED),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const WorkerVerificationScreen(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.verified_user_outlined, color: Colors.white),
                    label: Text(
                      'Complete Aadhaar Verification',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
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
