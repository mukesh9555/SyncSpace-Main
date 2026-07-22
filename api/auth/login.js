import { allowMethods, body, isEmail, mockUser, sendJson } from '../../_lib/http.js';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const { email, password } = body(req);
  if (!isEmail(email) || typeof password !== 'string' || password.length < 6) {
    return sendJson(res, 400, { success: false, error: 'Enter a valid email and a password of at least 6 characters.' });
  }
  const user = mockUser({ email });
  return sendJson(res, 200, { success: true, message: 'Mock login successful.', user, token: null });
}
