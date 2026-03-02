// =============================================================================
// lib/core/config/api_config.dart
// Central registry of every URL, path constant, timeout, and
// SharedPreferences key used when talking to the KTI SAP Mock server.
// =============================================================================

class ApiConfig {
  ApiConfig._(); // prevent instantiation

  // ── Base URL ──────────────────────────────────────────────────────────────
  //
  //  Android emulator  → 10.0.2.2 maps to the host machine's localhost
  //  iOS simulator     → uncomment the localhost line below
  //  Physical device   → replace with your machine's LAN IP, e.g. 192.168.1.5
  //  Docker (same LAN) → same LAN IP approach
  //
  static const String baseUrl = 'http://10.0.2.2:3000/api';
  // static const String baseUrl = 'http://localhost:3000/api';       // iOS sim
  // static const String baseUrl = 'http://192.168.1.5:3000/api';    // Physical

  // ── Timeouts ──────────────────────────────────────────────────────────────
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // ── Auth ──────────────────────────────────────────────────────────────────
  static const String login = '/auth/login';

  // ── SPK ───────────────────────────────────────────────────────────────────
  static const String spkList = '/spk';
  static String spkDetail(String id) => '/spk/$id';
  static String spkSubmit(String id) => '/spk/$id/submit';
  static String spkSync(String id)   => '/spk/$id/sync';
  static String spkReset(String id)  => '/spk/$id/reset';

  // ── Lembar Kerja ──────────────────────────────────────────────────────────
  static const String lkList = '/lk';
  static String lkDetail(String id) => '/lk/$id';
  static String lkSubmit(String id) => '/lk/$id/submit';

  // ── Equipment ─────────────────────────────────────────────────────────────
  static const String equipmentList           = '/equipment';
  static String       equipmentDetail(String id) => '/equipment/$id';

  // ── Upload ────────────────────────────────────────────────────────────────
  static const String uploadPhoto = '/upload/photo';

  // ── Submissions (read-only log) ───────────────────────────────────────────
  static const String submissionsList           = '/submissions';
  static String       submissionDetail(String id) => '/submissions/$id';

  // ── SharedPreferences keys ────────────────────────────────────────────────
  static const String tokenKey = 'auth_token';
  static const String userKey  = 'auth_user';
}
