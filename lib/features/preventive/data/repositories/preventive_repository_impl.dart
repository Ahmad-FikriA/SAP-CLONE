// =============================================================================
// lib/features/preventive/data/repositories/preventive_repository_impl.dart
//
// Implements the preventive-maintenance repository contract by delegating to
// PreventiveRemoteDataSource. All network/server exceptions bubble up as-is so
// the controller layer can display them.
//
// If your project uses dartz Either<Failure, T>, wrap each try/catch block
// in Left(mapExceptionToFailure(e)) / Right(result) instead of rethrowing.
// =============================================================================

import '../datasources/preventive_remote_datasource.dart';

// ── Abstract repository (domain layer) ───────────────────────────────────────
// Paste this into  lib/features/preventive/domain/repositories/
// or keep it co-located here and import from there.

abstract class PreventiveRepository {
  // SPK
  Future<List<Map<String, dynamic>>> getSpkList({String? category, String? status});
  Future<Map<String, dynamic>> getSpkDetail(String id);
  Future<Map<String, dynamic>> createSpk(Map<String, dynamic> data);
  Future<Map<String, dynamic>> updateSpk(String id, Map<String, dynamic> data);
  Future<void> deleteSpk(String id);
  Future<Map<String, dynamic>> submitSpk(String id, Map<String, dynamic> submitData);
  Future<Map<String, dynamic>> syncSpk(String id);

  // Lembar Kerja
  Future<List<Map<String, dynamic>>> getLkList({String? category, String? status});
  Future<Map<String, dynamic>> getLkDetail(String id);
  Future<Map<String, dynamic>> createLk(Map<String, dynamic> data);
  Future<Map<String, dynamic>> updateLk(String id, Map<String, dynamic> data);
  Future<void> deleteLk(String id);
  Future<Map<String, dynamic>> submitLk(String id);

  // Equipment
  Future<List<Map<String, dynamic>>> getEquipmentList({String? category});
  Future<Map<String, dynamic>> createEquipment(Map<String, dynamic> data);
  Future<Map<String, dynamic>> updateEquipment(String id, Map<String, dynamic> data);
  Future<void> deleteEquipment(String id);

  // Upload
  Future<Map<String, dynamic>> uploadPhoto(String localFilePath);
}

// ── Concrete implementation ───────────────────────────────────────────────────

class PreventiveRepositoryImpl implements PreventiveRepository {
  final PreventiveRemoteDataSource _remote;

  const PreventiveRepositoryImpl(this._remote);

  // ── SPK ───────────────────────────────────────────────────────────────────

  @override
  Future<List<Map<String, dynamic>>> getSpkList({
    String? category,
    String? status,
  }) =>
      _remote.getSpkList(category: category, status: status);

  @override
  Future<Map<String, dynamic>> getSpkDetail(String id) =>
      _remote.getSpkDetail(id);

  @override
  Future<Map<String, dynamic>> createSpk(Map<String, dynamic> data) =>
      _remote.createSpk(data);

  @override
  Future<Map<String, dynamic>> updateSpk(
          String id, Map<String, dynamic> data) =>
      _remote.updateSpk(id, data);

  @override
  Future<void> deleteSpk(String id) => _remote.deleteSpk(id);

  @override
  Future<Map<String, dynamic>> submitSpk(
          String id, Map<String, dynamic> submitData) =>
      _remote.submitSpk(id, submitData);

  @override
  Future<Map<String, dynamic>> syncSpk(String id) => _remote.syncSpk(id);

  // ── Lembar Kerja ──────────────────────────────────────────────────────────

  @override
  Future<List<Map<String, dynamic>>> getLkList({
    String? category,
    String? status,
  }) =>
      _remote.getLkList(category: category, status: status);

  @override
  Future<Map<String, dynamic>> getLkDetail(String id) =>
      _remote.getLkDetail(id);

  @override
  Future<Map<String, dynamic>> createLk(Map<String, dynamic> data) =>
      _remote.createLk(data);

  @override
  Future<Map<String, dynamic>> updateLk(
          String id, Map<String, dynamic> data) =>
      _remote.updateLk(id, data);

  @override
  Future<void> deleteLk(String id) => _remote.deleteLk(id);

  @override
  Future<Map<String, dynamic>> submitLk(String id) => _remote.submitLk(id);

  // ── Equipment ─────────────────────────────────────────────────────────────

  @override
  Future<List<Map<String, dynamic>>> getEquipmentList(
          {String? category}) =>
      _remote.getEquipmentList(category: category);

  @override
  Future<Map<String, dynamic>> createEquipment(
          Map<String, dynamic> data) =>
      _remote.createEquipment(data);

  @override
  Future<Map<String, dynamic>> updateEquipment(
          String id, Map<String, dynamic> data) =>
      _remote.updateEquipment(id, data);

  @override
  Future<void> deleteEquipment(String id) => _remote.deleteEquipment(id);

  // ── Upload ────────────────────────────────────────────────────────────────

  @override
  Future<Map<String, dynamic>> uploadPhoto(String localFilePath) =>
      _remote.uploadPhoto(localFilePath);
}
