import { userByToken } from '../db';
import { Request, Response, NextFunction } from 'express';

export async function requireToken(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const token = req.headers['x-api-token'] as string | undefined;
  if (!token && !process.env.API_TOKEN) return next();
  if (process.env.API_TOKEN && token === process.env.API_TOKEN) return next();
  const user = token ? await userByToken(token) : null;
  if (!user) return res.status(401).json({ error:'unauthorized' });
  req.user = user;
  next();
}