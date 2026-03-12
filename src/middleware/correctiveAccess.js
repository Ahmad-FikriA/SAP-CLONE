'use strict';

/**
 * Role-Based Access Control Middleware for Corrective Maintenance
 * Enforces access rules based on user roles
 */

const Notification = require('../models/Notification');
const SpkCorrective = require('../models/SpkCorrective');

// Allowed roles for creating notifications
const KADIS_ROLES = ['kadis_electrical', 'kadis_civil', 'kadis_automation', 'kadis_mechanical', 'kadis'];

// Work center mapping from role
const ROLE_TO_WORKCENTER = {
  'teknisi_listrik': 'electrical',
  'teknisi_sipil': 'civil',
  'teknisi_otomasi': 'automation',
  'teknisi_mekanik': 'mechanical',
  'kasie_listrik': 'electrical',
  'kasie_sipil': 'civil',
  'kasie_otomasi': 'automation',
  'kasie_mekanik': 'mechanical',
};

/**
 * Check if user can create notification (must be Kadis)
 */
const requireKadis = (req, res, next) => {
  const { role } = req.user;
  
  if (!KADIS_ROLES.includes(role)) {
    return res.status(403).json({
      error: 'Access denied. Only Kadis can create corrective requests.'
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
    const { userId, role } = req.user;
    const { id } = req.params;
    
    // Planner and Kadis Pusat can view all
    if (role === 'planner' || role === 'kadis_pusat') {
      return next();
    }
    
    // Kadis Pelapor can only view own
    if (KADIS_ROLES.includes(role)) {
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
 * Check if user can create SPK Corrective (must be Planner)
 */
const requirePlanner = (req, res, next) => {
  const { role } = req.user;
  
  if (role !== 'planner') {
    return res.status(403).json({
      error: 'Access denied. Only Planner can create SPK Corrective.'
    });
  }
  
  next();
};

/**
 * Check if user can view specific SPK Corrective
 * Rules:
 * 1. Teknisi/Kasie - can view only their work center
 * 2. Planner - can view all
 * 3. Kadis Pusat - can view all
 * 4. Kadis Pelapor - can view only their own reports
 */
const canViewSpkCorrective = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const { spkId } = req.params;
    
    // Planner and Kadis Pusat can view all
    if (role === 'planner' || role === 'kadis_pusat') {
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
    if (KADIS_ROLES.includes(role)) {
      if (spk.notification && spk.notification.kadisPelaporId === userId) {
        return next();
      }
      return res.status(403).json({
        error: 'Access denied. You can only view your own reports.'
      });
    }
    
    // Teknisi/Kasie - check work center
    const userWorkCenter = ROLE_TO_WORKCENTER[role];
    if (userWorkCenter) {
      if (spk.workCenter === userWorkCenter) {
        return next();
      }
      return res.status(403).json({
        error: `Access denied. This SPK is assigned to ${spk.workCenter} work center.`
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

const KASIE_FIELDS = ['kasieApprovedBy', 'kasieApprovedAt', 'status'];

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
  KASIE_FIELDS,
  KADIS_PUSAT_FIELDS,
  KADIS_PELAPOR_FIELDS,
  KADIS_ROLES,
  ROLE_TO_WORKCENTER,
};
