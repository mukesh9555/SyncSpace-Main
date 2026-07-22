export function sendJson(res, status, body) {
  res.status(status).json(body);
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  sendJson(res, 405, { success: false, error: `Method ${req.method} is not allowed.` });
  return false;
}

export function body(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function mockUser({ name, email }) {
  return {
    id: `mock_${encodeURIComponent(email).replace(/%/g, '')}`,
    name: name?.trim() || email.split('@')[0],
    email: email.trim().toLowerCase(),
    joinedAt: '2026-01-01T00:00:00.000Z',
  };
}
