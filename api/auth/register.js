import { allowMethods, body, isEmail, mockUser, sendJson } from '../../_lib/http.js';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const { name, email, password } = body(req);
  if (typeof name !== 'string' || name.trim().length < 2) {
    return sendJson(res, 400, { success: false, error: 'Name must contain at least 2 characters.' });
  }
  if (!isEmail(email) || typeof password !== 'string' || password.length < 6) {
    return sendJson(res, 400, { success: false, error: 'Enter a valid email and a password of at least 6 characters.' });
  }
  return sendJson(res, 201, { success: true, message: 'Mock account created.', user: mockUser({ name, email }), token: null });
}
