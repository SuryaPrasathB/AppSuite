import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Brand & Desktop Web Colors
  static const Color primary = Color(0xFF2563EB); // Tailwind blue-600
  static const Color primaryDark = Color(0xFF1D4ED8); // Blue 700
  static const Color primaryLight = Color(0xFF3B82F6); // Blue 500
  static const Color primaryBg = Color(0xFFEFF6FF); // Blue 50

  // Neutral Light Surfaces (Matching Web Screenshot)
  static const Color background = Color(0xFFF8FAFC); // Slate 50
  static const Color surface = Color(0xFFFFFFFF); // Pure White
  static const Color card = Color(0xFFFFFFFF); // White cards
  static const Color cardBorder = Color(0xFFE2E8F0); // Slate 200
  static const Color divider = Color(0xFFF1F5F9); // Slate 100

  // Text Hierarchy
  static const Color textPrimary = Color(0xFF0F172A); // Slate 900
  static const Color textSecondary = Color(0xFF475569); // Slate 600
  static const Color textMuted = Color(0xFF94A3B8); // Slate 400

  // Desktop Sidebar Navy (for bottom nav & brand accents)
  static const Color sidebarNavy = Color(0xFF0B1120); // Deep Dark Slate
  static const Color sidebarNavyLight = Color(0xFF1E293B);

  // Status & Alerts (Matching Web Badges)
  static const Color planningBg = Color(0xFFDBEAFE); // Blue 100
  static const Color planningText = Color(0xFF1D4ED8); // Blue 700

  static const Color success = Color(0xFF10B981); // Emerald 500
  static const Color successBg = Color(0xFFD1FAE5); // Emerald 100
  static const Color successText = Color(0xFF047857);

  static const Color warning = Color(0xFFF59E0B); // Amber 500
  static const Color warningBg = Color(0xFFFEF3C7); // Amber 100
  static const Color warningText = Color(0xFFB45309);

  static const Color danger = Color(0xFFE11D48); // Rose 600 (Desktop overdue banner)
  static const Color dangerBg = Color(0xFFFFE4E6); // Rose 100
  static const Color dangerBanner = Color(0xFFE11D48); // Rose 600

  static const Color purple = Color(0xFF8B5CF6);
  static const Color purpleBg = Color(0xFFEDE9FE);
  static const Color purpleText = Color(0xFF6D28D9);

  static const Color info = Color(0xFF0284C7); // Sky 600
  static const Color infoBg = Color(0xFFE0F2FE); // Sky 100
  static const Color infoText = Color(0xFF0369A1); // Sky 700

  static const Color milestoneBg = Color(0xFFF1F5F9); // Slate 100
  static const Color milestoneText = Color(0xFF475569); // Slate 600
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        secondary: AppColors.primaryDark,
        surface: AppColors.surface,
        error: AppColors.danger,
        onPrimary: Colors.white,
        onSurface: AppColors.textPrimary,
      ),
      textTheme: GoogleFonts.interTextTheme(
        ThemeData.light().textTheme.apply(
          bodyColor: AppColors.textPrimary,
          displayColor: AppColors.textPrimary,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: Colors.black.withValues(alpha: 0.05),
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: AppColors.textPrimary,
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.cardBorder, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.cardBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        hintStyle: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 13),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.sidebarNavy,
        selectedItemColor: Colors.white,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 10,
        selectedLabelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
        unselectedLabelStyle: TextStyle(fontSize: 10),
      ),
    );
  }
}
