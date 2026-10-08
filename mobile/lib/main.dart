import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/services/notification_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/views/login_view.dart';
import 'features/projects/views/projects_home_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: AppColors.sidebarNavy,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize notifications
  try {
    await NotificationService.initialize();
  } catch (e) {
    debugPrint('NotificationService init error: $e');
  }

  runApp(
    const ProviderScope(
      child: AppSuiteMobileApp(),
    ),
  );
}

class AppSuiteMobileApp extends ConsumerWidget {
  const AppSuiteMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    return MaterialApp(
      title: 'LSCS AppSuite - Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: authState.when(
        data: (user) {
          if (user != null) {
            return const ProjectsHomeView();
          }
          return const LoginView();
        },
        loading: () => const Scaffold(
          backgroundColor: AppColors.background,
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.layers_rounded, size: 64, color: AppColors.primaryLight),
                SizedBox(height: 24),
                CircularProgressIndicator(color: AppColors.primary),
              ],
            ),
          ),
        ),
        error: (err, _) => const LoginView(),
      ),
    );
  }
}
