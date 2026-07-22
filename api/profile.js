import { allowMethods, sendJson } from './_lib/http.js';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  return sendJson(res, 200, {
    success: true,
    profile: { id: 'mock_profile', name: 'SyncSpace Member', email: 'member@syncspace.local', plan: 'Free', joinedAt: '2026-01-01T00:00:00.000Z' },
  });
}
