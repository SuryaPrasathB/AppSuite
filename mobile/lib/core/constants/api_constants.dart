
class ApiConstants {
  // Default server address:
  // Android emulator uses 10.0.2.2 to access host machine
  // iOS simulator or physical device on same WiFi uses host IP
  static String get defaultBaseUrl {
    return 'http://localhost:8000';
  }

  static const String serverUrlKey = 'appsuite_server_url';
  
  // Auth endpoints
  static const String loginEndpoint = '/api/auth/login';
  static const String heartbeatEndpoint = '/api/auth/heartbeat';
  
  // Notifications
  static const String notificationsEndpoint = '/api/notifications';
  static const String markAllReadEndpoint = '/api/notifications/read-all';

  // Projects endpoints
  static const String projectsEndpoint = '/api/projects';
  static const String projectStatsEndpoint = '/api/projects/dashboard/stats';
  static const String projectTasksEndpoint = '/api/projects/dashboard/tasks';
  static const String projectActivityEndpoint = '/api/projects/dashboard/activity';
  static const String myOverdueTasksEndpoint = '/api/projects/tasks/my-overdue';
  static const String standupEndpoint = '/api/projects/dashboard/standup';
  static const String allDynamicTasksEndpoint = '/api/projects/all-dynamic-tasks';
  static const String serviceTicketsEndpoint = '/api/projects/service-tickets';
  static const String allServiceTicketsEndpoint = '/api/projects/service-tickets/all';
  static const String myAssignedTicketsEndpoint = '/api/projects/service-tickets/my-assigned';
  static const String employeesEndpoint = '/api/employees';
}
