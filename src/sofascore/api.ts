import { SofaScoreClient } from "./client.js";
import type { FootballApi } from "./provider.js";

/**
 * Typed wrappers around the SofaScore REST endpoints we use. Responses are kept
 * as loose `raw` shapes here; `shape.ts` maps them into the compact
 * `structuredContent` objects the widgets consume.
 */

// ---- Raw response fragments (only the fields we read) ----------------------

export interface RawTeam {
  id: number;
  name: string;
  shortName?: string;
  nameCode?: string;
  country?: { alpha2?: string; alpha3?: string; name?: string };
}

export interface RawEvent {
  id: number;
  tournament?: {
    name?: string;
    uniqueTournament?: { id?: number; name?: string };
    category?: { name?: string };
  };
  season?: { id?: number; name?: string };
  roundInfo?: { round?: number; name?: string; cupRoundType?: number };
  status?: { code?: number; description?: string; type?: string };
  startTimestamp?: number;
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  homeScore?: { current?: number; display?: number };
  awayScore?: { current?: number; display?: number };
}

export interface RawIncident {
  incidentType?: string;
  incidentClass?: string;
  isHome?: boolean;
  time?: number;
  addedTime?: number;
  player?: { name?: string };
  assist1?: { name?: string };
  playerIn?: { name?: string };
  playerOut?: { name?: string };
  homeScore?: number;
  awayScore?: number;
  text?: string;
}

export interface RawStatItem {
  name: string;
  home: string;
  away: string;
  homeValue?: number;
  awayValue?: number;
  statisticsType?: string;
}

export interface RawStandingRow {
  team: RawTeam;
  position: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  scoresFor: number;
  scoresAgainst: number;
  points: number;
  promotion?: { text?: string };
}

export interface RawSeason {
  id: number;
  year?: string;
  name?: string;
}

export class SofaScoreApi implements FootballApi {
  constructor(private readonly client: SofaScoreClient) {}

  /** Fetch a SofaScore image (relative path) server-side for the image proxy. */
  image(path: string): Promise<{ body: ArrayBuffer; contentType: string }> {
    return this.client.getBinary(path);
  }

  scheduledFootball(date: string) {
    return this.client.get<{ events: RawEvent[] }>(
      `/sport/football/scheduled-events/${date}`,
    );
  }

  liveFootball() {
    return this.client.get<{ events: RawEvent[] }>(
      `/sport/football/events/live`,
    );
  }

  event(id: number) {
    return this.client.get<{ event: RawEvent }>(`/event/${id}`);
  }

  incidents(id: number) {
    return this.client.get<{ incidents: RawIncident[] }>(
      `/event/${id}/incidents`,
    );
  }

  statistics(id: number) {
    return this.client.get<{
      statistics: Array<{
        period: string;
        groups: Array<{ statisticsItems: RawStatItem[] }>;
      }>;
    }>(`/event/${id}/statistics`);
  }

  momentum(id: number) {
    return this.client.get<{ graphPoints: Array<{ minute: number; value: number }> }>(
      `/event/${id}/graph`,
    );
  }

  seasons(uniqueTournamentId: number) {
    return this.client.get<{ seasons: RawSeason[] }>(
      `/unique-tournament/${uniqueTournamentId}/seasons`,
    );
  }

  standings(uniqueTournamentId: number, seasonId: number) {
    return this.client.get<{
      standings: Array<{
        name?: string;
        tournament?: { name?: string; uniqueTournament?: { id?: number; name?: string } };
        rows: RawStandingRow[];
      }>;
    }>(`/unique-tournament/${uniqueTournamentId}/season/${seasonId}/standings/total`);
  }

  /** Upcoming events for a season (page 0). */
  nextEvents(uniqueTournamentId: number, seasonId: number) {
    return this.client.get<{ events: RawEvent[] }>(
      `/unique-tournament/${uniqueTournamentId}/season/${seasonId}/events/next/0`,
    );
  }

  /** Most recent events for a season (page 0). */
  lastEvents(uniqueTournamentId: number, seasonId: number) {
    return this.client.get<{ events: RawEvent[] }>(
      `/unique-tournament/${uniqueTournamentId}/season/${seasonId}/events/last/0`,
    );
  }

  search(query: string) {
    return this.client.get<{
      results: Array<{ type: string; entity: Record<string, unknown> }>;
    }>(`/search/all?q=${encodeURIComponent(query)}&page=0`);
  }
}
