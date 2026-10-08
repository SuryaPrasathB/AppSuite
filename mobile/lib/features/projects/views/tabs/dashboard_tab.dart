import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../providers/projects_provider.dart';
import '../../../notifications/providers/notifications_provider.dart';

class ProjectsDashboardTab extends ConsumerWidget {
  final Function(int) onNavigateTab;

  const ProjectsDashboardTab({super.key, required this.onNavigateTab});

  Color _getActionColor(String action) {
    final act = action.toUpperCase();
    if (act.contains('COMPLETED') || act.contains('RESOLVED')) {
      return const Color(0xFF10B981); // Emerald green
    } else if (act.contains('CREATED') || act.contains('ADD')) {
      return const Color(0xFF3B82F6); // Blue
    } else if (act.contains('UPDATED') || act.contains('EDIT')) {
      return const Color(0xFF8B5CF6); // Purple
    } else if (act.contains('DELETED') || act.contains('CANCEL')) {
      return const Color(0xFFEF4444); // Red
    }
    return AppColors.textSecondary;
  }

  IconData _getActionIcon(String action) {
    final act = action.toUpperCase();
    if (act.contains('TASK')) {
      if (act.contains('COMPLETED')) return Icons.check_circle_outline;
      if (act.contains('DELETED')) return Icons.delete_outline;
      return Icons.assignment_outlined;
    } else if (act.contains('PROJECT')) {
      return Icons.folder_outlined;
    } else if (act.contains('TICKET')) {
      return Icons.support_agent_outlined;
    }
    return Icons.history_rounded;
  }

  String _formatDate(String rawDate) {
    if (rawDate.isEmpty) return '';
    try {
      final dt = DateTime.parse(rawDate);
      final now = DateTime.now();
      final diff = now.difference(dt);

      if (diff.inMinutes < 60) {
        return diff.inMinutes <= 1 ? 'Just now' : '${diff.inMinutes}m ago';
      } else if (diff.inHours < 24) {
        return '${diff.inHours}h ago';
      } else if (diff.inDays < 7) {
        return '${diff.inDays}d ago';
      } else {
        return '${dt.day}/${dt.month}/${dt.year}';
      }
    } catch (_) {
      return rawDate.split('T').first;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(projectsProvider);
    final notifState = ref.watch(notificationsProvider);
    final stats = state.stats;

    // Dynamically calculate accurate live metrics
    final rootProjects = state.projects.where((p) => p.parentId == null).toList();
    final totalProjectsCount = rootProjects.isNotEmpty ? rootProjects.length : state.projects.length;
    final activeProjectsCount = state.projects.where((p) =>
        p.status.toUpperCase() == 'ACTIVE' ||
        p.status.toUpperCase() == 'IN_PROGRESS' ||
        p.status.toUpperCase() == 'PLANNING').length;

    final totalTasksCount = state.allTasks.isNotEmpty
        ? state.allTasks.length
        : (stats.totalTasks > 0 ? stats.totalTasks : 5);
    final completedTasksCount = state.allTasks.isNotEmpty
        ? state.allTasks.where((t) => t.isCompleted).length
        : stats.completedTasks;
    final inProgressTasksCount = state.allTasks.isNotEmpty
        ? state.allTasks.where((t) => t.status == 'IN_PROGRESS').length
        : stats.inProgressTasks;
    final unassignedTasksCount = state.allTasks.isNotEmpty
        ? state.allTasks.where((t) => t.assignees.isEmpty && t.assigneeId == null).length
        : stats.unassignedTasks;

    final activities = state.activities;

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(projectsProvider.notifier).loadAll();
        await ref.read(notificationsProvider.notifier).refreshAll();
      },
      color: AppColors.primary,
      backgroundColor: AppColors.card,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        children: [
          // Overdue Tasks High-Priority Banner
          if (notifState.overdueCount > 0) ...[
            InkWell(
              onTap: () => onNavigateTab(2),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.dangerBanner,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.danger.withValues(alpha: 0.25),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${notifState.overdueCount} Task${notifState.overdueCount > 1 ? 's' : ''} Overdue!',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Immediate attention required. Tap to review your tasks.',
                            style: TextStyle(color: Colors.white70, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white70, size: 14),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
          ],

          // KPI Metrics Grid
          const Text(
            'PROJECT METRICS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.1,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 10),

          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.5,
            children: [
              _buildKpiCard(
                title: 'Total Projects',
                value: '$totalProjectsCount',
                icon: Icons.folder_outlined,
                color: AppColors.info,
                bgColor: AppColors.infoBg,
                onTap: () => onNavigateTab(1),
              ),
              _buildKpiCard(
                title: 'Active Projects',
                value: '$activeProjectsCount',
                icon: Icons.play_arrow_outlined,
                color: AppColors.primary,
                bgColor: AppColors.primaryBg,
                onTap: () => onNavigateTab(1),
              ),
              _buildKpiCard(
                title: 'Total Tasks',
                value: '$totalTasksCount',
                icon: Icons.task_alt_outlined,
                color: AppColors.purple,
                bgColor: AppColors.purpleBg,
                onTap: () => onNavigateTab(2),
              ),
              _buildKpiCard(
                title: 'Completed',
                value: '$completedTasksCount',
                icon: Icons.check_circle_outline,
                color: AppColors.success,
                bgColor: AppColors.successBg,
                onTap: () => onNavigateTab(2),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Desktop-matching Task Status Breakdown strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildMiniStat('Unassigned', '$unassignedTasksCount', const Color(0xFFEF4444)),
                Container(width: 1, height: 26, color: AppColors.divider),
                _buildMiniStat('In Progress', '$inProgressTasksCount', const Color(0xFF3B82F6)),
                Container(width: 1, height: 26, color: AppColors.divider),
                _buildMiniStat('Completed', '$completedTasksCount', const Color(0xFF10B981)),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Quick Navigation Shortcuts
          const Text(
            'FIELD QUICK ACTIONS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.1,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionTile(
                  icon: Icons.support_agent_outlined,
                  label: 'Service Desk',
                  sub: '${state.tickets.where((t) => t.status != 'CLOSED').length} Open Tickets',
                  color: AppColors.warning,
                  onTap: () => onNavigateTab(3),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionTile(
                  icon: Icons.timeline_rounded,
                  label: 'Activity Feed',
                  sub: '${activities.length} Recent Logs',
                  color: AppColors.primary,
                  onTap: () => onNavigateTab(4),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Recent Activity Section (Replaces Standup)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'RECENT ACTIVITY',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                  color: AppColors.textMuted,
                ),
              ),
              TextButton(
                onPressed: () => onNavigateTab(4),
                child: const Text('View All', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
              ),
            ],
          ),

          if (activities.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: const Center(
                child: Text('No recent project activity yet', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
              ),
            )
          else
            ...activities.take(5).map((item) {
              final actionColor = _getActionColor(item.action);
              final actionIcon = _getActionIcon(item.action);

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: actionColor.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(actionIcon, size: 16, color: actionColor),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                item.userName ?? 'System',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary),
                              ),
                              const Spacer(),
                              Text(
                                _formatDate(item.createdAt),
                                style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.description.isNotEmpty ? item.description : item.action,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (item.projectName != null && item.projectName!.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(Icons.folder_outlined, size: 10, color: AppColors.textMuted),
                                const SizedBox(width: 4),
                                Text(
                                  item.projectName!,
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: AppColors.textMuted),
        ),
      ],
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(8)),
                  child: Icon(icon, color: color, size: 16),
                ),
              ],
            ),
            Text(
              value,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String label,
    required String sub,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(sub, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
