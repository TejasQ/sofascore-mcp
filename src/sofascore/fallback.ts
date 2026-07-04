/**
 * Chains two data sources: try the primary (SofaScore, behind its proxy), and
 * on any error — 403, timeout, empty — transparently fall back to the secondary
 * (ESPN). Applied per method, so a single failing call doesn't sink the rest.
 * A short-lived memo skips the primary for a method once it has failed, to avoid
 * paying the SofaScore timeout on every request while it's blocked.
 */
import type { FootballApi } from "./provider.js";

const COOLDOWN_MS = 60_000;

export class FallbackApi implements FootballApi {
  private readonly failedAt = new Map<string, number>();

  constructor(
    private readonly primary: FootballApi,
    private readonly secondary: FootballApi,
  ) {}

  private async run<T>(method: keyof FootballApi, call: (api: FootballApi) => Promise<T>): Promise<T> {
    const cooling = (this.failedAt.get(method) ?? 0) > Date.now() - COOLDOWN_MS;
    if (!cooling) {
      try {
        return await call(this.primary);
      } catch {
        this.failedAt.set(method, Date.now());
      }
    }
    return call(this.secondary);
  }

  image(path: string) {
    return this.run("image", (a) => a.image(path));
  }
  scheduledFootball(date: string) {
    return this.run("scheduledFootball", (a) => a.scheduledFootball(date));
  }
  liveFootball() {
    return this.run("liveFootball", (a) => a.liveFootball());
  }
  event(id: number) {
    return this.run("event", (a) => a.event(id));
  }
  incidents(id: number) {
    return this.run("incidents", (a) => a.incidents(id));
  }
  statistics(id: number) {
    return this.run("statistics", (a) => a.statistics(id));
  }
  momentum(id: number) {
    return this.run("momentum", (a) => a.momentum(id));
  }
  seasons(uniqueTournamentId: number) {
    return this.run("seasons", (a) => a.seasons(uniqueTournamentId));
  }
  standings(uniqueTournamentId: number, seasonId: number) {
    return this.run("standings", (a) => a.standings(uniqueTournamentId, seasonId));
  }
  nextEvents(uniqueTournamentId: number, seasonId: number) {
    return this.run("nextEvents", (a) => a.nextEvents(uniqueTournamentId, seasonId));
  }
  lastEvents(uniqueTournamentId: number, seasonId: number) {
    return this.run("lastEvents", (a) => a.lastEvents(uniqueTournamentId, seasonId));
  }
  search(query: string) {
    return this.run("search", (a) => a.search(query));
  }
}
