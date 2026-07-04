import { SofaScoreClient } from "./client.js";
import { SofaScoreApi } from "./api.js";
import { createMockFetch } from "./mockFetch.js";

export * from "./client.js";
export * from "./api.js";
export * from "./shape.js";
export * from "./worldcup.js";
export { img } from "./images.js";

/** Build the API client, using fixtures when SOFA_MOCK=1. */
export function createApi(): SofaScoreApi {
  const mock = process.env.SOFA_MOCK === "1";
  const client = new SofaScoreClient(
    mock ? { fetchImpl: createMockFetch(), cacheTtlMs: 0 } : {},
  );
  return new SofaScoreApi(client);
}
