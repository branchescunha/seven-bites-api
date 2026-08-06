const buckets = new Map();

const cleanBuckets = (now) => {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export const rateLimit = ({
  keyPrefix,
  limit,
  windowMs,
  message = 'Too many requests. Try again later.',
}) => {
  return (request, response, next) => {
    const now = Date.now();
    cleanBuckets(now);

    const key = `${keyPrefix}:${request.ip}`;
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    response.setHeader(
      'RateLimit-Reset',
      String(Math.ceil((bucket.resetAt - now) / 1000)),
    );

    if (bucket.count > limit) {
      return response.status(429).json({
        error: message,
        requestId: request.id,
      });
    }

    return next();
  };
};
