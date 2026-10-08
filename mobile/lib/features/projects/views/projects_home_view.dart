import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../notifications/providers/notifications_provider.dart';
import '../../notifications/views/notifications_drawer_view.dart';
import '../providers/projects_provider.dart';
import 'tabs/dashboard_tab.dart';
import 'tabs/my_tasks_tab.dart';
import 'tabs/projects_list_tab.dart';
import 'tabs/service_tickets_tab.dart';
import 'tabs/activity_timeline_tab.dart';

class ProjectsHomeView extends ConsumerStatefulWidget {
  const ProjectsHomeView({super.key});

  @override
  ConsumerState<ProjectsHomeView> createState() => _ProjectsHomeViewState();
}

class _ProjectsHomeViewState extends ConsumerState<ProjectsHomeView> {
  int _currentIndex = 0;

  final List<String> _titles = [
    'Dashboard',
    'Projects',
    'My Tasks',
    'Service Desk',
    'Activity & Timeline',
  ];

  final List<String> _subtitles = [
    'System metrics & quick actions',
    'Manage projects and track material consumption',
    'Dynamic task tracking & assignments',
    'Field service tickets & resolutions',
    'Audit feed & real-time project updates',
  ];

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(projectsProvider.notifier).loadAll();
      ref.read(notificationsProvider.notifier).refreshAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.value;
    final notifState = ref.watch(notificationsProvider);

    final List<Widget> tabs = [
      ProjectsDashboardTab(onNavigateTab: _onTabTapped),
      const ProjectsListTab(),
      const MyTasksTab(),
      const ServiceTicketsTab(),
      const ActivityTimelineTab(),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.folder_copy_rounded, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        _titles[_currentIndex],
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.primaryBg,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.primaryLight.withValues(alpha: 0.3)),
                        ),
                        child: const Text(
                          'PROJECTS HUB',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryDark,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    _subtitles[_currentIndex],
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Notification Bell with Badge
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary, size: 22),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (ctx) => const NotificationsModalSheet(),
                  );
                },
              ),
              if (notifState.unreadCount > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '${notifState.unreadCount}',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),

          // User Menu (Profile & Logout)
          PopupMenuButton<String>(
            icon: CircleAvatar(
              radius: 14,
              backgroundColor: AppColors.primaryBg,
              child: Text(
                (user?.name.isNotEmpty == true ? user!.name[0] : 'U').toUpperCase(),
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            color: Colors.white,
            elevation: 4,
            onSelected: (val) {
              if (val == 'logout') {
                ref.read(authProvider.notifier).logout();
              }
            },
            itemBuilder: (ctx) => [
              PopupMenuItem(
                value: 'profile',
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user?.name ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                    Text('${user?.role ?? "Employee"} • ${user?.email ?? ""}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 16, color: AppColors.danger),
                    SizedBox(width: 8),
                    Text('Sign Out', style: TextStyle(color: AppColors.danger, fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Top Overdue Banner (Matching Desktop Web App Screenshot)
          if (notifState.overdueCount > 0)
            InkWell(
              onTap: () => _onTabTapped(2),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                color: AppColors.dangerBanner,
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: Colors.white),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'You have ${notifState.overdueCount} overdue task${notifState.overdueCount > 1 ? 's' : ''}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const Text(
                      'Review now',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_forward_ios, size: 10, color: Colors.white70),
                  ],
                ),
              ),
            ),
          Expanded(
            child: IndexedStack(
              index: _currentIndex,
              children: tabs,
            ),
          ),
        ],
      ),
      // Sidebar represented as bottom navigation for mobile with desktop dark navy styling
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.sidebarNavy,
          boxShadow: [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 8,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onTabTapped,
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppColors.sidebarNavy,
          selectedItemColor: Colors.white,
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard, color: AppColors.primaryLight),
              label: 'Dashboard',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.folder_outlined),
              activeIcon: Icon(Icons.folder, color: AppColors.primaryLight),
              label: 'Projects',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.checklist_rtl_outlined),
                  if (notifState.overdueCount > 0)
                    Positioned(
                      top: -4,
                      right: -6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${notifState.overdueCount}',
                          style: const TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                ],
              ),
              activeIcon: const Icon(Icons.checklist_rtl, color: AppColors.primaryLight),
              label: 'My Tasks',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.support_agent_outlined),
              activeIcon: Icon(Icons.support_agent, color: AppColors.primaryLight),
              label: 'Service Desk',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.timeline_rounded),
              activeIcon: Icon(Icons.timeline_rounded, color: AppColors.primaryLight),
              label: 'Activity',
            ),
          ],
        ),
      ),
    );
  }
}
