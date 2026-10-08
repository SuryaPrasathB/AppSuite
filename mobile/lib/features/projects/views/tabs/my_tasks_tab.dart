import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/project_models.dart';
import '../../providers/projects_provider.dart';
import '../task_comments_sheet.dart';

class MyTasksTab extends ConsumerStatefulWidget {
  const MyTasksTab({super.key});

  @override
  ConsumerState<MyTasksTab> createState() => _MyTasksTabState();
}

class _MyTasksTabState extends ConsumerState<MyTasksTab> {
  // Date filters matching desktop: 'all', 'today', 'this_week', 'overdue', 'in_progress'
  String _dateFilter = 'all';
  bool _showCompleted = false;
  String _selectedAssignee = 'MY_TASKS'; // 'MY_TASKS', 'ALL', 'UNASSIGNED', or assignee name
  String _searchQuery = '';
  final Set<String> _collapsedProjects = {};

  void _toggleProjectCollapse(String projectName) {
    setState(() {
      if (_collapsedProjects.contains(projectName)) {
        _collapsedProjects.remove(projectName);
      } else {
        _collapsedProjects.add(projectName);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(projectsProvider);
    final authState = ref.watch(authProvider);
    final currentUser = authState.value;
    final allTasks = state.allTasks;

    // Collect unique assignees from all dynamic tasks (matching desktop)
    final Set<String> uniqueAssigneeNames = {};
    for (final t in allTasks) {
      if (t.assignees.isNotEmpty) {
        for (final a in t.assignees) {
          if (a.name.isNotEmpty) uniqueAssigneeNames.add(a.name);
        }
      } else if (t.assigneeName != null && t.assigneeName!.isNotEmpty) {
        uniqueAssigneeNames.add(t.assigneeName!);
      }
    }

    // Filter tasks dynamically
    final filtered = allTasks.where((task) {
      // 1. Completed filter
      if (!_showCompleted && task.isCompleted) return false;

      // 2. Date filter
      if (_dateFilter == 'in_progress' && task.status != 'IN_PROGRESS') return false;
      if (_dateFilter == 'today' && !task.isDueToday) return false;
      if (_dateFilter == 'this_week' && !task.isDueThisWeek) return false;
      if (_dateFilter == 'overdue' && !task.isOverdue) return false;

      // 3. Assignee filter
      if (_selectedAssignee == 'MY_TASKS') {
        if (currentUser != null) {
          final userStr = currentUser.id.toString();
          final userNameLower = currentUser.name.toLowerCase();
          final usernameLower = currentUser.username.toLowerCase();

          final isAssigned = (task.assigneeId != null && task.assigneeId.toString() == userStr) ||
              (task.assigneeIds != null && task.assigneeIds!.map((id) => id.toString()).contains(userStr)) ||
              task.assignees.any((a) =>
                  a.id.toString() == userStr ||
                  a.name.toLowerCase() == userNameLower ||
                  a.name.toLowerCase() == usernameLower) ||
              (task.assigneeName != null &&
                  (task.assigneeName!.toLowerCase() == userNameLower ||
                      task.assigneeName!.toLowerCase() == usernameLower ||
                      task.assigneeName!.toLowerCase().contains(userNameLower) ||
                      userNameLower.contains(task.assigneeName!.toLowerCase())));

          if (!isAssigned) return false;
        }
      } else if (_selectedAssignee == 'UNASSIGNED') {
        final hasAssignee = (task.assigneeName != null && task.assigneeName!.isNotEmpty) ||
            task.assignees.isNotEmpty ||
            task.assigneeId != null;
        if (hasAssignee) return false;
      } else if (_selectedAssignee != 'ALL') {
        // Specific assignee name selected
        final selLower = _selectedAssignee.toLowerCase();
        final matches = (task.assigneeName != null && task.assigneeName!.toLowerCase().contains(selLower)) ||
            task.assignees.any((a) => a.name.toLowerCase() == selLower);
        if (!matches) return false;
      }

      // 4. Search filter
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchTitle = task.title.toLowerCase().contains(q);
        final matchPrj = (task.projectName ?? '').toLowerCase().contains(q);
        final matchAssignee = (task.assigneeName ?? '').toLowerCase().contains(q);
        if (!matchTitle && !matchPrj && !matchAssignee) return false;
      }

      return true;
    }).toList();

    // Group tasks by project name (desktop behavior)
    final Map<String, List<DynamicTaskModel>> groupedTasks = {};
    for (final task in filtered) {
      final proj = task.projectName ?? 'No Project';
      groupedTasks.putIfAbsent(proj, () => []).add(task);
    }

    final overdueCount = allTasks.where((t) => t.isOverdue).length;

    return RefreshIndicator(
      onRefresh: () => ref.read(projectsProvider.notifier).fetchMyTasks(),
      color: AppColors.primary,
      backgroundColor: AppColors.card,
      child: Column(
        children: [
          // Filter Controls Container
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Search Input
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search tasks, projects, assignees...',
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

                // Date Filter Chips (Matching Desktop: All Active, Due Today, Due This Week, Overdue, In Progress)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildDateChip('All Active', 'all'),
                      const SizedBox(width: 8),
                      _buildDateChip('Due Today', 'today'),
                      const SizedBox(width: 8),
                      _buildDateChip('Due This Week', 'this_week'),
                      const SizedBox(width: 8),
                      _buildDateChip(
                        'Overdue ($overdueCount)',
                        'overdue',
                        isAlert: overdueCount > 0,
                      ),
                      const SizedBox(width: 8),
                      _buildDateChip('In Progress', 'in_progress'),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Secondary Row: Assignee Filter & Show Completed Toggle
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Assignee dropdown
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.cardBorder),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedAssignee,
                            isExpanded: true,
                            icon: const Icon(Icons.keyboard_arrow_down, size: 18, color: AppColors.textSecondary),
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedAssignee = val);
                            },
                            items: [
                              DropdownMenuItem(
                                value: 'MY_TASKS',
                                child: Text(
                                  currentUser != null ? 'My Tasks (${currentUser.name})' : 'My Tasks',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const DropdownMenuItem(
                                value: 'ALL',
                                child: Text('All Assignees (Global)', overflow: TextOverflow.ellipsis),
                              ),
                              const DropdownMenuItem(
                                value: 'UNASSIGNED',
                                child: Text('Unassigned', overflow: TextOverflow.ellipsis),
                              ),
                              ...uniqueAssigneeNames
                                  .where((name) =>
                                      currentUser == null || name.toLowerCase() != currentUser.name.toLowerCase())
                                  .map(
                                    (name) => DropdownMenuItem(
                                      value: name,
                                      child: Text(name, overflow: TextOverflow.ellipsis),
                                    ),
                                  ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Show Completed Switch
                    InkWell(
                      onTap: () => setState(() => _showCompleted = !_showCompleted),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                        decoration: BoxDecoration(
                          color: _showCompleted ? AppColors.primaryBg : AppColors.background,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: _showCompleted ? AppColors.primaryLight : AppColors.cardBorder,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _showCompleted ? Icons.check_box : Icons.check_box_outline_blank,
                              size: 16,
                              color: _showCompleted ? AppColors.primary : AppColors.textMuted,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Completed',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _showCompleted ? AppColors.primaryDark : AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.cardBorder),

          // Grouped Tasks List
          Expanded(
            child: groupedTasks.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _dateFilter == 'overdue' ? Icons.check_circle_outline : Icons.task_alt,
                          size: 48,
                          color: _dateFilter == 'overdue' ? AppColors.success : AppColors.textMuted,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _dateFilter == 'overdue' ? 'No overdue tasks! You are all caught up.' : 'No tasks found',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: groupedTasks.keys.length,
                    itemBuilder: (context, index) {
                      final projectName = groupedTasks.keys.elementAt(index);
                      final projectTasks = groupedTasks[projectName]!;
                      final isCollapsed = _collapsedProjects.contains(projectName);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.cardBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Project Header Accordion
                            InkWell(
                              onTap: () => _toggleProjectCollapse(projectName),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: isCollapsed
                                      ? BorderRadius.circular(12)
                                      : const BorderRadius.vertical(top: Radius.circular(12)),
                                  border: isCollapsed ? null : const Border(bottom: BorderSide(color: AppColors.cardBorder)),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: projectName == 'No Project' ? AppColors.background : AppColors.primaryBg,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Icon(
                                        Icons.folder_outlined,
                                        size: 16,
                                        color: projectName == 'No Project' ? AppColors.textMuted : AppColors.primary,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        projectName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                          color: AppColors.textPrimary,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.background,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: AppColors.cardBorder),
                                      ),
                                      child: Text(
                                        '${projectTasks.length} ${projectTasks.length == 1 ? 'task' : 'tasks'}',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Icon(
                                      isCollapsed ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_up,
                                      size: 18,
                                      color: AppColors.textMuted,
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Tasks within project
                            if (!isCollapsed)
                              ListView.separated(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: projectTasks.length,
                                separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.divider),
                                itemBuilder: (ctx, tIdx) {
                                  final task = projectTasks[tIdx];
                                  return _buildTaskItem(task);
                                },
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

  Widget _buildDateChip(String label, String key, {bool isAlert = false}) {
    final isSelected = _dateFilter == key;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: isAlert || isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected
              ? Colors.white
              : (isAlert ? AppColors.danger : AppColors.textSecondary),
        ),
      ),
      selected: isSelected,
      selectedColor: isAlert ? AppColors.danger : AppColors.primary,
      backgroundColor: isAlert ? AppColors.dangerBg : AppColors.background,
      side: BorderSide(
        color: isAlert ? AppColors.danger : (isSelected ? AppColors.primary : AppColors.cardBorder),
      ),
      onSelected: (_) => setState(() => _dateFilter = key),
    );
  }

  Widget _buildTaskItem(DynamicTaskModel task) {
    Color priorityColor = AppColors.info;
    if (task.priority == 'HIGH') priorityColor = AppColors.warning;
    if (task.priority == 'URGENT') priorityColor = AppColors.danger;

    final assigneeDisplay = task.assignees.isNotEmpty
        ? task.assignees.map((a) => a.name).join(', ')
        : (task.assigneeName ?? 'Unassigned');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      color: task.isCompleted ? AppColors.background.withValues(alpha: 0.5) : Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Title & Priority Pill
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  task.title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: task.isCompleted ? AppColors.textMuted : AppColors.textPrimary,
                    decoration: task.isCompleted ? TextDecoration.lineThrough : null,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: priorityColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  task.priority,
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: priorityColor),
                ),
              ),
            ],
          ),

          if (task.description != null && task.description!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              task.description!,
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 8),

          // Metadata row: Due date & Assignee
          Row(
            children: [
              // Due date
              Icon(
                task.isOverdue ? Icons.error_outline : Icons.calendar_today_outlined,
                size: 13,
                color: task.isOverdue ? AppColors.danger : AppColors.textMuted,
              ),
              const SizedBox(width: 4),
              Text(
                task.dueDate != null ? task.dueDate!.split('T').first : 'No due date',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: task.isOverdue ? FontWeight.bold : FontWeight.normal,
                  color: task.isOverdue ? AppColors.danger : AppColors.textSecondary,
                ),
              ),
              if (task.isOverdue) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    'OVERDUE',
                    style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],

              const Spacer(),

              // Assignee pill
              Row(
                children: [
                  const Icon(Icons.person_outline, size: 13, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 120),
                    child: Text(
                      assigneeDisplay,
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Bottom Action Row: Status Selector & Comments Sheet Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Status Pill with dropdown menu
              PopupMenuButton<String>(
                onSelected: (newStatus) {
                  ref.read(projectsProvider.notifier).updateTaskStatus(task.projectId, task.id, newStatus);
                },
                color: Colors.white,
                elevation: 4,
                itemBuilder: (ctx) => [
                  _buildStatusMenuItem('TODO', 'To Do', Icons.circle_outlined, AppColors.textMuted),
                  _buildStatusMenuItem('IN_PROGRESS', 'In Progress', Icons.timelapse, AppColors.warning),
                  _buildStatusMenuItem('REVIEW', 'In Review', Icons.rate_review_outlined, AppColors.purple),
                  _buildStatusMenuItem('COMPLETED', 'Completed', Icons.check_circle, AppColors.success),
                ],
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusBg(task.status),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: _getStatusBorder(task.status)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_getStatusIcon(task.status), size: 12, color: _getStatusColor(task.status)),
                      const SizedBox(width: 5),
                      Text(
                        _getStatusLabel(task.status),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _getStatusColor(task.status),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.keyboard_arrow_down, size: 14, color: _getStatusColor(task.status)),
                    ],
                  ),
                ),
              ),

              // Discussion / Comments button with count badge
              InkWell(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (ctx) => TaskCommentsSheet(task: task),
                  );
                },
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline, size: 14, color: AppColors.primary),
                      const SizedBox(width: 4),
                      Text(
                        task.commentsCount > 0 ? 'Notes (${task.commentsCount})' : 'Notes',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  PopupMenuItem<String> _buildStatusMenuItem(
      String value, String label, IconData icon, Color color) {
    return PopupMenuItem<String>(
      value: value,
      child: Row(
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'COMPLETED':
      case 'DONE':
        return AppColors.successText;
      case 'IN_PROGRESS':
        return AppColors.warningText;
      case 'REVIEW':
        return AppColors.purpleText;
      default:
        return AppColors.textSecondary;
    }
  }

  Color _getStatusBg(String status) {
    switch (status) {
      case 'COMPLETED':
      case 'DONE':
        return AppColors.successBg;
      case 'IN_PROGRESS':
        return AppColors.warningBg;
      case 'REVIEW':
        return AppColors.purpleBg;
      default:
        return AppColors.background;
    }
  }

  Color _getStatusBorder(String status) {
    switch (status) {
      case 'COMPLETED':
      case 'DONE':
        return AppColors.success.withValues(alpha: 0.3);
      case 'IN_PROGRESS':
        return AppColors.warning.withValues(alpha: 0.3);
      case 'REVIEW':
        return AppColors.purple.withValues(alpha: 0.3);
      default:
        return AppColors.cardBorder;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'COMPLETED':
      case 'DONE':
        return Icons.check_circle_rounded;
      case 'IN_PROGRESS':
        return Icons.timelapse;
      case 'REVIEW':
        return Icons.rate_review_outlined;
      default:
        return Icons.circle_outlined;
    }
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'COMPLETED':
      case 'DONE':
        return 'Done';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'REVIEW':
        return 'Review';
      default:
        return 'To Do';
    }
  }
}
