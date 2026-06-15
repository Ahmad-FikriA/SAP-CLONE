'use strict';


function errorHandler(err, req, res, next) {
  console.error('[ErrorHandler]', err.name, err.message || err);


  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors.map(e => e.message);
    return res.status(400).json({ error: 'Validation Error', details: messages });
  }


  if (err.name === 'SequelizeDatabaseError') {
    return res.status(400).json({ error: 'Database Error', details: err.message });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
}

module.exports = errorHandler;
