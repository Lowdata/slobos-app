const buckets = new Map();
const MAX_BUCKETS = 10_000;

function clientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

export function isRateLimited(req, scope, { limit, windowMs, subject = '' }) {
  const now = Date.now();
  const key = `${scope}:${subject || clientIp(req)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      buckets.delete(buckets.keys().next().value);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}
