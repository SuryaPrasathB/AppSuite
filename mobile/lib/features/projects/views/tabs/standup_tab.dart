import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../providers/projects_provider.dart';

class StandupTab extends ConsumerWidget {
  const StandupTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(projectsProvider);
    final items = state.standupItems;

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showPostStandupDialog(context, ref),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.edit, color: Colors.white),
        label: const Text('Post Standup', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(projectsProvider.notifier).fetchStandup(),
        color: AppColors.primary,
        backgroundColor: AppColors.card,
        child: items.isEmpty
            ? const Center(
                child: Text('No standup entries submitted yet today',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final item = items[index];
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.cardBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 14,
                              backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                              child: Text(
                                item.employeeName.isNotEmpty ? item.employeeName[0].toUpperCase() : 'U',
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                item.employeeName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                              ),
                            ),
                            if (item.date != null)
                              Text(item.date!, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                          ],
                        ),
                        if (item.yesterdayWork != null && item.yesterdayWork!.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          const Text('Yesterday:',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                          const SizedBox(height: 2),
                          Text(item.yesterdayWork!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                        ],
                        if (item.todayWork != null && item.todayWork!.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          const Text('Today:',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
                          const SizedBox(height: 2),
                          Text(item.todayWork!, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                        ],
                        if (item.blockers != null && item.blockers!.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.dangerBg,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.block, size: 14, color: AppColors.danger),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    'Blocker: ${item.blockers}',
                                    style: const TextStyle(fontSize: 12, color: AppColors.danger, fontWeight: FontWeight.w500),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }

  void _showPostStandupDialog(BuildContext context, WidgetRef ref) {
    final yesterdayController = TextEditingController();
    final todayController = TextEditingController();
    final blockersController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Post Daily Standup', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: yesterdayController,
                maxLines: 2,
                decoration: const InputDecoration(hintText: 'What did you complete yesterday?'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: todayController,
                maxLines: 2,
                decoration: const InputDecoration(hintText: 'What are you working on today?'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: blockersController,
                maxLines: 2,
                decoration: const InputDecoration(hintText: 'Any blockers? (Optional)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final client = ref.read(apiClientProvider);
              await client.post(
                ApiConstants.standupEndpoint,
                data: {
                  'yesterday_work': yesterdayController.text.trim(),
                  'today_work': todayController.text.trim(),
                  'blockers': blockersController.text.trim(),
                },
              );
              await ref.read(projectsProvider.notifier).fetchStandup();
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Submit Standup'),
          ),
        ],
      ),
    );
  }
}
