import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/project_models.dart';
import '../../providers/projects_provider.dart';
import '../project_workspace_view.dart';

class ProjectsListTab extends ConsumerStatefulWidget {
  const ProjectsListTab({super.key});

  @override
  ConsumerState<ProjectsListTab> createState() => _ProjectsListTabState();
}

class _ProjectsListTabState extends ConsumerState<ProjectsListTab> {
  // Desktop matching tabs: All Projects, Active, Planning, On Hold, Completed, Service, Cancelled
  String _selectedStatus = 'ALL';
  String _searchQuery = '';
  final Set<int> _expandedProjectIds = {};

  bool _matchesStatus(ProjectModel p) {
    if (_selectedStatus == 'ALL') return true;
    final s = p.status.toUpperCase();
    if (_selectedStatus == 'ACTIVE') {
      return s == 'ACTIVE' || s == 'IN_PROGRESS';
    } else if (_selectedStatus == 'ON_HOLD') {
      return s == 'ON_HOLD' || s == 'HOLD';
    } else if (_selectedStatus == 'COMPLETED') {
      return s == 'COMPLETED' || s == 'DONE';
    } else if (_selectedStatus == 'SERVICE') {
      return s == 'SERVICE';
    } else if (_selectedStatus == 'CANCELLED') {
      return s == 'CANCELLED';
    } else if (_selectedStatus == 'PLANNING') {
      return s == 'PLANNING';
    }
    return true;
  }

  bool _matchesSearch(ProjectModel p) {
    if (_searchQuery.isEmpty) return true;
    final q = _searchQuery.toLowerCase();
    final matchCode = p.code.toLowerCase().contains(q);
    final matchName = p.name.toLowerCase().contains(q);
    final matchClient = (p.clientName ?? '').toLowerCase().contains(q);
    final matchIncharge = (p.projectIncharge ?? '').toLowerCase().contains(q);
    return matchCode || matchName || matchClient || matchIncharge;
  }

  void _toggleExpand(int projectId) {
    setState(() {
      if (_expandedProjectIds.contains(projectId)) {
        _expandedProjectIds.remove(projectId);
      } else {
        _expandedProjectIds.add(projectId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(projectsProvider);
    final allProjects = state.projects;

    // 1. Separate into root projects and subprojects map
    final Map<int, List<ProjectModel>> subprojectsMap = {};
    final List<ProjectModel> rootProjects = [];
    final Set<int> rootProjectIds = {};

    for (final p in allProjects) {
      if (p.parentId == null) {
        rootProjects.add(p);
        rootProjectIds.add(p.id);
      } else {
        subprojectsMap.putIfAbsent(p.parentId!, () => []).add(p);
      }
    }

    // Also collect orphan subprojects (whose parent is not in rootProjects)
    final List<ProjectModel> orphanSubprojects = [];
    for (final p in allProjects) {
      if (p.parentId != null && !rootProjectIds.contains(p.parentId)) {
        orphanSubprojects.add(p);
      }
    }

    // 2. Filter root projects based on search and status
    final List<ProjectModel> filteredRootProjects = rootProjects.where((root) {
      final rootMatches = _matchesStatus(root) && _matchesSearch(root);
      final subs = subprojectsMap[root.id] ?? [];
      final hasMatchingSub = subs.any((sub) => _matchesStatus(sub) && _matchesSearch(sub));
      return rootMatches || hasMatchingSub;
    }).toList();

    final List<ProjectModel> filteredOrphanProjects = orphanSubprojects.where((p) {
      return _matchesStatus(p) && _matchesSearch(p);
    }).toList();

    return RefreshIndicator(
      onRefresh: () => ref.read(projectsProvider.notifier).fetchProjects(),
      color: AppColors.primary,
      backgroundColor: AppColors.card,
      child: Column(
        children: [
          // Filter & Search Header (Matching Web UI)
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search items, projects, employees...',
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

                // Desktop-matching tabs: All Projects, Active, Planning, On Hold, Completed, Service, Cancelled
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildTabChip('All Projects (${rootProjects.length})', 'ALL'),
                      const SizedBox(width: 8),
                      _buildTabChip('Active', 'ACTIVE'),
                      const SizedBox(width: 8),
                      _buildTabChip('Planning', 'PLANNING'),
                      const SizedBox(width: 8),
                      _buildTabChip('On Hold', 'ON_HOLD'),
                      const SizedBox(width: 8),
                      _buildTabChip('Completed', 'COMPLETED'),
                      const SizedBox(width: 8),
                      _buildTabChip('Service', 'SERVICE'),
                      const SizedBox(width: 8),
                      _buildTabChip('Cancelled', 'CANCELLED'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.cardBorder),

          // Hierarchical Projects List
          Expanded(
            child: filteredRootProjects.isEmpty && filteredOrphanProjects.isEmpty
                ? const Center(
                    child: Text('No projects found', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredRootProjects.length + filteredOrphanProjects.length,
                    itemBuilder: (context, index) {
                      if (index < filteredRootProjects.length) {
                        final root = filteredRootProjects[index];
                        final rawSubs = subprojectsMap[root.id] ?? [];
                        // Filter subprojects according to active filter if any
                        final subs = rawSubs.where((sub) {
                          if (_searchQuery.isNotEmpty && !_matchesSearch(sub)) return false;
                          if (_selectedStatus != 'ALL' && !_matchesStatus(sub)) return false;
                          return true;
                        }).toList();

                        final isMajor = root.isParent || rawSubs.isNotEmpty;
                        final isExpanded = _expandedProjectIds.contains(root.id);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Major / Root Project Card
                              _buildMajorProjectCard(
                                project: root,
                                isMajor: isMajor,
                                subprojectsCount: rawSubs.length,
                                isExpanded: isExpanded,
                                onToggleExpand: isMajor ? () => _toggleExpand(root.id) : null,
                              ),

                              // Nested Subprojects (when expanded)
                              if (isMajor && isExpanded && subs.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Padding(
                                  padding: const EdgeInsets.only(left: 20),
                                  child: Column(
                                    children: subs.map((sub) {
                                      return Container(
                                        margin: const EdgeInsets.only(bottom: 8),
                                        child: _buildSubprojectCard(sub),
                                      );
                                    }).toList(),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      } else {
                        // Orphan subproject (display standalone)
                        final orphan = filteredOrphanProjects[index - filteredRootProjects.length];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: _buildSubprojectCard(orphan),
                        );
                      }
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabChip(String label, String key) {
    final isSelected = _selectedStatus == key;
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
      onSelected: (_) => setState(() => _selectedStatus = key),
    );
  }

  Widget _buildMajorProjectCard({
    required ProjectModel project,
    required bool isMajor,
    required int subprojectsCount,
    required bool isExpanded,
    VoidCallback? onToggleExpand,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isMajor ? const Color(0xFFC4B5FD) : AppColors.cardBorder,
          width: isMajor ? 1.5 : 1,
        ),
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
          // Top Section: Title, Code & Status Pill (Tapping expands subprojects if major project)
          InkWell(
            onTap: isMajor
                ? onToggleExpand
                : () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (ctx) => ProjectWorkspaceView(project: project)),
                    );
                  },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Expand/Collapse Chevron (matching desktop table)
                      if (isMajor) ...[
                        InkWell(
                          onTap: onToggleExpand,
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            margin: const EdgeInsets.only(right: 8, top: 2),
                            decoration: BoxDecoration(
                              color: isExpanded ? const Color(0xFFEDE9FE) : AppColors.background,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFDDD6FE)),
                            ),
                            child: Icon(
                              isExpanded ? Icons.keyboard_arrow_down : Icons.chevron_right,
                              size: 18,
                              color: const Color(0xFF7C3AED),
                            ),
                          ),
                        ),
                      ],

                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    project.name,
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: isMajor ? const Color(0xFF5B21B6) : AppColors.textPrimary,
                                    ),
                                  ),
                                ),
                                if (isMajor && subprojectsCount > 0)
                                  InkWell(
                                    onTap: onToggleExpand,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                      margin: const EdgeInsets.only(left: 6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF5F3FF),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFFDDD6FE)),
                                      ),
                                      child: Text(
                                        '$subprojectsCount Subprojects',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF7C3AED),
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              project.code,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Status pill badge
                      _buildStatusPill(project.status),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Metadata row: Client, Incharge, Milestone
                  Row(
                    children: [
                      // Client
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('CLIENT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                            const SizedBox(height: 2),
                            Text(
                              project.clientName ?? '—',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),

                      // Incharge
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('PROJECT INCHARGE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                            const SizedBox(height: 2),
                            Text(
                              project.projectIncharge ?? '—',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),

                      // Milestone badge
                      if (project.milestone != null && project.milestone!.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.milestoneBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.cardBorder),
                          ),
                          child: Text(
                            project.milestone!,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.milestoneText,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const Divider(height: 1, color: AppColors.divider),

            // Bottom Progress & Workspace link
            InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (ctx) => ProjectWorkspaceView(project: project)),
                );
              },
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Tasks: ${project.completedTasks}/${project.totalTasks}',
                                style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                              ),
                              Text(
                                '${(project.progressPercentage * 100).toInt()}%',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: LinearProgressIndicator(
                              value: project.progressPercentage,
                              minHeight: 4,
                              backgroundColor: AppColors.background,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                project.progressPercentage >= 1.0 ? AppColors.success : (isMajor ? const Color(0xFF7C3AED) : AppColors.primary),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    const Row(
                      children: [
                        Text(
                          'Workspace',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                        SizedBox(width: 3),
                        Icon(Icons.arrow_forward_ios, size: 10, color: AppColors.primary),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
  }

  Widget _buildSubprojectCard(ProjectModel project) {
    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (ctx) => ProjectWorkspaceView(project: project)),
        );
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFBFDBFE), width: 1),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Blue accent bar matching desktop border-l-4 border-l-blue-400
              Container(
                width: 4,
                decoration: const BoxDecoration(
                  color: Color(0xFF60A5FA),
                  borderRadius: BorderRadius.horizontal(left: Radius.circular(10)),
                ),
              ),

              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Subproject Title row with CornerDownRight icon
                      Row(
                        children: [
                          const Icon(Icons.subdirectory_arrow_right, size: 16, color: Color(0xFF3B82F6)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  project.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: Color(0xFF1E3A8A),
                                  ),
                                ),
                                Text(
                                  project.code,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: AppColors.textMuted,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                              ],
                            ),
                          ),
                          _buildStatusPill(project.status),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Incharge & Progress
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (project.projectIncharge != null && project.projectIncharge!.isNotEmpty)
                            Text(
                              'Incharge: ${project.projectIncharge}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                            )
                          else
                            const Text('Incharge: —', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),

                          Row(
                            children: [
                              Text(
                                '${(project.progressPercentage * 100).toInt()}%',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                              ),
                              const SizedBox(width: 8),
                              const Text('Workspace', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
                              const SizedBox(width: 2),
                              const Icon(Icons.arrow_forward_ios, size: 9, color: AppColors.primary),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusPill(String status) {
    Color bg = AppColors.planningBg;
    Color text = AppColors.planningText;

    final s = status.toUpperCase();
    if (s == 'ACTIVE' || s == 'IN_PROGRESS') {
      bg = AppColors.successBg;
      text = AppColors.successText;
    } else if (s == 'COMPLETED' || s == 'DONE') {
      bg = AppColors.milestoneBg;
      text = AppColors.textSecondary;
    } else if (s == 'ON_HOLD' || s == 'HOLD') {
      bg = AppColors.warningBg;
      text = AppColors.warningText;
    } else if (s == 'CANCELLED') {
      bg = AppColors.dangerBg;
      text = AppColors.danger;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.bold,
          color: text,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
