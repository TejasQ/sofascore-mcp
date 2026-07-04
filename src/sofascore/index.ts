import { SofaScoreClient } from "./client.js";
import { SofaScoreApi } from "./api.js";
import { EspnApi } from "./espn.js";
import { FallbackApi } from "./fallback.js";
import { createMockFetch } from "./mockFetch.js";
import type { FootballApi } from "./provider.js";

export * from "./client.js";
export * from "./api.js";
export * from "./provider.js";
export * from "./shape.js";
export * from "./worldcup.js";
export { img } from "./images.js";

/**
 * Build the football data source.
 * - SOFA_MOCK=1 → fixtures only (offline, deterministic).
 * - ESPN_ONLY=1 → skip SofaScore entirely (useful where it's always blocked).
 * - otherwise   → SofaScore (primary, honours SOFA_PROXY) with ESPN fallback.
 */
export function createApi(): FootballApi {
  if (process.env.SOFA_MOCK === "1") {
    const client = new SofaScoreClient({ fetchImpl: createMockFetch(), cacheTtlMs: 0 });
    return new SofaScoreApi(client);
  }
  const espn = new EspnApi();
  if (process.env.ESPN_ONLY === "1") return espn;
  return new FallbackApi(new SofaScoreApi(new SofaScoreClient({})), espn);
}
