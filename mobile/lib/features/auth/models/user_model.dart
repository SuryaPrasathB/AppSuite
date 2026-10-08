class UserModel {
  final int id;
  final String username;
  final String name;
  final String role;
  final String? email;
  final String? department;
  final String presenceStatus;
  final String? token;

  UserModel({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    this.email,
    this.department,
    this.presenceStatus = 'online',
    this.token,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      username: json['username'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? 'Employee',
      email: json['email'],
      department: json['department'],
      presenceStatus: json['presence_status'] ?? 'online',
      token: json['token'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'name': name,
      'role': role,
      'email': email,
      'department': department,
      'presence_status': presenceStatus,
      'token': token,
    };
  }

  bool get isAdmin => role == 'Administrator';
  bool get isStoreOperator => role == 'Store Operator' || role == 'Store Manager';
}
