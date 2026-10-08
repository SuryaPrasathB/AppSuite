import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/project_models.dart';

class ProjectsState {
  final ProjectStatsModel stats;
  final List<ProjectModel> projects;
  final List<DynamicTaskModel> allTasks;
  final List<DynamicTaskModel> myTasks;
  final List<ServiceTicketModel> tickets;
  final List<StandupItemModel> standupItems;
  final List<ProjectActivityModel> activities;
  final bool isLoading;
  final String? error;

  ProjectsState({
    required this.stats,
    this.projects = const [],
    this.allTasks = const [],
    this.myTasks = const [],
    this.tickets = const [],
    this.standupItems = const [],
    this.activities = const [],
    this.isLoading = false,
    this.error,
  });

  ProjectsState copyWith({
    ProjectStatsModel? stats,
    List<ProjectModel>? projects,
    List<DynamicTaskModel>? allTasks,
    List<DynamicTaskModel>? myTasks,
    List<ServiceTicketModel>? tickets,
    List<StandupItemModel>? standupItems,
    List<ProjectActivityModel>? activities,
    bool? isLoading,
    String? error,
  }) {
    return ProjectsState(
      stats: stats ?? this.stats,
      projects: projects ?? this.projects,
      allTasks: allTasks ?? this.allTasks,
      myTasks: myTasks ?? this.myTasks,
      tickets: tickets ?? this.tickets,
      standupItems: standupItems ?? this.standupItems,
      activities: activities ?? this.activities,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ProjectsNotifier extends Notifier<ProjectsState> {
  @override
  ProjectsState build() {
    Future.microtask(() => loadAll());
    return ProjectsState(stats: ProjectStatsModel());
  }

  Future<void> loadAll() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await Future.wait([
        fetchDashboardStats(),
        fetchProjects(),
        fetchMyTasks(),
        fetchServiceTickets(),
        fetchActivities(),
      ]);
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> fetchDashboardStats() async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.get(ApiConstants.projectStatsEndpoint);
      if (res.statusCode == 200 && res.data is Map) {
        final stats = ProjectStatsModel.fromJson(res.data as Map<String, dynamic>);
        state = state.copyWith(stats: stats);
      }
    } catch (_) {}
  }

  Future<void> fetchProjects({String? search, String? status}) async {
    final client = ref.read(apiClientProvider);
    try {
      final queryParams = <String, dynamic>{'limit': 100};
      if (search != null && search.isNotEmpty) queryParams['search'] = search;
      if (status != null && status != 'All' && status != 'ALL') queryParams['status'] = status;

      final res = await client.get(ApiConstants.projectsEndpoint, queryParameters: queryParams);
      if (res.statusCode == 200) {
        final raw = res.data;
        List listData = [];
        if (raw is List) {
          listData = raw;
        } else if (raw is Map) {
          if (raw['data'] is List) {
            listData = raw['data'];
          } else if (raw['projects'] is List) {
            listData = raw['projects'];
          }
        }

        final projects = listData
            .map((e) => ProjectModel.fromJson(e as Map<String, dynamic>))
            .toList();
        state = state.copyWith(projects: projects);
      }
    } catch (e) {
      // ignore or log
    }
  }

  Future<void> fetchMyTasks() async {
    final client = ref.read(apiClientProvider);
    final user = ref.read(authProvider).value;

    try {
      final res = await client.get(ApiConstants.allDynamicTasksEndpoint);
      if (res.statusCode == 200 && res.data is List) {
        final allTasks = (res.data as List)
            .map((e) => DynamicTaskModel.fromJson(e as Map<String, dynamic>))
            .toList();

        List<DynamicTaskModel> myTasks = [];
        if (user != null) {
          final userStr = user.id.toString();
          final userNameLower = user.name.toLowerCase();
          final usernameLower = user.username.toLowerCase();

          myTasks = allTasks.where((t) {
            // Match assigneeId
            if (t.assigneeId != null && t.assigneeId.toString() == userStr) return true;
            // Match assigneeIds list
            if (t.assigneeIds != null && t.assigneeIds!.map((id) => id.toString()).contains(userStr)) return true;
            // Match assignees list
            if (t.assignees.any((a) =>
                a.id.toString() == userStr ||
                a.name.toLowerCase() == userNameLower ||
                a.name.toLowerCase() == usernameLower)) {
              return true;
            }
            // Match assigneeName string
            if (t.assigneeName != null && t.assigneeName!.isNotEmpty) {
              final aName = t.assigneeName!.toLowerCase();
              if (aName == userNameLower ||
                  aName == usernameLower ||
                  aName.contains(userNameLower) ||
                  userNameLower.contains(aName)) {
                return true;
              }
            }
            return false;
          }).toList();
        } else {
          myTasks = allTasks;
        }

        state = state.copyWith(
          allTasks: allTasks,
          myTasks: myTasks,
        );
      }
    } catch (_) {}
  }

  Future<bool> updateTaskStatus(int projectId, int taskId, String newStatus) async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.put(
        '${ApiConstants.projectsEndpoint}/$projectId/dynamic-tasks/$taskId',
        data: {'status': newStatus},
      );
      if (res.statusCode == 200) {
        DynamicTaskModel updateTask(DynamicTaskModel t) {
          if (t.id == taskId) {
            return DynamicTaskModel(
              id: t.id,
              projectId: t.projectId,
              projectName: t.projectName,
              projectCode: t.projectCode,
              title: t.title,
              description: t.description,
              status: newStatus,
              priority: t.priority,
              dueDate: t.dueDate,
              assigneeId: t.assigneeId,
              assigneeIds: t.assigneeIds,
              assigneeName: t.assigneeName,
              assignees: t.assignees,
              commentsCount: t.commentsCount,
            );
          }
          return t;
        }

        final updatedAll = state.allTasks.map(updateTask).toList();
        final updatedMy = state.myTasks.map(updateTask).toList();
        state = state.copyWith(allTasks: updatedAll, myTasks: updatedMy);
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> fetchServiceTickets({String? status}) async {
    final client = ref.read(apiClientProvider);
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status != 'All') queryParams['status'] = status;

      final res = await client.get(
        ApiConstants.allServiceTicketsEndpoint,
        queryParameters: queryParams,
      );
      if (res.statusCode == 200 && res.data is List) {
        final tickets = (res.data as List)
            .map((e) => ServiceTicketModel.fromJson(e as Map<String, dynamic>))
            .toList();
        state = state.copyWith(tickets: tickets);
      }
    } catch (_) {}
  }

  Future<bool> createServiceTicket({
    required String title,
    String? description,
    int? projectId,
    String? customProjectName,
    int? assigneeId,
  }) async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.post(
        ApiConstants.serviceTicketsEndpoint,
        data: {
          'title': title,
          'description': description,
          'project_id': projectId,
          'custom_project_name': customProjectName,
          'assignee_id': assigneeId,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchServiceTickets();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<bool> resolveServiceTicket({
    required int ticketId,
    required String notes,
    List<XFile>? images,
  }) async {
    final client = ref.read(apiClientProvider);
    try {
      final formData = FormData();
      formData.fields.add(MapEntry('notes', notes));

      if (images != null) {
        for (var img in images) {
          final multipart = await MultipartFile.fromFile(img.path, filename: img.name);
          formData.files.add(MapEntry('images', multipart));
        }
      }

      final res = await client.post(
        '${ApiConstants.serviceTicketsEndpoint}/$ticketId/resolve',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );

      if (res.statusCode == 200) {
        await fetchServiceTickets();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> fetchActivities() async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.get(ApiConstants.projectActivityEndpoint);
      if (res.statusCode == 200 && res.data is List) {
        final acts = (res.data as List)
            .map((e) => ProjectActivityModel.fromJson(e as Map<String, dynamic>))
            .toList();
        state = state.copyWith(activities: acts);
      }
    } catch (_) {}
  }

  Future<void> fetchStandup() async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.get(ApiConstants.standupEndpoint);
      if (res.statusCode == 200 && res.data is List) {
        final standup = (res.data as List)
            .map((e) => StandupItemModel.fromJson(e as Map<String, dynamic>))
            .toList();
        state = state.copyWith(standupItems: standup);
      }
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> fetchTaskComments(int projectId, int taskId) async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.get('${ApiConstants.projectsEndpoint}/$projectId/tasks/$taskId/comments');
      if (res.statusCode == 200 && res.data is List) {
        return List<Map<String, dynamic>>.from(res.data);
      }
    } catch (_) {}
    return [];
  }

  Future<bool> addTaskComment(int projectId, int taskId, String content) async {
    final client = ref.read(apiClientProvider);
    try {
      final res = await client.post(
        '${ApiConstants.projectsEndpoint}/$projectId/tasks/$taskId/comments',
        data: {'content': content},
      );
      return res.statusCode == 200 || res.statusCode == 201;
    } catch (_) {}
    return false;
  }
}

final projectsProvider =
    NotifierProvider<ProjectsNotifier, ProjectsState>(ProjectsNotifier.new);
