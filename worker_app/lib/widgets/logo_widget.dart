import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class LogoWidget extends StatelessWidget {
  final double fontSize;
  final bool showBadge;

  const LogoWidget({super.key, this.fontSize = 32, this.showBadge = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        // FIX part with cyan and purple shadows
        Text(
          'FIX',
          style: GoogleFonts.montserrat(
            fontSize: fontSize,
            fontWeight: FontWeight.w900,
            fontStyle: FontStyle.italic,
            color: Colors.white,
            letterSpacing: -1,
            shadows: [
              // Purple shadow
              Shadow(
                color: const Color(0xFF7C3AED).withOpacity(0.8),
                offset: Offset(fontSize * 0.05, fontSize * 0.05),
              ),
              // Cyan outer shadow
              Shadow(
                color: const Color(0xFF06B6D4).withOpacity(0.5),
                offset: Offset(fontSize * 0.1, fontSize * 0.1),
              ),
            ],
          ),
        ),
        // ON part with gradient
        ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: (bounds) => LinearGradient(
            colors: [Color(0xFF06B6D4), Color(0xFF7C3AED)],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ).createShader(Rect.fromLTWH(0, 0, bounds.width, bounds.height)),
          child: Text(
            'ON',
            style: GoogleFonts.montserrat(
              fontSize: fontSize,
              fontWeight: FontWeight.w900,
              fontStyle: FontStyle.italic,
              letterSpacing: -1,
              shadows: [
                Shadow(
                  color: const Color(0xFF06B6D4).withOpacity(0.3),
                  blurRadius: 10,
                )
              ],
            ),
          ),
        ),
        if (showBadge) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withOpacity(0.12),
              border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.25)),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'APP',
              style: GoogleFonts.inter(
                fontSize: fontSize * 0.28,
                fontWeight: FontWeight.w700,
                letterSpacing: 1,
                color: const Color(0xFFF59E0B),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

