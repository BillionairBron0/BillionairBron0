import { userByToken } from '../db.js';

export async function requireToken(req, res, next) {
  const token = req.headers['x-api-token'];
  if (!token && !process.env.API_TOKEN) return next();
  if (process.env.API_TOKEN && token === process.env.API_TOKEN) return next();
  const user = token ? await userByToken(token) : null;
  if (!user) return res.status(401).json({ error:'unauthorized' });
  req.user = user;
  next();
}