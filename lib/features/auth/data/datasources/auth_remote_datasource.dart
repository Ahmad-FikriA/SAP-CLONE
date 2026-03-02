// =============================================================================
// lib/features/auth/data/datasources/auth_remote_datasource.dart
// Handles login, logout, token persistence, and cached-user retrieval.
//
// Dependencies: dio, shared_preferences
// =============================================================================

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/network/dio_client.dart';

// ── Abstract contract ─────────────────────────────────────────────────────────

abstract class AuthRemoteDataSource {
  /// POST /api/auth/login
  /// Returns the full server response: { token, user }
  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  });

  /// Removes token + user from SharedPreferences.
  Future<void> logout();

  /// Reads the stored JWT, or null when not logged in.
  Future<String?> getToken();

  /// Reads the stored user object, or null when not logged in.
  Future<Map<String, dynamic>?> getCachedUser();

  /// True if a non-empty token exists in SharedPreferences.
  Future<bool> isLoggedIn();
}

// ── Implementation ────────────────────────────────────────────────────────────

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final Dio dio;
  final SharedPreferences prefs;

  AuthRemoteDataSourceImpl({required this.dio, required this.prefs});

  // ── Factory convenience ────────────────────────────────────────────────────
  /// Create with the shared Dio singleton + a freshly-obtained SharedPreferences.
  /// Usage in main.dart or a GetX binding:
  ///   final prefs = await SharedPreferences.getInstance();
  ///   Get.put(AuthRemoteDataSourceImpl(dio: DioClient.instance, prefs: prefs));
  factory AuthRemoteDataSourceImpl.create(SharedPreferences prefs) =>
      AuthRemoteDataSourceImpl(dio: DioClient.instance, prefs: prefs);

  // ── Login ──────────────────────────────────────────────────────────────────
  @override
  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    try {
      final response = await dio.post(
        ApiConfig.login,
        data: {'username': username, 'password': password},
      );
      final data = response.data as Map<String, dynamic>;
      final token = data['token'] as String;
      final user  = data['user']  as Map<String, dynamic>;

      // Persist locally for the auth interceptor + UI usage.
      await Future.wait([
        prefs.setString(ApiConfig.tokenKey, token),
        prefs.setString(ApiConfig.userKey,  jsonEncode(user)),
      ]);

      return data;
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  @override
  Future<void> logout() async {
    await Future.wait([
      prefs.remove(ApiConfig.tokenKey),
      prefs.remove(ApiConfig.userKey),
    ]);
  }

  // ── Token ──────────────────────────────────────────────────────────────────
  @override
  Future<String?> getToken() async => prefs.getString(ApiConfig.tokenKey);

  // ── Cached user ────────────────────────────────────────────────────────────
  @override
  Future<Map<String, dynamic>?> getCachedUser() async {
    final raw = prefs.getString(ApiConfig.userKey);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  @override
  Future<bool> isLoggedIn() async =>
      (prefs.getString(ApiConfig.tokenKey) ?? '').isNotEmpty;
}
