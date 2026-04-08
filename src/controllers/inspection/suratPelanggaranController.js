"use strict";

const { Op } = require("sequelize");
const SuratPelanggaran = require("../../models/SuratPelanggaran");
const InspectionFollowUp = require("../../models/InspectionFollowUp");

/**
 * SuratPelanggaran Controller
 * Auto-issued when follow-up deadline passes without resolution.
 */

// GET /api/inspection/surat-pelanggaran
async function listSuratPelanggaran(req, res) {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.followUpId) where.followUpId = req.query.followUpId;

    const data = await SuratPelanggaran.findAll({
      where,
      include: [
        {
          association: "followUp",
          attributes: [
            "id",
            "reportId",
            "assignedTechnician",
            "kategoriK3",
            "description",
            "deadline",
            "status",
          ],
        },
      ],
      order: [["issuedAt", "DESC"]],
    });

    res.json({ success: true, message: "Surat pelanggaran retrieved.", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/inspection/surat-pelanggaran/:id
async function getSuratPelanggaran(req, res) {
  try {
    const surat = await SuratPelanggaran.findByPk(req.params.id, {
      include: [
        {
          association: "followUp",
          include: [
            {
              association: "report",
              include: [{ association: "schedule" }],
            },
          ],
        },
      ],
    });

    if (!surat) {
      return res
        .status(404)
        .json({ success: false, message: "Surat pelanggaran not found." });
    }

    res.json({
      success: true,
      message: "Surat pelanggaran retrieved.",
      data: surat,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/surat-pelanggaran
async function createSuratPelanggaran(req, res) {
  try {
    const {
      followUpId,
      nomorSurat,
      jenisTemuan,
      lokasi,
      deskripsi,
      pelanggar,
      deadline,
      notes,
    } = req.body;

    const surat = await SuratPelanggaran.create({
      followUpId,
      nomorSurat,
      jenisTemuan,
      lokasi,
      deskripsi,
      pelanggar,
      deadline,
      status: "issued",
      issuedBy: req.user.nik,
      issuedAt: new Date(),
      notes,
    });

    // Link surat to follow-up
    await InspectionFollowUp.update(
      { suratPelanggaranId: surat.id },
      { where: { id: followUpId } },
    );

    res.status(201).json({
      success: true,
      message: "Surat pelanggaran issued.",
      data: surat,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/inspection/surat-pelanggaran/:id
async function updateSuratPelanggaran(req, res) {
  try {
    const surat = await SuratPelanggaran.findByPk(req.params.id);

    if (!surat) {
      return res
        .status(404)
        .json({ success: false, message: "Surat pelanggaran not found." });
    }

    const updates = {};
    if (req.body.status) {
      updates.status = req.body.status;
      if (req.body.status === "resolved") {
        updates.resolvedAt = new Date();
      }
    }
    if (req.body.notes) updates.notes = req.body.notes;

    await surat.update(updates);

    res.json({
      success: true,
      message: "Surat pelanggaran updated.",
      data: surat,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/inspection/surat-pelanggaran/check-overdue
// Checks all follow-ups past deadline and auto-issues surat pelanggaran
async function checkOverdueFollowUps(req, res) {
  try {
    const now = new Date();

    // Find follow-ups that are overdue and don't already have a surat pelanggaran
    const overdueFollowUps = await InspectionFollowUp.findAll({
      where: {
        deadline: { [Op.lt]: now },
        status: { [Op.notIn]: ["approved", "rejected"] },
        suratPelanggaranId: null,
      },
      include: [
        {
          association: "report",
          include: [
            {
              association: "schedule",
              attributes: ["title", "location", "unitKerja"],
            },
          ],
        },
      ],
    });

    const createdSurats = [];

    for (const fu of overdueFollowUps) {
      const schedule = fu.report?.schedule;
      const nomorSurat = `SP-K3-${fu.id}-${Date.now()}`;

      const surat = await SuratPelanggaran.create({
        followUpId: fu.id,
        nomorSurat,
        jenisTemuan: fu.kategoriK3 || "umum",
        lokasi: schedule?.location || "-",
        deskripsi: fu.description || "Follow-up melewati batas waktu.",
        pelanggar: fu.assignedTechnician || "-",
        deadline: fu.deadline,
        status: "issued",
        issuedBy: req.user.nik,
        issuedAt: now,
        notes: "Auto-generated: follow-up overdue.",
      });

      await fu.update({ suratPelanggaranId: surat.id });
      createdSurats.push(surat);
    }

    res.json({
      success: true,
      message: `${createdSurats.length} surat pelanggaran issued for overdue follow-ups.`,
      data: createdSurats,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listSuratPelanggaran,
  getSuratPelanggaran,
  createSuratPelanggaran,
  updateSuratPelanggaran,
  checkOverdueFollowUps,
};
