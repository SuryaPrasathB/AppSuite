class NotificationItem {
  final int id;
  final String title;
  final String message;
  final String? link;
  final bool isRead;
  final String? createdAt;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    this.link,
    required this.isRead,
    this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] ?? 'Notification',
      message: json['message'] ?? '',
      link: json['link'],
      isRead: json['is_read'] == true || json['is_read'] == 1,
      createdAt: json['created_at'],
    );
  }

  bool get isOverdueAlert =>
      title.toLowerCase().contains('overdue') || message.toLowerCase().contains('overdue');
}
