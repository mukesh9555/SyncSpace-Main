import { allowMethods, body, sendJson } from './_lib/http.js';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const { rating, message } = body(req);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof message !== 'string' || message.trim().length < 3) {
    return sendJson(res, 400, { success: false, error: 'Choose a rating from 1 to 5 and enter at least 3 characters of feedback.' });
  }
  return sendJson(res, 201, { success: true, message: 'Thanks for your feedback!', reference: `feedback_${Date.now()}` });
}
