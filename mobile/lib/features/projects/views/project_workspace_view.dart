import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/project_models.dart';
import 'task_comments_sheet.dart';

class ProjectWorkspaceView extends ConsumerStatefulWidget {
  final ProjectModel project;

  const ProjectWorkspaceView({super.key, required this.project});

  @override
  ConsumerState<ProjectWorkspaceView> createState() => _ProjectWorkspaceViewState();
}

class _ProjectWorkspaceViewState extends ConsumerState<ProjectWorkspaceView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<DynamicTaskModel> _projectTasks = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadProjectTasks();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadProjectTasks() async {
    setState(() => _isLoading = true);
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.get('${ApiConstants.projectsEndpoint}/${widget.project.id}/dynamic-tasks');
      if (res.statusCode == 200 && res.data is List) {
        final list = (res.data as List)
            .map((e) => DynamicTaskModel.fromJson(e as Map<String, dynamic>))
            .toList();
        setState(() {
          _projectTasks = list;
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.project.code,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primaryLight),
            ),
            Text(
              widget.project.name,
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primaryLight,
          unselectedLabelColor: AppColors.textMuted,
          tabs: [
            Tab(text: 'Tasks (${_projectTasks.length})'),
            const Tab(text: 'Kanban Board'),
            const Tab(text: 'Project Details'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildTasksListView(),
                _buildKanbanView(),
                _buildProjectDetailsView(),
              ],
            ),
    );
  }

  Widget _buildTasksListView() {
    if (_projectTasks.isEmpty) {
      return const Center(
        child: Text('No tasks created for this project yet.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _projectTasks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final task = _projectTasks[index];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      task.title,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        decoration: task.isCompleted ? TextDecoration.lineThrough : null,
                        color: task.isCompleted ? AppColors.textMuted : AppColors.textPrimary,
                      ),
                    ),
                  ),
                  _buildStatusPill(task),
                ],
              ),
              if (task.description != null && task.description!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  task.description!,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    task.dueDate != null ? 'Due: ${task.dueDate!.split('T').first}' : 'No date',
                    style: TextStyle(
                      fontSize: 11,
                      color: task.isOverdue ? AppColors.danger : AppColors.textMuted,
                      fontWeight: task.isOverdue ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (ctx) => TaskCommentsSheet(task: task),
                      );
                    },
                    icon: const Icon(Icons.chat_bubble_outline, size: 14, color: AppColors.textMuted),
                    label: const Text('Comments', style: TextStyle(fontSize: 11, color: AppColors.primaryLight)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildKanbanView() {
    final columns = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
    final titles = {'TODO': 'To Do', 'IN_PROGRESS': 'In Progress', 'REVIEW': 'Review', 'COMPLETED': 'Done'};

    return ListView.builder(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(12),
      itemCount: columns.length,
      itemBuilder: (context, colIndex) {
        final colKey = columns[colIndex];
        final colTasks = _projectTasks.where((t) => t.status == colKey).toList();

        return Container(
          width: 260,
          margin: const EdgeInsets.only(right: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    titles[colKey]!,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${colTasks.length}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Divider(height: 1, color: AppColors.cardBorder),
              const SizedBox(height: 10),
              Expanded(
                child: colTasks.isEmpty
                    ? const Center(
                        child: Text('No items in this column', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                      )
                    : ListView.separated(
                        itemCount: colTasks.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, tIndex) {
                          final task = colTasks[tIndex];
                          return Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.cardBorder),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  task.title,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                                ),
                                if (task.dueDate != null) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    'Due: ${task.dueDate!.split('T').first}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: task.isOverdue ? AppColors.danger : AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProjectDetailsView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildDetailRow('Project Code', widget.project.code),
              _buildDetailRow('Project Name', widget.project.name),
              _buildDetailRow('Client', widget.project.clientName ?? 'N/A'),
              _buildDetailRow('Project Lead', widget.project.projectIncharge ?? 'N/A'),
              _buildDetailRow('Status', widget.project.status),
              _buildDetailRow('PO Number', widget.project.poNumber ?? 'N/A'),
              _buildDetailRow('Delivery Date', widget.project.dateOfDelivery ?? widget.project.endDate ?? 'N/A'),
              _buildDetailRow('Estimated Budget', '₹${widget.project.budgetEstimated.toStringAsFixed(2)}'),
              _buildDetailRow('Milestone', widget.project.milestone ?? 'General Execution'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
          Text(value, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildStatusPill(DynamicTaskModel task) {
    Color color = AppColors.textMuted;
    if (task.status == 'COMPLETED') color = AppColors.success;
    if (task.status == 'IN_PROGRESS') color = AppColors.warning;
    if (task.status == 'REVIEW') color = AppColors.purple;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        task.status,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color),
      ),
    );
  }
}
