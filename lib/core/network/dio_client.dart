// =============================================================================
// lib/core/network/dio_client.dart
// Dio singleton configured with:
//   • base URL from ApiConfig
//   • connect / receive timeouts
//   • JWT auth interceptor  (reads token from SharedPreferences)
//   • 401 auto-logout       (clears token so UI redirects to login)
//
// Required pubspec.yaml dependencies:
//   dio: ^5.4.0
//   shared_preferences: ^2.2.0
// =============================================================================

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/api_config.dart';
import '../error/exceptions.dart';

class DioClient {
  DioClient._();

  static final Dio _dio = Dio(
    BaseOptions(
      baseUrl:        ApiConfig.baseUrl,
      connectTimeout: ApiConfig.connectTimeout,
      receiveTimeout: ApiConfig.receiveTimeout,
      headers: {'Content-Type': 'application/json'},
    ),
  )..interceptors.addAll([
      _AuthInterceptor(),
      // Uncomment for verbose HTTP logs during development:
      // LogInterceptor(requestBody: true, responseBody: true),
    ]);

  static Dio get instance => _dio;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attaches the stored JWT to every outgoing request.
// On a 401 response it clears the cached credentials so the AuthController
// (or LoginPage guard) can redirect the user to the login screen.
// ─────────────────────────────────────────────────────────────────────────────
class _AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(ApiConfig.tokenKey);
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Clear stale credentials asynchronously.
      SharedPreferences.getInstance().then((p) {
        p.remove(ApiConfig.tokenKey);
        p.remove(ApiConfig.userKey);
      });
      handler.reject(
        DioException(
          requestOptions: err.requestOptions,
          error:          const UnauthorizedException(),
          type:           err.type,
          response:       err.response,
        ),
      );
      return;
    }
    handler.next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level helper: converts any [DioException] into a typed app exception.
// Call this in every datasource catch block.
// ─────────────────────────────────────────────────────────────────────────────
Exception mapDioException(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return const NetworkException(message: 'Connection timed out.');
    case DioExceptionType.connectionError:
      return const NetworkException(
        message: 'Cannot reach server. '
            'Check your network or server address in ApiConfig.baseUrl.',
      );
    default:
      if (e.error is UnauthorizedException) return e.error as Exception;
      if (e.response?.statusCode == 401) return const UnauthorizedException();
      final msg =
          e.response?.data?['error'] ?? e.message ?? 'Unknown server error';
      return ServerException(
        message:    msg.toString(),
        statusCode: e.response?.statusCode,
      );
  }
}
