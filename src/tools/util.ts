import { widgetUri, type WidgetName } from "../resources.js";

/** Build a ChatGPT-App tool result: a text summary for the model + structured
 *  data for the widget + the outputTemplate pointer that renders it. */
export function widgetResult(
  widget: WidgetName,
  structuredContent: Record<string, unknown>,
  summary: string,
) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent,
    _meta: { "openai/outputTemplate": widgetUri(widget) },
  };
}

export function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/** Friendly league name → SofaScore unique-tournament id. */
export const TOURNAMENT_IDS: Record<string, number> = {
  "world cup": 16,
  "fifa world cup": 16,
  fifa: 16,
  "premier league": 17,
  epl: 17,
  "la liga": 8,
  laliga: 8,
  "serie a": 23,
  bundesliga: 35,
  "ligue 1": 34,
  "champions league": 7,
  ucl: 7,
  "europa league": 679,
  "euro": 1,
  "european championship": 1,
  "copa america": 133,
  eredivisie: 37,
  "primeira liga": 238,
  mls: 242,
  championship: 18,
  "saudi pro league": 955,
};

export function resolveTournamentId(input: string): number | undefined {
  const key = input.trim().toLowerCase();
  if (TOURNAMENT_IDS[key]) return TOURNAMENT_IDS[key];
  // Fuzzy contains match.
  for (const [name, id] of Object.entries(TOURNAMENT_IDS)) {
    if (key.includes(name) || name.includes(key)) return id;
  }
  return undefined;
}

export function scoreline(
  home: string,
  hs: number | undefined,
  away: string,
  as: number | undefined,
): string {
  if (hs === undefined || as === undefined) return `${home} vs ${away}`;
  return `${home} ${hs}–${as} ${away}`;
}
