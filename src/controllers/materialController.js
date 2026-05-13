'use strict';

const { Material } = require('../models/associations');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

/**
 * Get all materials with filtering
 */
exports.getAllMaterials = async (req, res, next) => {
  try {
    const { search, cabinetCode } = req.query;
    
    let where = {};
    
    if (search) {
      where[Op.or] = [
        { materialCode: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (cabinetCode) {
      where.cabinetCode = cabinetCode;
    }

    const materials = await Material.findAll({
      where,
      order: [['materialCode', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: materials
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new material
 */
exports.createMaterial = async (req, res, next) => {
  try {
    const { materialCode, name, quantity, price, cabinetCode, uom, plant, storageLocation } = req.body;
    
    const existing = await Material.findOne({ where: { materialCode } });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Kode material sudah digunakan.'
      });
    }

    const material = await Material.create({
      materialCode,
      name,
      quantity: quantity || 0,
      price: price || 0,
      cabinetCode,
      uom: uom || 'PCS',
      plant,
      storageLocation
    });

    res.status(201).json({
      success: true,
      data: material
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a material
 */
exports.updateMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { materialCode, name, quantity, price, cabinetCode, uom, plant, storageLocation } = req.body;

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Material tidak ditemukan.'
      });
    }

    if (materialCode && materialCode !== material.materialCode) {
      const existing = await Material.findOne({ where: { materialCode } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Kode material sudah digunakan.'
        });
      }
    }

    await material.update({
      materialCode: materialCode || material.materialCode,
      name: name || material.name,
      quantity: quantity !== undefined ? quantity : material.quantity,
      price: price !== undefined ? price : material.price,
      cabinetCode: cabinetCode !== undefined ? cabinetCode : material.cabinetCode,
      uom: uom !== undefined ? uom : material.uom,
      plant: plant !== undefined ? plant : material.plant,
      storageLocation: storageLocation !== undefined ? storageLocation : material.storageLocation
    });

    res.status(200).json({
      success: true,
      data: material
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a material
 */
exports.deleteMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const material = await Material.findByPk(id);
    if (!material) return res.status(404).json({ success: false, error: 'Material tidak ditemukan.' });
    await material.destroy();
    res.status(200).json({ success: true, message: 'Material berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Import materials from Excel (Upsert Logic)
 */
exports.importMaterials = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File Excel tidak ditemukan.' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of jsonData) {
      // Normalize material code (remove leading zeros if they are purely for padding in string, 
      // but usually SAP uses them as part of the ID)
      const materialCode = String(row['Material'] || '').trim();
      if (!materialCode) {
        skippedCount++;
        continue;
      }

      const name = row['Material Description'] || '-';
      const plant = String(row['Plant'] || '').trim();
      const storageLocation = String(row['Storage Location'] || '').trim();
      const uom = String(row['Base Unit of Measure'] || 'PCS').trim();
      const quantity = parseFloat(row['Unrestricted']) || 0;
      const valueUnrestricted = parseFloat(row['Value Unrestricted']) || 0;
      const blockedQuantity = parseFloat(row['Blocked']) || 0;
      const valueBlockedStock = parseFloat(row['Value BlockedStock']) || 0;
      
      // Calculate average price per unit
      const price = quantity > 0 ? (valueUnrestricted / quantity) : 0;

      // Check if exists
      const existing = await Material.findOne({ where: { materialCode } });

      if (existing) {
        // Update existing material
        await existing.update({
          name,
          plant,
          storageLocation,
          uom,
          quantity,
          valueUnrestricted,
          blockedQuantity,
          valueBlockedStock,
          price
        });
        updatedCount++;
      } else {
        // Create new material
        await Material.create({
          materialCode,
          name,
          plant,
          storageLocation,
          uom,
          quantity,
          valueUnrestricted,
          blockedQuantity,
          valueBlockedStock,
          price
        });
        createdCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Import selesai. ${createdCount} baru, ${updatedCount} diperbarui.`,
      summary: { createdCount, updatedCount, skippedCount }
    });
  } catch (error) {
    console.error('[MaterialImport] Error:', error);
    next(error);
  }
};
