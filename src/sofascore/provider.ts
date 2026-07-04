/**
 * The football data-source contract. `SofaScoreApi` is the primary
 * implementation; `EspnApi` is a fallback that maps ESPN's public JSON into the
 * exact same `Raw*` shapes, and `FallbackApi` chains them. Tools, `shape.ts`
 * and the widgets only ever see these shapes, so they don't care which source
 * actually served a given request.
 */
import type {
  RawEvent,
  RawIncident,
  RawSeason,
  RawStandingRow,
  RawStatItem,
} from "./api.js";

export interface StatisticsResponse {
  statistics: Array<{
    period: string;
    groups: Array<{ statisticsItems: RawStatItem[] }>;
  }>;
}

export interface MomentumResponse {
  graphPoints: Array<{ minute: number; value: number }>;
}

export interface StandingsResponse {
  standings: Array<{
    name?: string;
    tournament?: { name?: string; uniqueTournament?: { id?: number; name?: string } };
    rows: RawStandingRow[];
  }>;
}

export interface SearchResponse {
  results: Array<{ type: string; entity: Record<string, unknown> }>;
}

/** Everything a tool can ask a football data source for. */
export interface FootballApi {
  image(path: string): Promise<{ body: ArrayBuffer; contentType: string }>;
  scheduledFootball(date: string): Promise<{ events: RawEvent[] }>;
  liveFootball(): Promise<{ events: RawEvent[] }>;
  event(id: number): Promise<{ event: RawEvent | undefined }>;
  incidents(id: number): Promise<{ incidents: RawIncident[] }>;
  statistics(id: number): Promise<StatisticsResponse>;
  momentum(id: number): Promise<MomentumResponse>;
  seasons(uniqueTournamentId: number): Promise<{ seasons: RawSeason[] }>;
  standings(uniqueTournamentId: number, seasonId: number): Promise<StandingsResponse>;
  nextEvents(uniqueTournamentId: number, seasonId: number): Promise<{ events: RawEvent[] }>;
  lastEvents(uniqueTournamentId: number, seasonId: number): Promise<{ events: RawEvent[] }>;
  search(query: string): Promise<SearchResponse>;
}
