// =============================================================================
// lib/features/preventive/data/datasources/preventive_remote_datasource.dart
// Full CRUD + workflow operations for SPK, Lembar Kerja, and Equipment.
//
// All methods return raw Map / List<Map> so you can parse them
// into your own model classes (no hard dependency on a specific model layer).
//
// API endpoint reference  →  README.md in the SAP-CLONE server project
// Dependencies: dio, path (for photo upload)
// =============================================================================

import 'package:dio/dio.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/network/dio_client.dart';

// ── Abstract contract ─────────────────────────────────────────────────────────

abstract class PreventiveRemoteDataSource {
  // ─── SPK ──────────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getSpkList({
    String? category, // pompa | panel | blower | grease-trap | ...
    String? status,   // pending | in_progress | completed
  });

  Future<Map<String, dynamic>> getSpkDetail(String id);

  Future<Map<String, dynamic>> createSpk(Map<String, dynamic> data);

  Future<Map<String, dynamic>> updateSpk(
      String id, Map<String, dynamic> data);

  Future<void> deleteSpk(String id);

  /// Submit an SPK with activity results.
  /// [submitData] shape: { activityResults: { actId: { value, photo?, note? } } }
  Future<Map<String, dynamic>> submitSpk(
      String id, Map<String, dynamic> submitData);

  /// Sync a completed SPK — mock returns { message, spkNumber, syncedAt }.
  Future<Map<String, dynamic>> syncSpk(String id);

  // ─── Lembar Kerja ─────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getLkList({
    String? category,
    String? status, // active | completed | archived
  });

  Future<Map<String, dynamic>> getLkDetail(String id);

  Future<Map<String, dynamic>> createLk(Map<String, dynamic> data);

  Future<Map<String, dynamic>> updateLk(
      String id, Map<String, dynamic> data);

  Future<void> deleteLk(String id);

  /// Mark an LK as submitted/completed.
  Future<Map<String, dynamic>> submitLk(String id);

  // ─── Equipment ────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getEquipmentList({String? category});

  Future<Map<String, dynamic>> createEquipment(Map<String, dynamic> data);

  Future<Map<String, dynamic>> updateEquipment(
      String id, Map<String, dynamic> data);

  Future<void> deleteEquipment(String id);

  // ─── Upload ───────────────────────────────────────────────────────────────
  /// Upload a photo file; returns { path: "uploads/<filename>" }.
  Future<Map<String, dynamic>> uploadPhoto(String localFilePath);
}

// ── Implementation ────────────────────────────────────────────────────────────

class PreventiveRemoteDataSourceImpl implements PreventiveRemoteDataSource {
  final Dio dio;

  PreventiveRemoteDataSourceImpl({required this.dio});

  /// Convenience factory — uses the shared Dio singleton.
  factory PreventiveRemoteDataSourceImpl.create() =>
      PreventiveRemoteDataSourceImpl(dio: DioClient.instance);

  // ── Generic helpers ────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _toList(dynamic data) =>
      (data as List).cast<Map<String, dynamic>>();

  Map<String, dynamic> _toMap(dynamic data) =>
      data as Map<String, dynamic>;

  // ── SPK ───────────────────────────────────────────────────────────────────

  @override
  Future<List<Map<String, dynamic>>> getSpkList({
    String? category,
    String? status,
  }) async {
    try {
      final response = await dio.get(
        ApiConfig.spkList,
        queryParameters: {
          if (category != null && category.isNotEmpty) 'category': category,
          if (status   != null && status.isNotEmpty)   'status':   status,
        },
      );
      return _toList(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> getSpkDetail(String id) async {
    try {
      final response = await dio.get(ApiConfig.spkDetail(id));
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> createSpk(Map<String, dynamic> data) async {
    try {
      final response = await dio.post(ApiConfig.spkList, data: data);
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> updateSpk(
      String id, Map<String, dynamic> data) async {
    try {
      final response = await dio.put(ApiConfig.spkDetail(id), data: data);
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<void> deleteSpk(String id) async {
    try {
      await dio.delete(ApiConfig.spkDetail(id));
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> submitSpk(
      String id, Map<String, dynamic> submitData) async {
    try {
      final response =
          await dio.post(ApiConfig.spkSubmit(id), data: submitData);
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> syncSpk(String id) async {
    try {
      final response = await dio.post(ApiConfig.spkSync(id));
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  // ── Lembar Kerja ──────────────────────────────────────────────────────────

  @override
  Future<List<Map<String, dynamic>>> getLkList({
    String? category,
    String? status,
  }) async {
    try {
      final response = await dio.get(
        ApiConfig.lkList,
        queryParameters: {
          if (category != null && category.isNotEmpty) 'category': category,
          if (status   != null && status.isNotEmpty)   'status':   status,
        },
      );
      return _toList(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> getLkDetail(String id) async {
    try {
      final response = await dio.get(ApiConfig.lkDetail(id));
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> createLk(Map<String, dynamic> data) async {
    try {
      final response = await dio.post(ApiConfig.lkList, data: data);
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> updateLk(
      String id, Map<String, dynamic> data) async {
    try {
      final response = await dio.put(ApiConfig.lkDetail(id), data: data);
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<void> deleteLk(String id) async {
    try {
      await dio.delete(ApiConfig.lkDetail(id));
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> submitLk(String id) async {
    try {
      final response = await dio.post(ApiConfig.lkSubmit(id));
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  // ── Equipment ─────────────────────────────────────────────────────────────

  @override
  Future<List<Map<String, dynamic>>> getEquipmentList(
      {String? category}) async {
    try {
      final response = await dio.get(
        ApiConfig.equipmentList,
        queryParameters: {
          if (category != null && category.isNotEmpty) 'category': category,
        },
      );
      return _toList(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> createEquipment(
      Map<String, dynamic> data) async {
    try {
      final response = await dio.post(ApiConfig.equipmentList, data: data);
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> updateEquipment(
      String id, Map<String, dynamic> data) async {
    try {
      final response =
          await dio.put(ApiConfig.equipmentDetail(id), data: data);
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<void> deleteEquipment(String id) async {
    try {
      await dio.delete(ApiConfig.equipmentDetail(id));
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  // ── Photo Upload ──────────────────────────────────────────────────────────

  @override
  Future<Map<String, dynamic>> uploadPhoto(String localFilePath) async {
    try {
      final formData = FormData.fromMap({
        'photo': await MultipartFile.fromFile(
          localFilePath,
          filename: localFilePath.split('/').last,
        ),
      });
      final response = await dio.post(
        ApiConfig.uploadPhoto,
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      return _toMap(response.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
