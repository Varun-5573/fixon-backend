import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String? _base64Image;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    if (user != null) {
      _nameCtrl.text = user['name']?.toString() ?? '';
      _phoneCtrl.text = user['phone']?.toString() ?? '';
    }
    _loadProfilePhoto();
  }

  Future<void> _loadProfilePhoto() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _base64Image = prefs.getString('profile_photo');
    });
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: source, imageQuality: 50);
    if (pickedFile != null) {
      final bytes = await pickedFile.readAsBytes();
      final base64String = base64Encode(bytes);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('profile_photo', base64String);
      setState(() {
        _base64Image = base64String;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: Text('Edit Profile', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.text),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Center(
              child: GestureDetector(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    backgroundColor: AppColors.card,
                    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                    builder: (_) => Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ListTile(
                            leading: Icon(Icons.camera_alt, color: AppColors.primary),
                            title: Text('Take a Photo', style: TextStyle(color: AppColors.text)),
                            onTap: () {
                              Navigator.pop(context);
                              _pickImage(ImageSource.camera);
                            },
                          ),
                          ListTile(
                            leading: Icon(Icons.photo_library, color: AppColors.secondary),
                            title: Text('Choose from Gallery', style: TextStyle(color: AppColors.text)),
                            onTap: () {
                              Navigator.pop(context);
                              _pickImage(ImageSource.gallery);
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                },
                child: Stack(
                  children: [
                    Container(
                      width: 120, height: 120,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.primary, width: 3),
                        image: _base64Image != null
                            ? DecorationImage(image: MemoryImage(base64Decode(_base64Image!)), fit: BoxFit.cover)
                            : null,
                      ),
                      child: _base64Image == null
                          ? Icon(Icons.person, size: 60, color: AppColors.textDim)
                          : null,
                    ),
                    Positioned(
                      bottom: 0, right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                        child: Icon(Icons.edit, color: Colors.white, size: 20),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 40),
            TextField(
              controller: _nameCtrl,
              style: TextStyle(color: AppColors.text),
              decoration: InputDecoration(
                labelText: 'Full Name',
                labelStyle: TextStyle(color: AppColors.textSub),
                filled: true,
                fillColor: AppColors.card,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _phoneCtrl,
              style: TextStyle(color: AppColors.text),
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Phone Number',
                labelStyle: TextStyle(color: AppColors.textSub),
                filled: true,
                fillColor: AppColors.card,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: () {
                  // In a real app we'd update backend auth details too.
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Profile picture saved successfully!')));
                  Navigator.pop(context, true);
                },
                child: Text('Save Profile', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

