import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/project_models.dart';
import '../providers/projects_provider.dart';

class TaskCommentsSheet extends ConsumerStatefulWidget {
  final DynamicTaskModel task;

  const TaskCommentsSheet({super.key, required this.task});

  @override
  ConsumerState<TaskCommentsSheet> createState() => _TaskCommentsSheetState();
}

class _TaskCommentsSheetState extends ConsumerState<TaskCommentsSheet> {
  final _commentController = TextEditingController();
  List<Map<String, dynamic>> _comments = [];
  bool _isLoading = true;
  bool _isPosting = false;

  @override
  void initState() {
    super.initState();
    _loadComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    setState(() => _isLoading = true);
    final comments = await ref
        .read(projectsProvider.notifier)
        .fetchTaskComments(widget.task.projectId, widget.task.id);
    if (mounted) {
      setState(() {
        _comments = comments;
        _isLoading = false;
      });
    }
  }

  Future<void> _addComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isPosting = true);
    final success = await ref
        .read(projectsProvider.notifier)
        .addTaskComment(widget.task.projectId, widget.task.id, text);

    if (mounted) {
      setState(() => _isPosting = false);
      if (success) {
        _commentController.clear();
        _loadComments();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to post comment')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.cardBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Task Discussion & Notes',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.task.title,
                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textMuted, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.cardBorder),

          // Comments List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _comments.isEmpty
                    ? const Center(
                        child: Text('No comments yet. Start the discussion below!',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _comments.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final c = _comments[index];
                          final author = c['author_name'] ?? 'User';
                          final content = c['content'] ?? '';
                          final createdAt = c['created_at']?.toString().split('T').first ?? '';

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.cardBorder),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      author,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                        color: AppColors.primaryLight,
                                      ),
                                    ),
                                    Text(
                                      createdAt,
                                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  content,
                                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),

          // Input Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: AppColors.background,
              border: Border(top: BorderSide(color: AppColors.cardBorder)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    decoration: const InputDecoration(
                      hintText: 'Add an update or note...',
                      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  icon: _isPosting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded, size: 18),
                  onPressed: _isPosting ? null : _addComment,
                  style: IconButton.styleFrom(backgroundColor: AppColors.primary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
