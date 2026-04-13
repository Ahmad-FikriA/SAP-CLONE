'use strict';

/**
 * Role-Based Access Control Middleware for Corrective Maintenance
 * Enforces access rules based on user roles and dinas
 */

const Notification = require('../models/Notification');
const SpkCorrective = require('../models/SpkCorrective');

// Allowed roles for creating notifications (Kadis with dinas)
const KADIS_ROLE = 'kadis';
const KADIS_PUSAT_ROLE = 'kadis_pusat';

// Roles that can work on SPK by dinas
const WORK_CENTER_ROLES = ['teknisi', 'kasie'];

/**
 * Check if user can create notification (must be Kadis or admin with dinas, or just admin)
 */
const requireKadis = (req, res, next) => {
  const { role, dinas } = req.user;
  
  if (role === 'admin') return next();
  
  if (role !== KADIS_ROLE || !dinas) {
    return res.status(403).json({
      error: 'Access denied. Only Kadis with dinas can create corrective requests.'
    });
  }
  
  next();
};

/**
 * Check if user can view specific notification
 * Rules:
 * 1. Kadis Pelapor (creator) - can view own
 * 2. Planner - can view all
 * 3. Kadis Pusat - can view all
 */
const canViewNotification = async (req, res, next) => {
  try {
    const { userId, role, group } = req.user;
    const { id } = req.params;
    
    const isPlannerGroup = group && group.toLowerCase().includes('perencanaan');
    
    // Planner and Kadis Pusat can view all
    if (role === 'planner' || isPlannerGroup || role === KADIS_PUSAT_ROLE) {
      return next();
    }
    
    // Kadis Pelapor can only view own
    if (role === KADIS_ROLE) {
      const notification = await Notification.findByPk(id);
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      
      if (notification.kadisPelaporId !== userId && notification.submittedBy !== userId) {
        return res.status(403).json({
          error: 'Access denied. You can only view your own notifications.'
        });
      }
      
      return next();
    }
    
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user can create SPK Corrective (must be Planner or admin)
 */
const requirePlanner = (req, res, next) => {
  const { role, group } = req.user;
  
  if (role === 'admin') return next();

  // Cek apakah user ada di grup perencanaan
  const isPlannerGroup = group && group.toLowerCase().includes('perencanaan');

  if (role !== 'planner' && !isPlannerGroup) {
    return res.status(403).json({
      error: 'Access denied. Only Planner can create SPK Corrective.'
    });
  }
  
  next();
};

/**
 * Check if user can view specific SPK Corrective
 * Rules:
 * 1. Teknisi/Kasie - can view only their dinas
 * 2. Planner - can view all
 * 3. Kadis Pusat - can view all
 * 4. Kadis Pelapor - can view only their own reports
 * 5. Admin - can view all
 */
const canViewSpkCorrective = async (req, res, next) => {
  try {
    const { userId, role, dinas, group } = req.user;
    const { spkId } = req.params;
    
    const isPlannerGroup = group && group.toLowerCase().includes('perencanaan');
    
    // Planner, Admin, and Kadis Pusat can view all
    if (role === 'planner' || isPlannerGroup || role === 'admin' || role === KADIS_PUSAT_ROLE) {
      return next();
    }
    
    // Get SPK with notification info
    const spk = await SpkCorrective.findByPk(spkId, {
      include: [{
        model: require('../models/Notification'),
        as: 'notification'
      }]
    });
    
    if (!spk) {
      return res.status(404).json({ error: 'SPK Corrective not found' });
    }
    
    // Kadis Pelapor - can view only their own
    if (role === KADIS_ROLE) {
      if (spk.notification && spk.notification.kadisPelaporId === userId) {
        return next();
      }
      return res.status(403).json({
        error: 'Access denied. You can only view your own reports.'
      });
    }
    
    // Teknisi/Kasie - check dinas
    if (WORK_CENTER_ROLES.includes(role)) {
      if (!dinas) {
        return res.status(403).json({
          error: 'Access denied. User has no dinas assigned.'
        });
      }
      
      if (spk.workCenter === dinas) {
        return next();
      }
      return res.status(403).json({
        error: `Access denied. This SPK is assigned to ${spk.workCenter} dinas.`
      });
    }
    
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user can update specific SPK fields
 * Rules:
 * 1. Planner - can only set specific fields during creation
 * 2. Teknisi - can add items, photos, actual data
 * 3. Kasie - can only fill kasie_approval
 * 4. Kadis Pusat - can only fill kadis_pusat_approval
 * 5. Kadis Pelapor - can only fill kadis_pelapor_approval
 */
const validateSpkUpdate = (allowedFields) => {
  return (req, res, next) => {
    const { role } = req.user;
    const updates = Object.keys(req.body);
    
    // Check if any field is not in allowed list
    const invalidFields = updates.filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(403).json({
        error: `Access denied. Role '${role}' cannot modify fields: ${invalidFields.join(', ')}.`
      });
    }
    
    next();
  };
};

/**
 * Fields each role can update on SPK Corrective
 */
const PLANNER_FIELDS = [
  'orderNumber', 'createdDate', 'priority', 'equipmentId', 'location',
  'requestedFinishDate', 'damageClassification', 'jobDescription',
  'workCenter', 'ctrlKey', 'unit', 'plannedWorker', 'plannedHourPerWorker',
  'totalPlannedHour', 'items'
];

const TEKNISI_FIELDS = [
  'actualStartDate', 'jobResultDescription', 'actualWorker',
  'actualHourPerWorker', 'totalActualHour', 'items', 'apdItems',
  'beforePhotos', 'afterPhotos'
];

const KADIS_PUSAT_FIELDS = ['kadisPusatApprovedBy', 'kadisPusatApprovedAt', 'status'];

const KADIS_PELAPOR_FIELDS = ['kadisPelaporApprovedBy', 'kadisPelaporApprovedAt', 'status'];

module.exports = {
  requireKadis,
  canViewNotification,
  requirePlanner,
  canViewSpkCorrective,
  validateSpkUpdate,
  PLANNER_FIELDS,
  TEKNISI_FIELDS,
  KADIS_PUSAT_FIELDS,
  KADIS_PELAPOR_FIELDS,
  KADIS_ROLE,
  KADIS_PUSAT_ROLE,
  WORK_CENTER_ROLES,
};
