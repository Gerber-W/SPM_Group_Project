const isEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const isTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const isId = value => Number.isInteger(Number(value)) && Number(value) > 0;

function validateBody(rules) {
  return (req, res, next) => {
    const body = req.body || {};
    const errors = Object.entries(rules)
      .filter(([field, [check]]) => !check(body[field]))
      .map(([field, [, message]]) => ({ field, message }));

    if (errors.length) {
      return res.status(400).json({ error: errors.map(e => e.message).join(', '), fields: errors });
    }
    next();
  };
}

module.exports = { isEmail, isDate, isTime, isText, isId, validateBody };
