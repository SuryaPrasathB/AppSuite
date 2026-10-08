import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';

class SecureStorageService {
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  
  static const String _tokenKey = 'appsuite_auth_token';
  static const String _userKey = 'appsuite_user_data';

  // Token management
  static Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    return await _secureStorage.read(key: _tokenKey);
  }

  static Future<void> deleteToken() async {
    await _secureStorage.delete(key: _tokenKey);
  }

  // User details management
  static Future<void> saveUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user));
  }

  static Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString(_userKey);
    if (userStr != null) {
      try {
        return jsonDecode(userStr) as Map<String, dynamic>;
      } catch (_) {}
    }
    return null;
  }

  // Base URL configuration (e.g. user pointing to physical server IP)
  static Future<void> saveBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConstants.serverUrlKey, url);
  }

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString(ApiConstants.serverUrlKey);
    return url ?? ApiConstants.defaultBaseUrl;
  }

  // Clear all on logout
  static Future<void> clearAll() async {
    await _secureStorage.delete(key: _tokenKey);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
  }
}
