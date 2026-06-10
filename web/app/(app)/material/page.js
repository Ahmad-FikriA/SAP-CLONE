'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, Search, Plus, RefreshCw, Edit2, Trash2, Loader2, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function MaterialPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <MaterialPageInner />
    </Suspense>
  );
}

function MaterialPageInner() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    materialCode: '',
    name: '',
    quantity: 0,
    price: 0,
    cabinetCode: '',
    uom: 'PCS',
    plant: '',
    storageLocation: ''
  });

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const response = await apiGet(`/materials?search=${search}`);
      if (response.success) {
        setMaterials(response.data);
      }
    } catch (error) {
      toast.error('Gagal mengambil data material: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMaterials();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormData({
      materialCode: '',
      name: '',
      quantity: 0,
      price: 0,
      cabinetCode: '',
      uom: 'PCS',
      plant: '',
      storageLocation: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (material) => {
    setIsEditing(true);
    setSelectedMaterial(material);
    setFormData({
      materialCode: material.materialCode,
      name: material.name,
      quantity: material.quantity,
      price: material.price,
      cabinetCode: material.cabinetCode || '',
      uom: material.uom || 'PCS',
      plant: material.plant || '',
      storageLocation: material.storageLocation || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const response = await apiPut(`/materials/${selectedMaterial.id}`, formData);
        if (response.success) {
          toast.success('Material berhasil diperbarui');
          setIsModalOpen(false);
          fetchMaterials();
        }
      } else {
        const response = await apiPost('/materials', formData);
        if (response.success) {
          toast.success('Material berhasil ditambahkan');
          setIsModalOpen(false);
          fetchMaterials();
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus material ini?')) return;
    try {
      const response = await apiDelete(`/materials/${id}`);
      if (response.success) {
        toast.success('Material berhasil dihapus');
        fetchMaterials();
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiUpload('/materials/import', formData);
      if (response.success) {
        toast.success(response.message);
        fetchMaterials();
      }
    } catch (error) {
      toast.error('Gagal mengimpor material: ' + error.message);
    } finally {
      setIsImporting(false);
      e.target.value = ''; // Reset input
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-blue-600" />
            Material Gudang
          </h1>
          <p className="text-sm text-slate-500">Manajemen inventaris material dari SAP.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <Button 
            onClick={handleImportClick} 
            disabled={isImporting}
            variant="outline"
            className="gap-2 border-green-600 text-green-700 hover:bg-green-50"
          >
            {isImporting ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
            Import Excel SAP
          </Button>
          <Button onClick={handleOpenAddModal} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus size={16} />
            Tambah Manual
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            type="text"
            placeholder="Cari material (kode/nama)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchMaterials} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="px-6 py-4">Kode</th>
                <th className="px-6 py-4">Nama</th>
                <th className="px-6 py-4">Stok</th>
                <th className="px-6 py-4">Unit</th>
                <th className="px-6 py-4">Estimasi Harga</th>
                <th className="px-6 py-4">Lokasi/Lemari</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && materials.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={24} />
                      <p>Memuat data...</p>
                    </div>
                  </td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-400">
                    Tidak ada material ditemukan.
                  </td>
                </tr>
              ) : (
                materials.map((item) => (
                  <tr key={item.id} className="text-sm hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-blue-700">{item.materialCode}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.plant || '-'} | {item.storageLocation || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.quantity <= 5 ? 'bg-red-100 text-red-700' : 
                        item.quantity <= 20 ? 'bg-orange-100 text-orange-700' : 
                        'bg-green-100 text-green-700'
                      }`}>
                        {parseFloat(item.quantity).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">{item.uom}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{formatCurrency(item.price)}</div>
                      {item.valueUnrestricted > 0 && (
                        <div className="text-xs text-slate-400">Total: {formatCurrency(item.valueUnrestricted)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">{item.cabinetCode || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenEditModal(item)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-500 hover:text-red-600"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Material' : 'Tambah Material Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Kode Material</label>
                <Input
                  required
                  value={formData.materialCode}
                  onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
                  placeholder="Contoh: 1000123"
                  disabled={isEditing}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Unit (UoM)</label>
                <Input
                  value={formData.uom}
                  onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  placeholder="PCS, MTR, etc"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nama Material</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Deskripsi material..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Stok (Unrestricted)</label>
                <Input
                  type="number"
                  step="0.001"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Harga Satuan (Rp)</label>
                <Input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Plant</label>
                <Input
                  value={formData.plant}
                  onChange={(e) => setFormData({ ...formData, plant: e.target.value })}
                  placeholder="Contoh: 2101"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Storage Location</label>
                <Input
                  value={formData.storageLocation}
                  onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                  placeholder="Contoh: G001"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Kode Lemari / Rak</label>
              <Input
                value={formData.cabinetCode}
                onChange={(e) => setFormData({ ...formData, cabinetCode: e.target.value })}
                placeholder="Contoh: A-01-02"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {isEditing ? 'Simpan Perubahan' : 'Tambah Material'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
