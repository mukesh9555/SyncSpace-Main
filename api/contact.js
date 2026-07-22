import { allowMethods, body, isEmail, sendJson } from './_lib/http.js';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const { name, email, message } = body(req);
  if (typeof name !== 'string' || name.trim().length < 2 || !isEmail(email) || typeof message !== 'string' || message.trim().length < 10) {
    return sendJson(res, 400, { success: false, error: 'Provide your name, a valid email, and a message of at least 10 characters.' });
  }
  return sendJson(res, 201, { success: true, message: 'Thanks — your mock contact request was received.', reference: `contact_${Date.now()}` });
}
