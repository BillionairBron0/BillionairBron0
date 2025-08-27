export function requirePro(req, res, next) {
  if (req.user && req.user.plan === 'PRO') return next();
  return res.status(402).json({ error: 'pro_plan_required' });
}