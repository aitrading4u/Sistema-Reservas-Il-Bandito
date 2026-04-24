interface RateLimitOptions {
  key: string;
  windowMs: number;
  max: number;
}

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

function now() {
  return Date.now();
}

function cleanup(current: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= current) {
      store.delete(key);
    }
  }
}

export function applyRateLimit(options: RateLimitOptions) {
  const current = now();
  cleanup(current);

  const existing = store.get(options.key);
  if (!existing || existing.resetAt <= current) {
    const resetAt = current + options.windowMs;
    store.set(options.key, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, retryAfterMs: options.windowMs };
  }

  if (existing.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - current),
    };
  }

  existing.count += 1;
  store.set(options.key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, options.max - existing.count),
    retryAfterMs: Math.max(0, existing.resetAt - current),
  };
}

export function getClientIpFromRequest(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
}
