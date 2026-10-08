import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/project_models.dart';
import '../../providers/projects_provider.dart';

class ActivityTimelineTab extends ConsumerStatefulWidget {
  const ActivityTimelineTab({super.key});

  @override
  ConsumerState<ActivityTimelineTab> createState() => _ActivityTimelineTabState();
}

class _ActivityTimelineTabState extends ConsumerState<ActivityTimelineTab> {
  String _selectedFilter = 'ALL';
  String _searchQuery = '';

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

  bool _matchesFilter(ProjectActivityModel act) {
    if (_selectedFilter == 'ALL') return true;
    final a = act.action.toUpperCase();
    if (_selectedFilter == 'TASKS') return a.contains('TASK');
    if (_selectedFilter == 'PROJECTS') return a.contains('PROJECT');
    if (_selectedFilter == 'UPDATES') return a.contains('UPDATE') || a.contains('STATUS');
    return true;
  }

  bool _matchesSearch(ProjectActivityModel act) {
    if (_searchQuery.isEmpty) return true;
    final q = _searchQuery.toLowerCase();
    final matchDesc = act.description.toLowerCase().contains(q);
    final matchUser = (act.userName ?? '').toLowerCase().contains(q);
    final matchProj = (act.projectName ?? '').toLowerCase().contains(q);
    final matchAction = act.action.toLowerCase().contains(q);
    return matchDesc || matchUser || matchProj || matchAction;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(projectsProvider);
    final allActivities = state.activities;

    final filtered = allActivities.where((a) => _matchesFilter(a) && _matchesSearch(a)).toList();

    return RefreshIndicator(
      onRefresh: () => ref.read(projectsProvider.notifier).fetchActivities(),
      color: AppColors.primary,
      backgroundColor: AppColors.card,
      child: Column(
        children: [
          // Filter & Search Header
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search activity by user, project, or task...',
                    prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 20),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18, color: AppColors.textMuted),
                            onPressed: () => setState(() => _searchQuery = ''),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('All Activities (${allActivities.length})', 'ALL'),
                      const SizedBox(width: 8),
                      _buildFilterChip('Tasks', 'TASKS'),
                      const SizedBox(width: 8),
                      _buildFilterChip('Projects', 'PROJECTS'),
                      const SizedBox(width: 8),
                      _buildFilterChip('Updates', 'UPDATES'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.cardBorder),

          // Activity Timeline List
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.history_toggle_off_rounded, size: 48, color: AppColors.textMuted.withValues(alpha: 0.5)),
                        const SizedBox(height: 12),
                        const Text(
                          'No activity records found',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 14, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      final actionColor = _getActionColor(item.action);
                      final actionIcon = _getActionIcon(item.action);
                      final isLast = index == filtered.length - 1;

                      return IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Timeline visual line & icon node
                            SizedBox(
                              width: 36,
                              child: Column(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: actionColor.withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: actionColor.withValues(alpha: 0.3), width: 1.5),
                                    ),
                                    child: Icon(actionIcon, size: 14, color: actionColor),
                                  ),
                                  if (!isLast)
                                    Expanded(
                                      child: Container(
                                        width: 1.5,
                                        color: AppColors.cardBorder,
                                        margin: const EdgeInsets.symmetric(vertical: 4),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),

                            // Activity content card
                            Expanded(
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.card,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppColors.cardBorder),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.02),
                                      blurRadius: 4,
                                      offset: const Offset(0, 1),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // User, Action Pill & Timestamp
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          radius: 11,
                                          backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                                          child: Text(
                                            (item.userName != null && item.userName!.isNotEmpty)
                                                ? item.userName![0].toUpperCase()
                                                : 'U',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.primary,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          item.userName ?? 'System',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(
                                          _formatDate(item.createdAt),
                                          style: const TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w500,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),

                                    // Action Description
                                    Text(
                                      item.description.isNotEmpty ? item.description : item.action,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: AppColors.textSecondary,
                                        height: 1.3,
                                      ),
                                    ),
                                    const SizedBox(height: 8),

                                    // Project badge & action type pill
                                    Row(
                                      children: [
                                        if (item.projectName != null && item.projectName!.isNotEmpty) ...[
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: AppColors.background,
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(color: AppColors.cardBorder),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                const Icon(Icons.folder_outlined, size: 10, color: AppColors.textMuted),
                                                const SizedBox(width: 4),
                                                Text(
                                                  item.projectName!,
                                                  style: const TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w600,
                                                    color: AppColors.textSecondary,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                        ],
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: actionColor.withValues(alpha: 0.08),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            item.action.replaceAll('_', ' '),
                                            style: TextStyle(
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                              color: actionColor,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String key) {
    final isSelected = _selectedFilter == key;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? Colors.white : AppColors.textSecondary,
        ),
      ),
      selected: isSelected,
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.background,
      side: BorderSide(color: isSelected ? AppColors.primary : AppColors.cardBorder),
      onSelected: (_) => setState(() => _selectedFilter = key),
    );
  }
}
