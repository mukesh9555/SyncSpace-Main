import { allowMethods, sendJson } from '../../_lib/http.js';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  return sendJson(res, 200, { success: true, message: 'Mock session ended.' });
}
