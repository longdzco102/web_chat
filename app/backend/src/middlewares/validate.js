/**
 * middlewares/validate.js – Request validation helpers
 * Usage: router.post('/path', validate(rules), controller)
 */

/**
 * Simple rule-based validator.
 * rules: { fieldName: 'required|min:6|email' }
 */
function validate(rules) {
  return (req, res, next) => {
    const errors = [];
    const body   = req.body ?? {};

    for (const [field, ruleStr] of Object.entries(rules)) {
      const val   = body[field];
      const rList = ruleStr.split('|');

      for (const rule of rList) {
        if (rule === 'required' && (val === undefined || val === null || String(val).trim() === '')) {
          errors.push(`${field}: bắt buộc nhập`); break;
        }
        if (val === undefined || val === null) break; // skip other rules if empty & not required
        if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          errors.push(`${field}: không đúng định dạng email`);
        }
        if (rule.startsWith('min:')) {
          const min = parseInt(rule.slice(4));
          if (String(val).length < min) errors.push(`${field}: tối thiểu ${min} ký tự`);
        }
        if (rule.startsWith('max:')) {
          const max = parseInt(rule.slice(4));
          if (String(val).length > max) errors.push(`${field}: tối đa ${max} ký tự`);
        }
        if (rule === 'number' && isNaN(Number(val))) {
          errors.push(`${field}: phải là số`);
        }
      }
    }

    if (errors.length) return res.status(422).json({ errors });
    next();
  };
}

module.exports = { validate };
