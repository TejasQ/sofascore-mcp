const SOFA = "https://api.sofascore.com/api/v1";

/**
 * Base URL of our own MCP server's image proxy, injected into the widget HTML
 * (`window.__SOFA_BASE__`). When present, crests load from `${base}/img/...` on
 * our origin — required inside the ChatGPT Apps sandbox, whose CSP blocks direct
 * api.sofascore.com image loads. When absent (local Inspector), we fall back to
 * loading straight from SofaScore.
 */
const base = (): string =>
  (typeof window !== "undefined" && (window as { __SOFA_BASE__?: string }).__SOFA_BASE__) || "";

const proxied = (kind: string, id: number | string): string => {
  const b = base();
  return b ? `${b}/img/${kind}/${id}` : "";
};

/** SofaScore crest URLs — proxied through our origin when a base URL is set. */
export const img = {
  team: (id?: number) => (id ? proxied("team", id) || `${SOFA}/team/${id}/image` : undefined),
  tournament: (id?: number) =>
    id ? proxied("tournament", id) || `${SOFA}/unique-tournament/${id}/image` : undefined,
  player: (id?: number) => (id ? proxied("player", id) || `${SOFA}/player/${id}/image` : undefined),
};

/** 1–3 letter monogram used as the crest fallback when an image can't load. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
