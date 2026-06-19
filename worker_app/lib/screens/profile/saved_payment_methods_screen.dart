import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../utils/constants.dart';
import '../../utils/strings.dart';

class SavedPaymentMethodsScreen extends StatelessWidget {
  const SavedPaymentMethodsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Text(AppStrings.paymentMethods, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppColors.text)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.text),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Saved UPI IDs', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textSub)),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.account_balance_wallet, color: AppColors.primary),
                ),
                title: Text('PhonePe / GPay / Paytm', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.text)),
                subtitle: Text('9000853346@axl', style: GoogleFonts.inter(color: AppColors.textSub)),
                trailing: Icon(Icons.check_circle, color: AppColors.success),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Adding new methods is disabled in this version.')));
                },
                icon: Icon(Icons.add, color: AppColors.primary),
                label: Text('Add New UPI ID', style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: BorderSide(color: AppColors.primary.withOpacity(0.5)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}

