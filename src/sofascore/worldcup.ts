import type { RawEvent, RawSeason } from "./api.js";
import type { FootballApi } from "./provider.js";
import type { BracketRound, MatchSummary, WorldCupData, WorldCupView } from "../shared/shapes.js";
import { matchSummary, mapStandingsGroups } from "./shape.js";

/** SofaScore's unique-tournament id for the FIFA World Cup. */
export const WORLD_CUP_ID = 16;

// Lowercase substrings, ordered from earliest knockout round to the final.
// (2026 format: the first knockout round is the Round of 32.) "3rd place" is
// checked before "final" so it doesn't get swallowed by the substring match.
const KNOCKOUT_ORDER = [
  "round of 32",
  "round of 16",
  "quarterfinal",
  "semifinal",
  "3rd place",
  "final",
];

function knockoutRank(name: string): number {
  const n = name.toLowerCase();
  return KNOCKOUT_ORDER.findIndex((k) => n.includes(k));
}

function isKnockout(ev: RawEvent): boolean {
  return knockoutRank(ev.roundInfo?.name ?? "") !== -1;
}

/** Pick the most relevant World Cup season (prefer 2026, else newest). */
export function pickSeason(seasons: RawSeason[]): RawSeason | undefined {
  if (!seasons?.length) return undefined;
  return (
    seasons.find((s) => (s.year ?? s.name ?? "").includes("2026")) ?? seasons[0]
  );
}

function orderKnockout(rounds: BracketRound[]): BracketRound[] {
  return [...rounds].sort((a, b) => {
    const ai = knockoutRank(a.name);
    const bi = knockoutRank(b.name);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/** Assemble the World Cup hub payload for the requested view. */
export async function buildWorldCup(
  api: FootballApi,
  view: WorldCupView,
): Promise<WorldCupData> {
  const { seasons } = await api.seasons(WORLD_CUP_ID);
  const season = pickSeason(seasons);
  if (!season) {
    throw new Error("Could not resolve a FIFA World Cup season from SofaScore.");
  }

  const [standingsRes, next, last] = await Promise.all([
    api.standings(WORLD_CUP_ID, season.id).catch(() => ({ standings: [] })),
    api.nextEvents(WORLD_CUP_ID, season.id).catch(() => ({ events: [] as RawEvent[] })),
    api.lastEvents(WORLD_CUP_ID, season.id).catch(() => ({ events: [] as RawEvent[] })),
  ]);

  const groups = mapStandingsGroups(standingsRes.standings ?? []);

  // Merge & de-dupe events across next/last pages.
  const byId = new Map<number, RawEvent>();
  for (const ev of [...(last.events ?? []), ...(next.events ?? [])]) byId.set(ev.id, ev);
  const allEvents = [...byId.values()].sort(
    (a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0),
  );

  // Knockout bracket grouped by round name.
  const koMap = new Map<string, MatchSummary[]>();
  for (const ev of allEvents) {
    if (!isKnockout(ev)) continue;
    const name = ev.roundInfo?.name ?? "Knockout";
    if (!koMap.has(name)) koMap.set(name, []);
    koMap.get(name)!.push(matchSummary(ev));
  }
  const knockout = orderKnockout(
    [...koMap.entries()].map(([name, matches]) => ({ name, matches })),
  );

  // "Matches" view: live first, then soonest upcoming / most recent.
  const summaries = allEvents.map(matchSummary);
  const live = summaries.filter((m) => m.status.live);
  const rest = summaries.filter((m) => !m.status.live);
  const matches = [...live, ...rest].slice(0, 24);

  return {
    view,
    tournament: {
      id: WORLD_CUP_ID,
      name: "FIFA World Cup",
      categoryName: "World",
    },
    seasonName: season.name ?? season.year ?? "World Cup",
    tagline: "48 teams · USA · Canada · Mexico",
    groups,
    knockout,
    matches,
    highlight: live.length
      ? `${live.length} match${live.length > 1 ? "es" : ""} live now`
      : undefined,
  };
}
