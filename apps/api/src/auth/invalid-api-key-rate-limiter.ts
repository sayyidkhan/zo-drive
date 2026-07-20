type FailedAttempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};

type InvalidApiKeyRateLimiterOptions = {
  blockDurationMs?: number;
  maxEntries?: number;
  maxAttempts?: number;
  now?: () => number;
  windowMs?: number;
};

export class InvalidApiKeyRateLimiter {
  private readonly attempts = new Map<string, FailedAttempt>();
  private readonly blockDurationMs: number;
  private readonly maxEntries: number;
  private readonly maxAttempts: number;
  private readonly now: () => number;
  private readonly windowMs: number;

  constructor({ blockDurationMs = 15 * 60_000, maxEntries = 10_000, maxAttempts = 5, now = Date.now, windowMs = 60_000 }: InvalidApiKeyRateLimiterOptions = {}) {
    this.blockDurationMs = blockDurationMs;
    this.maxEntries = maxEntries;
    this.maxAttempts = maxAttempts;
    this.now = now;
    this.windowMs = windowMs;
  }

  clear(client: string): void {
    this.attempts.delete(client);
  }

  recordFailure(client: string): number {
    const now = this.now();
    const existing = this.attempts.get(client);
    if (existing && existing.blockedUntil > now) return retryAfterSeconds(existing.blockedUntil - now);

    const attempt = !existing || now - existing.windowStartedAt >= this.windowMs
      ? { blockedUntil: 0, failures: 0, windowStartedAt: now }
      : existing;
    attempt.failures += 1;
    if (attempt.failures >= this.maxAttempts) attempt.blockedUntil = now + this.blockDurationMs;
    this.remember(client, attempt);
    return attempt.blockedUntil > now ? retryAfterSeconds(attempt.blockedUntil - now) : 0;
  }

  retryAfterSeconds(client: string): number {
    const blockedUntil = this.attempts.get(client)?.blockedUntil ?? 0;
    const remaining = blockedUntil - this.now();
    if (remaining <= 0) {
      if (blockedUntil > 0) this.attempts.delete(client);
      return 0;
    }
    return retryAfterSeconds(remaining);
  }

  private remember(client: string, attempt: FailedAttempt): void {
    if (!this.attempts.has(client) && this.attempts.size >= this.maxEntries) {
      const oldestClient = this.attempts.keys().next().value;
      if (oldestClient) this.attempts.delete(oldestClient);
    }
    this.attempts.set(client, attempt);
  }
}

function retryAfterSeconds(milliseconds: number): number {
  return Math.max(1, Math.ceil(milliseconds / 1_000));
}
