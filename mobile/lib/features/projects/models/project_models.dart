class ProjectModel {
  final int id;
  final String code;
  final String name;
  final String? poNumber;
  final String? clientName;
  final String? projectIncharge;
  final String status;
  final String? startDate;
  final String? endDate;
  final String? dateOfDelivery;
  final double budgetEstimated;
  final double budgetActual;
  final int? parentId;
  final bool isParent;
  final String? milestone;
  final int totalTasks;
  final int completedTasks;

  final double completionPercentage;
  final int subProjectsCount;

  ProjectModel({
    required this.id,
    required this.code,
    required this.name,
    this.poNumber,
    this.clientName,
    this.projectIncharge,
    required this.status,
    this.startDate,
    this.endDate,
    this.dateOfDelivery,
    this.budgetEstimated = 0.0,
    this.budgetActual = 0.0,
    this.parentId,
    this.isParent = false,
    this.milestone,
    this.totalTasks = 0,
    this.completedTasks = 0,
    this.completionPercentage = 0.0,
    this.subProjectsCount = 0,
  });

  factory ProjectModel.fromJson(Map<String, dynamic> json) {
    final totalDynamic = (json['total_dynamic_tasks'] as num?)?.toInt() ?? 0;
    final totalStatic = (json['total_static_tasks'] as num?)?.toInt() ?? 0;
    final compDynamic = (json['completed_dynamic_tasks'] as num?)?.toInt() ?? 0;
    final compStatic = (json['completed_static_tasks'] as num?)?.toInt() ?? 0;

    final parsedTotal = json['total_tasks'] is int
        ? json['total_tasks']
        : int.tryParse(json['total_tasks']?.toString() ?? '') ?? (totalDynamic + totalStatic);

    final parsedCompleted = json['completed_tasks'] is int
        ? json['completed_tasks']
        : int.tryParse(json['completed_tasks']?.toString() ?? '') ?? (compDynamic + compStatic);

    final subCount = (json['sub_projects_count'] as num?)?.toInt() ?? 0;

    return ProjectModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      code: json['code'] ?? '',
      name: json['name'] ?? '',
      poNumber: json['po_number'],
      clientName: json['client_name'],
      projectIncharge: json['project_incharge'],
      status: json['status'] ?? 'PLANNING',
      startDate: json['start_date'],
      endDate: json['end_date'],
      dateOfDelivery: json['date_of_delivery'],
      budgetEstimated: (json['budget_estimated'] as num?)?.toDouble() ?? 0.0,
      budgetActual: (json['budget_actual'] as num?)?.toDouble() ?? 0.0,
      parentId: json['parent_id'] is int ? json['parent_id'] : int.tryParse(json['parent_id']?.toString() ?? ''),
      isParent: json['is_parent'] == true || json['is_parent'] == 1 || subCount > 0,
      milestone: json['milestone'],
      totalTasks: parsedTotal,
      completedTasks: parsedCompleted,
      completionPercentage: (json['completion_percentage'] as num?)?.toDouble() ?? 0.0,
      subProjectsCount: subCount,
    );
  }

  double get progressPercentage {
    if (completionPercentage > 0) return (completionPercentage / 100.0).clamp(0.0, 1.0);
    if (totalTasks == 0) return 0.0;
    return (completedTasks / totalTasks).clamp(0.0, 1.0);
  }
}

class TaskAssigneeModel {
  final int id;
  final String name;
  final String? role;

  TaskAssigneeModel({
    required this.id,
    required this.name,
    this.role,
  });

  factory TaskAssigneeModel.fromJson(Map<String, dynamic> json) {
    return TaskAssigneeModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? '',
      role: json['role'],
    );
  }
}

class DynamicTaskModel {
  final int id;
  final int projectId;
  final String? projectName;
  final String? projectCode;
  final String title;
  final String? description;
  final String status; // TODO, IN_PROGRESS, REVIEW, COMPLETED
  final String priority; // LOW, MEDIUM, HIGH, URGENT
  final String? dueDate;
  final int? assigneeId;
  final List<dynamic>? assigneeIds;
  final String? assigneeName;
  final List<TaskAssigneeModel> assignees;
  final int commentsCount;

  DynamicTaskModel({
    required this.id,
    required this.projectId,
    this.projectName,
    this.projectCode,
    required this.title,
    this.description,
    required this.status,
    this.priority = 'MEDIUM',
    this.dueDate,
    this.assigneeId,
    this.assigneeIds,
    this.assigneeName,
    this.assignees = const [],
    this.commentsCount = 0,
  });

  factory DynamicTaskModel.fromJson(Map<String, dynamic> json) {
    List<TaskAssigneeModel> assigneesList = [];
    if (json['assignees'] is List) {
      assigneesList = (json['assignees'] as List)
          .whereType<Map<String, dynamic>>()
          .map((a) => TaskAssigneeModel.fromJson(a))
          .toList();
    } else if (json['assignee_name'] != null && (json['assignee_name'] as String).isNotEmpty) {
      assigneesList.add(
        TaskAssigneeModel(
          id: json['assignee_id'] is int ? json['assignee_id'] : int.tryParse(json['assignee_id']?.toString() ?? '') ?? 0,
          name: json['assignee_name'],
          role: json['assignee_role'],
        ),
      );
    }

    final commentCount = json['comment_count'] ?? json['comments_count'];

    return DynamicTaskModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      projectId: json['project_id'] is int ? json['project_id'] : int.tryParse(json['project_id'].toString()) ?? 0,
      projectName: json['project_name'],
      projectCode: json['project_code'],
      title: json['title'] ?? '',
      description: json['description'],
      status: (json['status'] ?? 'TODO').toString().toUpperCase(),
      priority: (json['priority'] ?? 'MEDIUM').toString().toUpperCase(),
      dueDate: json['due_date'],
      assigneeId: json['assignee_id'] is int ? json['assignee_id'] : int.tryParse(json['assignee_id']?.toString() ?? ''),
      assigneeIds: json['assignee_ids'] is List ? json['assignee_ids'] : null,
      assigneeName: json['assignee_name'],
      assignees: assigneesList,
      commentsCount: commentCount is int ? commentCount : int.tryParse(commentCount?.toString() ?? '0') ?? 0,
    );
  }

  bool get isCompleted => status == 'COMPLETED' || status == 'DONE';

  bool get isOverdue {
    if (isCompleted || dueDate == null || dueDate!.isEmpty) return false;
    try {
      final cleanDate = dueDate!.split('T').first;
      final due = DateTime.parse(cleanDate);
      final today = DateTime.now();
      final todayOnly = DateTime(today.year, today.month, today.day);
      return due.isBefore(todayOnly);
    } catch (_) {
      return false;
    }
  }

  bool get isDueToday {
    if (isCompleted || dueDate == null || dueDate!.isEmpty) return false;
    try {
      final cleanDate = dueDate!.split('T').first;
      final due = DateTime.parse(cleanDate);
      final today = DateTime.now();
      return due.year == today.year && due.month == today.month && due.day == today.day;
    } catch (_) {
      return false;
    }
  }

  bool get isDueThisWeek {
    if (isCompleted || dueDate == null || dueDate!.isEmpty) return false;
    try {
      final cleanDate = dueDate!.split('T').first;
      final due = DateTime.parse(cleanDate);
      final today = DateTime.now();
      final startOfWeek = DateTime(today.year, today.month, today.day - (today.weekday - 1));
      final endOfWeek = startOfWeek.add(const Duration(days: 7));
      return (due.isAtSameMomentAs(startOfWeek) || due.isAfter(startOfWeek)) && due.isBefore(endOfWeek);
    } catch (_) {
      return false;
    }
  }
}

class ServiceTicketModel {
  final int id;
  final String title;
  final String? description;
  final int? projectId;
  final String? projectName;
  final String? customProjectName;
  final String status; // OPEN, IN_PROGRESS, CLOSED
  final int? assigneeId;
  final String? assigneeName;
  final int? creatorId;
  final String? resolutionNotes;
  final List<dynamic>? resolutionImages;
  final String? createdAt;
  final String? updatedAt;

  ServiceTicketModel({
    required this.id,
    required this.title,
    this.description,
    this.projectId,
    this.projectName,
    this.customProjectName,
    required this.status,
    this.assigneeId,
    this.assigneeName,
    this.creatorId,
    this.resolutionNotes,
    this.resolutionImages,
    this.createdAt,
    this.updatedAt,
  });

  factory ServiceTicketModel.fromJson(Map<String, dynamic> json) {
    List<dynamic>? images;
    if (json['resolution_images'] != null) {
      if (json['resolution_images'] is List) {
        images = json['resolution_images'];
      }
    }

    return ServiceTicketModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] ?? 'Ticket #${json['id']}',
      description: json['description'],
      projectId: json['project_id'] is int ? json['project_id'] : int.tryParse(json['project_id']?.toString() ?? ''),
      projectName: json['project_name'],
      customProjectName: json['custom_project_name'],
      status: (json['status'] ?? 'OPEN').toString().toUpperCase(),
      assigneeId: json['assignee_id'] is int ? json['assignee_id'] : int.tryParse(json['assignee_id']?.toString() ?? ''),
      assigneeName: json['assignee_name'],
      creatorId: json['creator_id'] is int ? json['creator_id'] : int.tryParse(json['creator_id']?.toString() ?? ''),
      resolutionNotes: json['resolution_notes'],
      resolutionImages: images,
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}

class StandupItemModel {
  final int id;
  final int employeeId;
  final String employeeName;
  final String? yesterdayWork;
  final String? todayWork;
  final String? blockers;
  final String? date;

  StandupItemModel({
    required this.id,
    required this.employeeId,
    required this.employeeName,
    this.yesterdayWork,
    this.todayWork,
    this.blockers,
    this.date,
  });

  factory StandupItemModel.fromJson(Map<String, dynamic> json) {
    return StandupItemModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      employeeId: json['employee_id'] is int ? json['employee_id'] : int.tryParse(json['employee_id'].toString()) ?? 0,
      employeeName: json['employee_name'] ?? 'Team Member',
      yesterdayWork: json['yesterday_work'],
      todayWork: json['today_work'],
      blockers: json['blockers'],
      date: json['date'],
    );
  }
}

class ProjectStatsModel {
  final int totalProjects;
  final int activeProjects;
  final int completedProjects;
  final int planningProjects;
  final int totalTasks;
  final int completedTasks;
  final int inProgressTasks;
  final int unassignedTasks;
  final int pendingTasks;
  final int overdueTasks;

  ProjectStatsModel({
    this.totalProjects = 0,
    this.activeProjects = 0,
    this.completedProjects = 0,
    this.planningProjects = 0,
    this.totalTasks = 0,
    this.completedTasks = 0,
    this.inProgressTasks = 0,
    this.unassignedTasks = 0,
    this.pendingTasks = 0,
    this.overdueTasks = 0,
  });

  factory ProjectStatsModel.fromJson(Map<String, dynamic> json) {
    final counters = json['counters'] as Map<String, dynamic>?;
    final unassigned = (counters?['unassigned'] as num?)?.toInt() ?? (json['unassigned_tasks'] as num?)?.toInt() ?? 0;
    final inProgress = (counters?['in_progress'] as num?)?.toInt() ?? (json['in_progress_tasks'] as num?)?.toInt() ?? 0;
    final pending = (counters?['pending'] as num?)?.toInt() ?? (json['pending_tasks'] as num?)?.toInt() ?? 0;
    final completed = (counters?['completed'] as num?)?.toInt() ?? (json['completed_tasks'] as num?)?.toInt() ?? 0;
    final computedTotalTasks = unassigned + inProgress + pending + completed;

    return ProjectStatsModel(
      totalProjects: (json['total_projects'] as num?)?.toInt() ?? 0,
      activeProjects: (json['active_projects'] as num?)?.toInt() ?? 0,
      completedProjects: (json['completed_projects'] as num?)?.toInt() ?? 0,
      planningProjects: (json['planning_projects'] as num?)?.toInt() ?? 0,
      totalTasks: (json['total_tasks'] as num?)?.toInt() ?? computedTotalTasks,
      completedTasks: completed,
      inProgressTasks: inProgress,
      unassignedTasks: unassigned,
      pendingTasks: pending,
      overdueTasks: (json['overdue_tasks'] as num?)?.toInt() ?? 0,
    );
  }
}

class ProjectActivityModel {
  final int id;
  final int? projectId;
  final String? projectName;
  final String action;
  final String description;
  final int? userId;
  final String? userName;
  final String createdAt;

  ProjectActivityModel({
    required this.id,
    this.projectId,
    this.projectName,
    required this.action,
    required this.description,
    this.userId,
    this.userName,
    required this.createdAt,
  });

  factory ProjectActivityModel.fromJson(Map<String, dynamic> json) {
    return ProjectActivityModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      projectId: json['project_id'] is int ? json['project_id'] : int.tryParse(json['project_id']?.toString() ?? ''),
      projectName: json['project_name'],
      action: json['action'] ?? '',
      description: json['description'] ?? '',
      userId: json['user_id'] is int ? json['user_id'] : int.tryParse(json['user_id']?.toString() ?? ''),
      userName: json['user_name'] ?? 'System',
      createdAt: json['created_at'] ?? '',
    );
  }
}
