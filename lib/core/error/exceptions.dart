// =============================================================================
// lib/core/error/exceptions.dart
// Typed exception hierarchy for the KTI SmartCare app.
// Every datasource layer throws one of these; the repository layer maps them
// to Failure objects (or re-throws for the controller to display).
// =============================================================================

/// HTTP 4xx / 5xx response from the server.
class ServerException implements Exception {
  final String message;
  final int? statusCode;

  const ServerException({required this.message, this.statusCode});

  @override
  String toString() => 'ServerException[$statusCode]: $message';
}

/// Network-level failure — no internet, DNS, connection refused, or timeout.
class NetworkException implements Exception {
  final String message;

  const NetworkException({required this.message});

  @override
  String toString() => 'NetworkException: $message';
}

/// HTTP 401 — token missing, expired, or wrong credentials.
class UnauthorizedException implements Exception {
  final String message;

  const UnauthorizedException(
      {this.message = 'Unauthorized. Please log in again.'});

  @override
  String toString() => 'UnauthorizedException: $message';
}

/// SharedPreferences / local-cache failure.
class CacheException implements Exception {
  final String message;

  const CacheException({required this.message});

  @override
  String toString() => 'CacheException: $message';
}
