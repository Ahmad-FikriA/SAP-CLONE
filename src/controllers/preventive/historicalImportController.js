'use strict';

const { parseHistoricalBuffer, importHistorical } = require('../../services/historicalImportService');

const preview = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const orders = parseHistoricalBuffer(req.file.buffer);
    if (!orders.length) return res.status(422).json({ error: 'File kosong atau format tidak dikenali.' });
    const sudah = orders.filter(o => o.sudah).length;
    res.json({ total: orders.length, sudah, belum: orders.length - sudah, orders });
  } catch (err) {
    console.error('[historicalImport.preview]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const confirm = async (req, res) => {
  const { orders } = req.body;
  if (!Array.isArray(orders) || !orders.length) {
    return res.status(400).json({ error: 'orders array diperlukan.' });
  }
  try {
    const result = await importHistorical(orders);
    res.json({ message: 'Import selesai.', ...result });
  } catch (err) {
    console.error('[historicalImport.confirm]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { preview, confirm };
