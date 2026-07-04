/**
 * Shared `structuredContent` shapes.
 *
 * These are the exact objects a tool returns as `structuredContent` and that the
 * matching widget reads from `window.openai.toolOutput`. Single source of truth
 * imported by both the server (src/**) and the widgets (widgets/**).
 */

export interface TeamRef {
  id: number;
  name: string;
  shortName?: string;
  /** 3-letter code used for national teams / flags, e.g. "ARG". */
  countryCode?: string;
}

export interface TournamentRef {
  id: number;
  name: string;
  categoryName?: string;
}

export type MatchStatusType =
  | "notstarted"
  | "inprogress"
  | "finished"
  | "postponed"
  | "canceled"
  | "unknown";

export interface MatchStatus {
  type: MatchStatusType;
  /** Human label: "FT", "HT", "72'", "19:00", "Postponed". */
  text: string;
  live: boolean;
}

export interface MatchSummary {
  id: number;
  tournament: TournamentRef;
  status: MatchStatus;
  startTimestamp: number;
  round?: string;
  home: TeamRef;
  away: TeamRef;
  homeScore?: number;
  awayScore?: number;
}

export interface MatchesData {
  title: string;
  subtitle?: string;
  /** ISO date (YYYY-MM-DD) the list covers, if date-scoped. */
  date?: string;
  liveOnly?: boolean;
  count: number;
  groups: Array<{ tournament: TournamentRef; matches: MatchSummary[] }>;
}

export interface Incident {
  type: "goal" | "card" | "substitution" | "period" | "injuryTime";
  team?: "home" | "away";
  minute?: number;
  addedMinute?: number;
  player?: string;
  assist?: string;
  detail?: string;
  scoreHome?: number;
  scoreAway?: number;
  cardColor?: "yellow" | "red";
  goalType?: "regular" | "penalty" | "own" | "ownGoal";
}

export interface Stat {
  name: string;
  home: string;
  away: string;
  /** Numeric interpretation (0-100 for percentages) used to size bars. */
  homeValue?: number;
  awayValue?: number;
}

export interface MatchDetail {
  id: number;
  tournament: TournamentRef;
  seasonName?: string;
  round?: string;
  venue?: string;
  status: MatchStatus;
  startTimestamp: number;
  home: TeamRef;
  away: TeamRef;
  homeScore?: number;
  awayScore?: number;
  incidents: Incident[];
  statistics: Stat[];
  momentum?: Array<{ minute: number; value: number }>;
}

export interface StandingRow {
  position: number;
  team: TeamRef;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** e.g. "Qualification", "Champions League", "Relegation". */
  promotion?: string;
  /** Recent results, newest last: "W" | "D" | "L". */
  form?: string[];
}

export interface StandingsGroup {
  name?: string;
  rows: StandingRow[];
}

export interface StandingsData {
  tournament: TournamentRef;
  seasonName?: string;
  groups: StandingsGroup[];
}

export interface BracketRound {
  name: string;
  matches: MatchSummary[];
}

export type WorldCupView = "overview" | "groups" | "knockout" | "matches";

export interface WorldCupData {
  view: WorldCupView;
  tournament: TournamentRef;
  seasonName: string;
  /** Short editorial line for the hero, e.g. "48 teams · 16 cities". */
  tagline?: string;
  groups: StandingsGroup[];
  knockout: BracketRound[];
  matches: MatchSummary[];
  highlight?: string;
}

export type SearchResultType =
  | "team"
  | "player"
  | "tournament"
  | "manager"
  | "referee";

export interface SearchResult {
  type: SearchResultType;
  id: number;
  name: string;
  subtitle?: string;
  countryCode?: string;
  /** For players: the team id, so the UI can show a crest. */
  teamId?: number;
  sport?: string;
}

export interface SearchData {
  query: string;
  count: number;
  results: SearchResult[];
}
