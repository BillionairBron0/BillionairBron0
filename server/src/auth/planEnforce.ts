import { Request, Response, NextFunction } from 'express';

export function requirePro(req: Request & { user?: any }, res: Response, next: NextFunction) {
  if (req.user && req.user.plan === 'PRO') return next();
  return res.status(402).json({ error: 'pro_plan_required' });
}