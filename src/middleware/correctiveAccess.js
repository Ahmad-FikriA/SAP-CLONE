'use strict';



const Notification = require('../models/Notification');
const SpkCorrective = require('../models/SpkCorrective');


const KADIS_ROLE = 'kadis';
const KADIS_PUSAT_ROLE = 'kadis_pusat';


const WORK_CENTER_ROLES = ['teknisi', 'kasie'];


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


const canViewNotification = async (req, res, next) => {
  try {
    const { userId, role, group } = req.user;
    const { id } = req.params;
    
    const isPlannerGroup = group && group.toLowerCase().includes('perencanaan');
    

    if (role === 'planner' || isPlannerGroup || role === 'admin' || role === KADIS_PUSAT_ROLE) {
      return next();
    }
    

    if (role === KADIS_ROLE) {
      const { dinas } = req.user;
      const isKadisPusat = dinas && dinas.toLowerCase().includes('pusat perawatan');
      
      if (isKadisPusat) {
         return next();
      }

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


const requirePlanner = (req, res, next) => {
  const { role, group } = req.user;
  
  if (role === 'admin') return next();


  const isPlannerGroup = group && group.toLowerCase().includes('perencanaan');

  if (role !== 'planner' && !isPlannerGroup) {
    return res.status(403).json({
      error: 'Access denied. Only Planner can create SPK Corrective.'
    });
  }
  
  next();
};


const canViewSpkCorrective = async (req, res, next) => {
  try {
    const { userId, role, dinas, group } = req.user;
    const { spkId } = req.params;
    
    const isPlannerGroup = group && group.toLowerCase().includes('perencanaan');
    

    if (role === 'planner' || isPlannerGroup || role === 'admin' || role === KADIS_PUSAT_ROLE) {
      return next();
    }
    

    const spk = await SpkCorrective.findByPk(spkId, {
      include: [{
        model: require('../models/Notification'),
        as: 'notification'
      }]
    });
    
    if (!spk) {
      return res.status(404).json({ error: 'SPK Corrective not found' });
    }
    

    if (role === KADIS_ROLE) {
      const isKadisPusat = dinas && dinas.toLowerCase().includes('pusat perawatan');
      if (isKadisPusat) {
        return next();
      }

      if (spk.notification && spk.notification.kadisPelaporId === userId) {
        return next();
      }
      return res.status(403).json({
        error: 'Access denied. You can only view your own reports.'
      });
    }
    

    if (WORK_CENTER_ROLES.includes(role)) {
      const userGroup = (group || '').toLowerCase();
      const wc = (spk.workCenter || '').toLowerCase();
      
      let isMatch = false;
      if (wc === userGroup) isMatch = true;
      else if (wc.includes('mechanic') && (userGroup.includes('mekanik') || userGroup.includes('mech'))) isMatch = true;
      else if (wc.includes('electric') && (userGroup.includes('listrik') || userGroup.includes('elec'))) isMatch = true;
      else if (wc.includes('civil') && (userGroup.includes('sipil') || userGroup.includes('civil'))) isMatch = true;
      else if (wc.includes('automation') && (userGroup.includes('otomasi') || userGroup.includes('auto'))) isMatch = true;

      else if (!group || userGroup === '') isMatch = true;

      if (isMatch) {
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


const validateSpkUpdate = (allowedFields) => {
  return (req, res, next) => {
    const { role } = req.user;
    const updates = Object.keys(req.body);
    
    const invalidFields = updates.filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(403).json({
        error: `Access denied. Role '${role}' cannot modify fields: ${invalidFields.join(', ')}.`
      });
    }
    
    next();
  };
};


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
