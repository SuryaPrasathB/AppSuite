import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/notification_service.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/notification_item.dart';

class NotificationsState {
  final List<NotificationItem> items;
  final int overdueCount;
  final bool isLoading;
  final String? error;

  NotificationsState({
    this.items = const [],
    this.overdueCount = 0,
    this.isLoading = false,
    this.error,
  });

  int get unreadCount => items.where((n) => !n.isRead).length;

  NotificationsState copyWith({
    List<NotificationItem>? items,
    int? overdueCount,
    bool? isLoading,
    String? error,
  }) {
    return NotificationsState(
      items: items ?? this.items,
      overdueCount: overdueCount ?? this.overdueCount,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class NotificationsNotifier extends Notifier<NotificationsState> {
  Timer? _pollingTimer;
  final Set<int> _notifiedOverdueTaskIds = {};

  @override
  NotificationsState build() {
    ref.onDispose(() {
      _pollingTimer?.cancel();
    });

    Future.microtask(() {
      refreshAll();
      _startPolling();
    });

    return NotificationsState();
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      refreshAll();
    });
  }

  Future<void> refreshAll() async {
    final authState = ref.read(authProvider);
    final user = authState.value;
    if (user == null) return;

    await Future.wait([
      fetchNotifications(),
      checkOverdueAlerts(),
    ]);
  }

  Future<void> fetchNotifications() async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.get(ApiConstants.notificationsEndpoint);
      if (res.statusCode == 200 && res.data is List) {
        final list = (res.data as List)
            .map((e) => NotificationItem.fromJson(e as Map<String, dynamic>))
            .toList();
        state = state.copyWith(items: list);
      }
    } catch (_) {}
  }

  Future<void> checkOverdueAlerts() async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.get(ApiConstants.myOverdueTasksEndpoint);
      if (res.statusCode == 200 && res.data is Map) {
        final data = res.data as Map<String, dynamic>;
        final count = data['count'] is int ? data['count'] as int : 0;
        final tasks = data['tasks'] as List? ?? [];

        state = state.copyWith(overdueCount: count);

        // Fire heads-up local notification for new overdue tasks
        for (var t in tasks) {
          final taskId = t['id'] as int? ?? 0;
          final title = t['title'] as String? ?? 'Task';
          if (taskId > 0 && !_notifiedOverdueTaskIds.contains(taskId)) {
            _notifiedOverdueTaskIds.add(taskId);
            await NotificationService.showNotification(
              id: taskId,
              title: '⚠️ Task Overdue Alert!',
              body: 'Task "$title" has exceeded its deadline. Tap to review.',
              isOverdue: true,
            );
          }
        }
      }
    } catch (_) {}
  }

  Future<void> markRead(int id) async {
    final client = ref.read(apiClientProvider);
    try {
      await client.put('${ApiConstants.notificationsEndpoint}/$id/read');
      final updated = state.items.map((n) {
        if (n.id == id) {
          return NotificationItem(
            id: n.id,
            title: n.title,
            message: n.message,
            link: n.link,
            isRead: true,
            createdAt: n.createdAt,
          );
        }
        return n;
      }).toList();
      state = state.copyWith(items: updated);
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    final client = ref.read(apiClientProvider);
    try {
      await client.put(ApiConstants.markAllReadEndpoint);
      final updated = state.items.map((n) {
        return NotificationItem(
          id: n.id,
          title: n.title,
          message: n.message,
          link: n.link,
          isRead: true,
          createdAt: n.createdAt,
        );
      }).toList();
      state = state.copyWith(items: updated);
    } catch (_) {}
  }
}

final notificationsProvider =
    NotifierProvider<NotificationsNotifier, NotificationsState>(NotificationsNotifier.new);
