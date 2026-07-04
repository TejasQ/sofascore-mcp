import { SOFA_IMG_BASE } from "./client.js";

/**
 * Public image URLs served by SofaScore. These load directly in the ChatGPT
 * iframe (client-side), so we only ever pass URLs to the widgets — the server
 * never fetches images.
 */
export const img = {
  team: (id: number) => `${SOFA_IMG_BASE}/team/${id}/image`,
  tournament: (id: number) => `${SOFA_IMG_BASE}/unique-tournament/${id}/image`,
  player: (id: number) => `${SOFA_IMG_BASE}/player/${id}/image`,
  /** National-team / country flag by 2-letter alpha code (lowercased). */
  flag: (alpha2?: string) =>
    alpha2 ? `${SOFA_IMG_BASE}/../img/flags/${alpha2.toLowerCase()}.png` : undefined,
};
