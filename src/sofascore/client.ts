/**
 * Thin HTTP client for SofaScore's public JSON API.
 *
 * SofaScore returns 403 for requests without a browser-like `User-Agent`, so we
 * always send one. `fetch` is injectable so tests / offline runs (SOFA_MOCK=1)
 * can swap in a fixture-backed implementation without touching the network.
 */

export const SOFA_BASE = "https://api.sofascore.com/api/v1";
export const SOFA_IMG_BASE = "https://api.sofascore.com/api/v1";

type FetchLike = typeof fetch;

export interface ClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class SofaScoreError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
  ) {
    super(message);
    this.name = "SofaScoreError";
  }
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.sofascore.com/",
  Origin: "https://www.sofascore.com",
};

interface CacheEntry {
  at: number;
  value: unknown;
}

export class SofaScoreClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? SOFA_BASE;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.cacheTtlMs = opts.cacheTtlMs ?? 20_000;
  }

  /** GET a JSON path (relative to the API base), with a short TTL cache. */
  async get<T = unknown>(path: string): Promise<T> {
    const cached = this.cache.get(path);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.value as T;
    }

    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        headers: BROWSER_HEADERS,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new SofaScoreError(
          `SofaScore request failed (${res.status} ${res.statusText})`,
          res.status,
          path,
        );
      }
      const value = (await res.json()) as T;
      this.cache.set(path, { at: Date.now(), value });
      return value;
    } catch (err) {
      if (err instanceof SofaScoreError) throw err;
      const message =
        err instanceof Error && err.name === "AbortError"
          ? `SofaScore request timed out after ${this.timeoutMs}ms`
          : `SofaScore request errored: ${(err as Error).message}`;
      throw new SofaScoreError(message, undefined, path);
    } finally {
      clearTimeout(timer);
    }
  }
}
