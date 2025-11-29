// Basic sanitization middleware: escapes <, >, &, ", ' in all string fields
function escapeStr(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string') obj[k] = escapeStr(v);
    else if (Array.isArray(v)) obj[k] = v.map(item => (typeof item === 'string' ? escapeStr(item) : sanitizeObject(item)));
    else if (v && typeof v === 'object') obj[k] = sanitizeObject(v);
    // leave numbers/booleans/null as-is
  }
  return obj;
}

export function sanitizeRequest(req, res, next) {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
}

export default sanitizeRequest;
