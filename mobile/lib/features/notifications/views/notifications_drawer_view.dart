import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../models/notification_item.dart';
import '../providers/notifications_provider.dart';

class NotificationsModalSheet extends ConsumerStatefulWidget {
  const NotificationsModalSheet({super.key});

  @override
  ConsumerState<NotificationsModalSheet> createState() => _NotificationsModalSheetState();
}

class _NotificationsModalSheetState extends ConsumerState<NotificationsModalSheet> {
  String _filter = 'ALL'; // ALL, UNREAD, OVERDUE

  @override
  Widget build(BuildContext context) {
    final notifState = ref.watch(notificationsProvider);

    List<NotificationItem> filtered = notifState.items;
    if (_filter == 'UNREAD') {
      filtered = filtered.where((n) => !n.isRead).toList();
    } else if (_filter == 'OVERDUE') {
      filtered = filtered.where((n) => n.isOverdueAlert).toList();
    }

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: const BoxDecoration(
        color: AppColors.background,
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
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.notifications_active_outlined, color: AppColors.primaryLight, size: 22),
                    const SizedBox(width: 8),
                    const Text(
                      'Notifications & Alerts',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    if (notifState.unreadCount > 0) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${notifState.unreadCount}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                    ],
                  ],
                ),
                TextButton(
                  onPressed: () => ref.read(notificationsProvider.notifier).markAllRead(),
                  child: const Text('Mark all read', style: TextStyle(fontSize: 12, color: AppColors.primaryLight)),
                ),
              ],
            ),
          ),

          // Filter chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                _buildFilterChip('All (${notifState.items.length})', 'ALL'),
                const SizedBox(width: 8),
                _buildFilterChip('Unread (${notifState.unreadCount})', 'UNREAD'),
                const SizedBox(width: 8),
                _buildFilterChip('Overdue (${notifState.overdueCount})', 'OVERDUE'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.cardBorder),

          // Notifications List
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.notifications_off_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text(
                          'No notifications found',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 14),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      final isOverdue = item.isOverdueAlert;

                      return InkWell(
                        onTap: () {
                          if (!item.isRead) {
                            ref.read(notificationsProvider.notifier).markRead(item.id);
                          }
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: item.isRead ? AppColors.card : AppColors.primaryBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isOverdue
                                  ? AppColors.danger.withValues(alpha: 0.6)
                                  : (item.isRead ? AppColors.cardBorder : AppColors.primaryLight.withValues(alpha: 0.4)),
                              width: item.isRead ? 1 : 1.5,
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isOverdue
                                      ? AppColors.dangerBg
                                      : AppColors.primary.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(
                                  isOverdue ? Icons.warning_amber_rounded : Icons.info_outline,
                                  color: isOverdue ? AppColors.danger : AppColors.primaryLight,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            item.title,
                                            style: TextStyle(
                                              fontWeight: item.isRead ? FontWeight.w500 : FontWeight.bold,
                                              fontSize: 14,
                                              color: isOverdue ? AppColors.danger : AppColors.textPrimary,
                                            ),
                                          ),
                                        ),
                                        if (item.createdAt != null)
                                          Text(
                                            item.createdAt!.split('T').first,
                                            style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.message,
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filter == value;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 11, color: isSelected ? Colors.white : AppColors.textSecondary)),
      selected: isSelected,
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.card,
      onSelected: (_) => setState(() => _filter = value),
    );
  }
}
