import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../models/user_model.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class AuthNotifier extends Notifier<AsyncValue<UserModel?>> {
  @override
  AsyncValue<UserModel?> build() {
    Future.microtask(() => checkSession());
    return const AsyncValue.loading();
  }

  Future<void> checkSession() async {
    state = const AsyncValue.loading();
    try {
      final token = await SecureStorageService.getToken();
      final userData = await SecureStorageService.getUser();

      if (token != null && userData != null) {
        state = AsyncValue.data(UserModel.fromJson(userData));
      } else {
        state = const AsyncValue.data(null);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> login(String username, String password) async {
    state = const AsyncValue.loading();
    final apiClient = ref.read(apiClientProvider);
    try {
      final response = await apiClient.post(
        ApiConstants.loginEndpoint,
        data: {
          'username': username.trim(),
          'password': password.trim(),
        },
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final user = UserModel.fromJson(data);
        
        if (data['token'] != null) {
          await SecureStorageService.saveToken(data['token']);
        }
        await SecureStorageService.saveUser(user.toJson());

        state = AsyncValue.data(user);
        return true;
      } else {
        throw Exception(response.data['detail'] ?? 'Login failed');
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<void> logout() async {
    await SecureStorageService.clearAll();
    state = const AsyncValue.data(null);
  }
}

final authProvider = NotifierProvider<AuthNotifier, AsyncValue<UserModel?>>(AuthNotifier.new);
