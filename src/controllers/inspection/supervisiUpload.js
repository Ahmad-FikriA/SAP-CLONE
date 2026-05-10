"use strict";

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "../../../uploads/supervisi");

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

function createSupervisiUpload({ prefix, maxFileSizeMb }) {
  ensureUploadDir();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const random = Math.random().toString(36).slice(2);
      cb(null, `${prefix}_${Date.now()}_${random}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxFileSizeMb * 1024 * 1024 },
  });
}

function toSupervisiUploadPath(file) {
  return `/uploads/supervisi/${file.filename}`;
}

function filesToSupervisiPaths(files) {
  return (files || []).map(toSupervisiUploadPath);
}

const supervisiUpload = createSupervisiUpload({
  prefix: "sv",
  maxFileSizeMb: 50,
});

const amendUpload = createSupervisiUpload({
  prefix: "sv_amend",
  maxFileSizeMb: 20,
});

const uploadVisitMedia = supervisiUpload.fields([
  { name: "photos", maxCount: 20 },
  { name: "documents", maxCount: 5 },
]);

const uploadJobAmendDocuments = supervisiUpload.fields([
  { name: "amendDocuments", maxCount: 10 },
]);

const uploadAmendDocuments = amendUpload.array("documents", 10);

module.exports = {
  filesToSupervisiPaths,
  uploadAmendDocuments,
  uploadJobAmendDocuments,
  uploadVisitMedia,
};
