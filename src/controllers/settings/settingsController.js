'use strict';

const fs   = require('fs');
const path = require('path');

const TEMPLATES_PATH = path.join(__dirname, '..', '..', '..', 'data', 'role_templates.json');

const getRoleTemplates = (req, res) => {
  try {
    const raw = fs.existsSync(TEMPLATES_PATH) ? fs.readFileSync(TEMPLATES_PATH, 'utf8') : '{}';
    res.json(JSON.parse(raw));
  } catch (e) {
    res.status(500).json({ error: 'Gagal membaca role templates: ' + e.message });
  }
};

const updateRoleTemplates = (req, res) => {
  try {
    fs.writeFileSync(TEMPLATES_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menyimpan role templates: ' + e.message });
  }
};

module.exports = { getRoleTemplates, updateRoleTemplates };
