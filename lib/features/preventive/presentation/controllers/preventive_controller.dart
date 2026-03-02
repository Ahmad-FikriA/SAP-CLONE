// =============================================================================
// lib/features/preventive/presentation/controllers/preventive_controller.dart
//
// GetX controller for the entire Preventive-Maintenance feature.
// Manages observable state for SPK, Lembar Kerja, and Equipment lists,
// individual detail views, loading flags, and error messages.
//
// Wire it up in your binding or main.dart:
//   Get.put(PreventiveController(repository: Get.find()));
//
// Dependency: get: ^4.6.0
// =============================================================================

import 'package:get/get.dart';

import '../../data/repositories/preventive_repository_impl.dart';
import '../../../../core/error/exceptions.dart';

class PreventiveController extends GetxController {
  final PreventiveRepository repository;

  PreventiveController({required this.repository});

  // ── Observable state ───────────────────────────────────────────────────────

  // Lists
  final RxList<Map<String, dynamic>> spkList       = <Map<String, dynamic>>[].obs;
  final RxList<Map<String, dynamic>> lkList        = <Map<String, dynamic>>[].obs;
  final RxList<Map<String, dynamic>> equipmentList = <Map<String, dynamic>>[].obs;

  // Detail views
  final Rx<Map<String, dynamic>?> selectedSpk = Rx<Map<String, dynamic>?>(null);
  final Rx<Map<String, dynamic>?> selectedLk  = Rx<Map<String, dynamic>?>(null);

  // Filters
  final RxString spkCategoryFilter = ''.obs;
  final RxString spkStatusFilter   = ''.obs;
  final RxString lkCategoryFilter  = ''.obs;
  final RxString lkStatusFilter    = ''.obs;
  final RxString eqCategoryFilter  = ''.obs;

  // Loading flags (separate flags let UIs show per-section spinners)
  final RxBool isLoadingSpk       = false.obs;
  final RxBool isLoadingLk        = false.obs;
  final RxBool isLoadingEquipment = false.obs;
  final RxBool isSubmitting       = false.obs;
  final RxBool isSyncing          = false.obs;

  // Error messages — observe in UI with Obx(() => ...) and Snackbar/Dialog
  final RxString errorMessage = ''.obs;
  final RxString successMessage = ''.obs;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @override
  void onInit() {
    super.onInit();
    // Auto-fetch all lists when the controller is first created.
    fetchAll();
  }

  /// Fetch SPK, LK, and Equipment lists in parallel.
  Future<void> fetchAll() async {
    await Future.wait([
      fetchSpkList(),
      fetchLkList(),
      fetchEquipmentList(),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPK
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> fetchSpkList() async {
    isLoadingSpk.value = true;
    errorMessage.value = '';
    try {
      spkList.value = await repository.getSpkList(
        category: spkCategoryFilter.value.isEmpty ? null : spkCategoryFilter.value,
        status:   spkStatusFilter.value.isEmpty   ? null : spkStatusFilter.value,
      );
    } catch (e) {
      errorMessage.value = _friendlyError(e);
    } finally {
      isLoadingSpk.value = false;
    }
  }

  Future<void> fetchSpkDetail(String id) async {
    isLoadingSpk.value = true;
    try {
      selectedSpk.value = await repository.getSpkDetail(id);
    } catch (e) {
      errorMessage.value = _friendlyError(e);
    } finally {
      isLoadingSpk.value = false;
    }
  }

  Future<bool> createSpk(Map<String, dynamic> data) async {
    isSubmitting.value = true;
    try {
      final created = await repository.createSpk(data);
      spkList.add(created);
      successMessage.value = 'SPK ${created['spkNumber']} berhasil dibuat.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<bool> updateSpk(String id, Map<String, dynamic> data) async {
    isSubmitting.value = true;
    try {
      final updated = await repository.updateSpk(id, data);
      final idx = spkList.indexWhere((s) => s['id'] == id);
      if (idx != -1) spkList[idx] = updated;
      successMessage.value = 'SPK berhasil diperbarui.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<bool> deleteSpk(String id) async {
    isSubmitting.value = true;
    try {
      await repository.deleteSpk(id);
      spkList.removeWhere((s) => s['id'] == id);
      successMessage.value = 'SPK berhasil dihapus.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  /// Submit SPK with activity results.
  /// [activityResults] shape: { 'ACT-001': { 'value': '2.5 bar', 'note': '...' } }
  Future<bool> submitSpk(
      String id, Map<String, dynamic> activityResults) async {
    isSubmitting.value = true;
    try {
      final result = await repository.submitSpk(id, {
        'activityResults': activityResults,
      });
      // Update local list entry
      final idx = spkList.indexWhere((s) => s['id'] == id);
      if (idx != -1) spkList[idx] = result;
      selectedSpk.value = result;
      successMessage.value = 'SPK berhasil disubmit.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<bool> syncSpk(String id) async {
    isSyncing.value = true;
    try {
      final result = await repository.syncSpk(id);
      successMessage.value =
          'SPK ${result['spkNumber']} berhasil disync pada ${result['syncedAt']}.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSyncing.value = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lembar Kerja
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> fetchLkList() async {
    isLoadingLk.value = true;
    errorMessage.value = '';
    try {
      lkList.value = await repository.getLkList(
        category: lkCategoryFilter.value.isEmpty ? null : lkCategoryFilter.value,
        status:   lkStatusFilter.value.isEmpty   ? null : lkStatusFilter.value,
      );
    } catch (e) {
      errorMessage.value = _friendlyError(e);
    } finally {
      isLoadingLk.value = false;
    }
  }

  Future<void> fetchLkDetail(String id) async {
    isLoadingLk.value = true;
    try {
      selectedLk.value = await repository.getLkDetail(id);
    } catch (e) {
      errorMessage.value = _friendlyError(e);
    } finally {
      isLoadingLk.value = false;
    }
  }

  Future<bool> createLk(Map<String, dynamic> data) async {
    isSubmitting.value = true;
    try {
      final created = await repository.createLk(data);
      lkList.add(created);
      successMessage.value = 'Lembar Kerja ${created['lkNumber']} berhasil dibuat.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<bool> updateLk(String id, Map<String, dynamic> data) async {
    isSubmitting.value = true;
    try {
      final updated = await repository.updateLk(id, data);
      final idx = lkList.indexWhere((l) => l['id'] == id);
      if (idx != -1) lkList[idx] = updated;
      successMessage.value = 'Lembar Kerja berhasil diperbarui.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<bool> deleteLk(String id) async {
    isSubmitting.value = true;
    try {
      await repository.deleteLk(id);
      lkList.removeWhere((l) => l['id'] == id);
      successMessage.value = 'Lembar Kerja berhasil dihapus.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<bool> submitLk(String id) async {
    isSubmitting.value = true;
    try {
      final result = await repository.submitLk(id);
      final idx = lkList.indexWhere((l) => l['id'] == id);
      if (idx != -1) lkList[idx] = result;
      selectedLk.value = result;
      successMessage.value = 'Lembar Kerja berhasil disubmit.';
      return true;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Equipment
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> fetchEquipmentList() async {
    isLoadingEquipment.value = true;
    try {
      equipmentList.value = await repository.getEquipmentList(
        category: eqCategoryFilter.value.isEmpty ? null : eqCategoryFilter.value,
      );
    } catch (e) {
      errorMessage.value = _friendlyError(e);
    } finally {
      isLoadingEquipment.value = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Filters — call these from dropdowns, then re-fetch
  // ═══════════════════════════════════════════════════════════════════════════

  void setSpkFilters({String? category, String? status}) {
    if (category != null) spkCategoryFilter.value = category;
    if (status   != null) spkStatusFilter.value   = status;
    fetchSpkList();
  }

  void setLkFilters({String? category, String? status}) {
    if (category != null) lkCategoryFilter.value = category;
    if (status   != null) lkStatusFilter.value   = status;
    fetchLkList();
  }

  void setEquipmentFilter(String category) {
    eqCategoryFilter.value = category;
    fetchEquipmentList();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Photo Upload
  // ═══════════════════════════════════════════════════════════════════════════

  /// Returns the server-side path, e.g. "uploads/1234567890_photo.jpg",
  /// or null on failure.
  Future<String?> uploadPhoto(String localFilePath) async {
    try {
      final result = await repository.uploadPhoto(localFilePath);
      return result['path'] as String?;
    } catch (e) {
      errorMessage.value = _friendlyError(e);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /// Converts any exception into a user-friendly Indonesian error string.
  String _friendlyError(Object e) {
    if (e is UnauthorizedException) {
      return 'Sesi habis. Silakan login kembali.';
    }
    if (e is NetworkException) {
      return 'Gagal terhubung ke server. Periksa jaringan Anda.';
    }
    if (e is ServerException) {
      return e.message;
    }
    return e.toString();
  }

  /// Clears error / success banners from the UI.
  void clearMessages() {
    errorMessage.value   = '';
    successMessage.value = '';
  }
}
