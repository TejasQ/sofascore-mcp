const BASE = "https://api.sofascore.com/api/v1";

/** SofaScore public image URLs (loaded client-side inside the iframe). */
export const img = {
  team: (id?: number) => (id ? `${BASE}/team/${id}/image` : undefined),
  tournament: (id?: number) => (id ? `${BASE}/unique-tournament/${id}/image` : undefined),
  player: (id?: number) => (id ? `${BASE}/player/${id}/image` : undefined),
};

/** 1–3 letter monogram used as the crest fallback when an image can't load. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
