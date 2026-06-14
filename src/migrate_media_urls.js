/**
 * migrate_media_urls.js
 * Script to clean old domain names (like devlab/krakatautirta full URLs) from the database
 * and convert them to clean relative paths.
 */

'use strict';

const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

// Define models directly to avoid circular dependency in associations
const SupervisiVisit = require('./models/SupervisiVisit');
const SupervisiJob = require('./models/SupervisiJob');
const SupervisiAmend = require('./models/SupervisiAmend');
const { InspectionReport, InspectionReportPhoto } = require('./models/InspectionReport');
const InspectionRequest = require('./models/InspectionRequest');
const K3Report = require('./models/K3Report');
const Notification = require('./models/Notification');
const { SpkCorrectivePhoto } = require('./models/SpkCorrectiveItem');
const { SubmissionPhoto } = require('./models/Submission');

// Helper to strip any domain prefix and make the path relative starting with uploads/ or /uploads/
function cleanUrlPath(urlStr) {
  if (typeof urlStr !== 'string') return urlStr;
  
  // If it's a URL starting with http:// or https://
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
    try {
      const url = new URL(urlStr);
      let pathname = url.pathname;
      // If pathname starts with /uploads/, return it
      // Keep leading slash or remove it based on what's normal.
      // Supervisi uses /uploads/... (with leading slash), others use uploads/... (without leading slash).
      // Let's preserve the slash. If it starts with /uploads/ or uploads/, return it.
      if (pathname.includes('/uploads/')) {
        const index = pathname.indexOf('/uploads/');
        return pathname.substring(index); // Keep the leading slash e.g. /uploads/supervisi/xxx
      }
      return pathname;
    } catch (e) {
      console.warn(`Failed to parse URL: ${urlStr}`);
      return urlStr;
    }
  }
  
  return urlStr;
}

// Clean JSON array of paths
function cleanPathsArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => {
    if (typeof item === 'string') {
      return cleanUrlPath(item);
    } else if (item && typeof item === 'object') {
      // In case it's an object with path fields, like inspection photos which might be { id, photoPath, caption }
      // Wait, inspection photos are stored in a separate table: inspection_report_photos
      // But if there are other places storing objects in JSON
      const copy = { ...item };
      for (const key of Object.keys(copy)) {
        if (typeof copy[key] === 'string') {
          copy[key] = cleanUrlPath(copy[key]);
        }
      }
      return copy;
    }
    return item;
  });
}

async function runMigration() {
  console.log('Starting media URL migration...');
  
  // 1. SupervisiVisit: photos (JSON), documents (JSON)
  console.log('Migrating supervisi_visits...');
  const visits = await SupervisiVisit.findAll();
  let visitUpdates = 0;
  for (const visit of visits) {
    let changed = false;
    let photos = visit.photos;
    let documents = visit.documents;
    
    if (photos) {
      const cleaned = cleanPathsArray(photos);
      if (JSON.stringify(cleaned) !== JSON.stringify(photos)) {
        visit.photos = cleaned;
        changed = true;
      }
    }
    
    if (documents) {
      const cleaned = cleanPathsArray(documents);
      if (JSON.stringify(cleaned) !== JSON.stringify(documents)) {
        visit.documents = cleaned;
        changed = true;
      }
    }
    
    if (changed) {
      await visit.save();
      visitUpdates++;
    }
  }
  console.log(`Updated ${visitUpdates} rows in supervisi_visits.`);

  // 2. SupervisiJob: amendDocuments (JSON)
  console.log('Migrating supervisi_jobs...');
  const jobs = await SupervisiJob.findAll();
  let jobUpdates = 0;
  for (const job of jobs) {
    let changed = false;
    let docs = job.amendDocuments;
    if (docs) {
      const cleaned = cleanPathsArray(docs);
      if (JSON.stringify(cleaned) !== JSON.stringify(docs)) {
        job.amendDocuments = cleaned;
        changed = true;
      }
    }
    if (changed) {
      await job.save();
      jobUpdates++;
    }
  }
  console.log(`Updated ${jobUpdates} rows in supervisi_jobs.`);

  // 3. SupervisiAmend: documents (JSON)
  console.log('Migrating supervisi_amends...');
  const amends = await SupervisiAmend.findAll();
  let amendUpdates = 0;
  for (const amend of amends) {
    let changed = false;
    let docs = amend.documents;
    if (docs) {
      const cleaned = cleanPathsArray(docs);
      if (JSON.stringify(cleaned) !== JSON.stringify(docs)) {
        amend.documents = cleaned;
        changed = true;
      }
    }
    if (changed) {
      await amend.save();
      amendUpdates++;
    }
  }
  console.log(`Updated ${amendUpdates} rows in supervisi_amends.`);

  // 4. InspectionRequest: mediaPaths (JSON)
  console.log('Migrating inspection_requests...');
  const requests = await InspectionRequest.findAll();
  let requestUpdates = 0;
  for (const req of requests) {
    let changed = false;
    let paths = req.mediaPaths;
    if (paths) {
      const cleaned = cleanPathsArray(paths);
      if (JSON.stringify(cleaned) !== JSON.stringify(paths)) {
        req.mediaPaths = cleaned;
        changed = true;
      }
    }
    if (changed) {
      await req.save();
      requestUpdates++;
    }
  }
  console.log(`Updated ${requestUpdates} rows in inspection_requests.`);

  // 5. InspectionReport: attachments (JSON), signaturePath (string)
  console.log('Migrating inspection_reports...');
  const reports = await InspectionReport.findAll();
  let reportUpdates = 0;
  for (const rep of reports) {
    let changed = false;
    let attachments = rep.attachments;
    let sig = rep.signaturePath;
    
    if (attachments) {
      const cleaned = cleanPathsArray(attachments);
      if (JSON.stringify(cleaned) !== JSON.stringify(attachments)) {
        rep.attachments = cleaned;
        changed = true;
      }
    }
    
    if (sig) {
      const cleaned = cleanUrlPath(sig);
      if (cleaned !== sig) {
        rep.signaturePath = cleaned;
        changed = true;
      }
    }
    
    if (changed) {
      await rep.save();
      reportUpdates++;
    }
  }
  console.log(`Updated ${reportUpdates} rows in inspection_reports.`);

  // 6. InspectionReportPhoto: photoPath (string)
  console.log('Migrating inspection_report_photos...');
  const reportPhotos = await InspectionReportPhoto.findAll();
  let reportPhotoUpdates = 0;
  for (const rp of reportPhotos) {
    const cleaned = cleanUrlPath(rp.photoPath);
    if (cleaned !== rp.photoPath) {
      rp.photoPath = cleaned;
      await rp.save();
      reportPhotoUpdates++;
    }
  }
  console.log(`Updated ${reportPhotoUpdates} rows in inspection_report_photos.`);

  // 7. K3Report: foto (JSON), fotoPerbaikan (JSON), fotoInvestigasi (JSON), dokumenInvestigasi (string)
  console.log('Migrating k3_reports...');
  const k3Reports = await K3Report.findAll();
  let k3Updates = 0;
  for (const k3 of k3Reports) {
    let changed = false;
    let foto = k3.foto;
    let fotoP = k3.fotoPerbaikan;
    let fotoI = k3.fotoInvestigasi;
    let docI = k3.dokumenInvestigasi;
    
    if (foto) {
      const cleaned = cleanPathsArray(foto);
      if (JSON.stringify(cleaned) !== JSON.stringify(foto)) {
        k3.foto = cleaned;
        changed = true;
      }
    }
    if (fotoP) {
      const cleaned = cleanPathsArray(fotoP);
      if (JSON.stringify(cleaned) !== JSON.stringify(fotoP)) {
        k3.fotoPerbaikan = cleaned;
        changed = true;
      }
    }
    if (fotoI) {
      const cleaned = cleanPathsArray(fotoI);
      if (JSON.stringify(cleaned) !== JSON.stringify(fotoI)) {
        k3.fotoInvestigasi = cleaned;
        changed = true;
      }
    }
    if (docI) {
      const cleaned = cleanUrlPath(docI);
      if (cleaned !== docI) {
        k3.dokumenInvestigasi = cleaned;
        changed = true;
      }
    }
    
    if (changed) {
      await k3.save();
      k3Updates++;
    }
  }
  console.log(`Updated ${k3Updates} rows in k3_reports.`);

  // 8. Notification: photo1 (string), photo2 (string)
  console.log('Migrating notifications...');
  const notifications = await Notification.findAll();
  let notifUpdates = 0;
  for (const notif of notifications) {
    let changed = false;
    const p1 = notif.photo1;
    const p2 = notif.photo2;
    if (p1) {
      const cleaned = cleanUrlPath(p1);
      if (cleaned !== p1) {
        notif.photo1 = cleaned;
        changed = true;
      }
    }
    if (p2) {
      const cleaned = cleanUrlPath(p2);
      if (cleaned !== p2) {
        notif.photo2 = cleaned;
        changed = true;
      }
    }
    if (changed) {
      await notif.save();
      notifUpdates++;
    }
  }
  console.log(`Updated ${notifUpdates} rows in notifications.`);

  // 9. SpkCorrectivePhoto: photoPath (string)
  console.log('Migrating spk_corrective_photos...');
  const correctivePhotos = await SpkCorrectivePhoto.findAll();
  let corrUpdates = 0;
  for (const cp of correctivePhotos) {
    const cleaned = cleanUrlPath(cp.photoPath);
    if (cleaned !== cp.photoPath) {
      cp.photoPath = cleaned;
      await cp.save();
      corrUpdates++;
    }
  }
  console.log(`Updated ${corrUpdates} rows in spk_corrective_photos.`);

  // 10. SubmissionPhoto: photoPath (string)
  console.log('Migrating submission_photos...');
  const subPhotos = await SubmissionPhoto.findAll();
  let subUpdates = 0;
  for (const sp of subPhotos) {
    const cleaned = cleanUrlPath(sp.photoPath);
    if (cleaned !== sp.photoPath) {
      sp.photoPath = cleaned;
      await sp.save();
      subUpdates++;
    }
  }
  console.log(`Updated ${subUpdates} rows in submission_photos.`);

  console.log('All migrations completed successfully.');
}

runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
