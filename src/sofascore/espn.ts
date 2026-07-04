/**
 * ESPN fallback data source. ESPN's public (unofficial but stable) soccer JSON
 * API is reachable from datacenter IPs where api.sofascore.com is 403'd, so it
 * backs the primary SofaScore source. Everything here maps ESPN responses into
 * the same `Raw*` shapes SofaScore produces, so `shape.ts`, the tools and the
 * widgets are unchanged.
 *
 * Scope: the FIFA World Cup + the top-5 European leagues (+ the Champions League
 * for match lookups). Team ids in the emitted shapes are ESPN team ids, which
 * the image proxy turns into `a.espncdn.com` crest URLs.
 */
import { SofaScoreClient } from "./client.js";
import type {
  RawEvent,
  RawIncident,
  RawSeason,
  RawStandingRow,
  RawStatItem,
  RawTeam,
} from "./api.js";
import type {
  FootballApi,
  MomentumResponse,
  SearchResponse,
  StandingsResponse,
  StatisticsResponse,
} from "./provider.js";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const CORE_STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer";
const WEB_SEARCH = "https://site.web.api.espn.com/apis/common/v3/search";
const CDN = "https://a.espncdn.com/i";

/** ESPN league slug ⇄ SofaScore unique-tournament id + display metadata. */
interface League {
  slug: string;
  sofaId: number;
  name: string;
  country: string;
}
const LEAGUES: League[] = [
  { slug: "fifa.world", sofaId: 16, name: "FIFA World Cup", country: "World" },
  { slug: "eng.1", sofaId: 17, name: "Premier League", country: "England" },
  { slug: "esp.1", sofaId: 8, name: "LaLiga", country: "Spain" },
  { slug: "ita.1", sofaId: 23, name: "Serie A", country: "Italy" },
  { slug: "ger.1", sofaId: 35, name: "Bundesliga", country: "Germany" },
  { slug: "fra.1", sofaId: 34, name: "Ligue 1", country: "France" },
  { slug: "uefa.champions", sofaId: 7, name: "UEFA Champions League", country: "Europe" },
];
const bySofaId = new Map(LEAGUES.map((l) => [l.sofaId, l]));
/** Leagues to fan out over when we only have an event id (get_match). */
const LOOKUP_SLUGS = LEAGUES.map((l) => l.slug);
const WORLD_CUP_SOFA_ID = 16;

/** ESPN `dates=` ranges use YYYYMMDD (no separators). */
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Map ESPN status.type.state / name to SofaScore's status.type. */
function statusType(state?: string, name?: string): string {
  if (name === "STATUS_POSTPONED") return "postponed";
  if (name === "STATUS_CANCELED" || name === "STATUS_CANCELLED") return "canceled";
  switch (state) {
    case "pre":
      return "notstarted";
    case "in":
      return "inprogress";
    case "post":
      return "finished";
    default:
      return "unknown";
  }
}

interface EspnTeam {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logo?: string;
}
function team(t: EspnTeam | undefined): RawTeam {
  return {
    id: Number(t?.id ?? 0),
    name: t?.displayName ?? "Unknown",
    shortName: t?.shortDisplayName ?? t?.abbreviation,
    nameCode: t?.abbreviation,
  };
}

interface EspnCompetitor {
  homeAway?: string;
  team?: EspnTeam;
  score?: string;
}
interface EspnCompetition {
  competitors?: EspnCompetitor[];
  notes?: Array<{ headline?: string }>;
  venue?: { fullName?: string };
  status?: { type?: { state?: string; name?: string; shortDetail?: string; detail?: string; description?: string } };
}
interface EspnEvent {
  id?: string;
  date?: string;
  season?: { year?: number; type?: number };
  status?: { type?: { state?: string; name?: string; shortDetail?: string; detail?: string; description?: string } };
  competitions?: EspnCompetition[];
}

/** ESPN scoreboard/summary event → SofaScore RawEvent. */
function toRawEvent(ev: EspnEvent, league: League | undefined): RawEvent | undefined {
  const comp = ev.competitions?.[0];
  if (!comp) return undefined;
  const home = comp.competitors?.find((c) => c.homeAway === "home") ?? comp.competitors?.[0];
  const away = comp.competitors?.find((c) => c.homeAway === "away") ?? comp.competitors?.[1];
  // Scoreboard events carry status on the event; summary `header` nests it under
  // the competition — accept either.
  const st = ev.status?.type ?? comp.status?.type;
  const roundName = comp.notes?.[0]?.headline;
  return {
    id: Number(ev.id ?? 0),
    tournament: {
      name: league?.name ?? "Football",
      uniqueTournament: { id: league?.sofaId ?? 0, name: league?.name ?? "Football" },
      category: { name: league?.country ?? "" },
    },
    season: ev.season?.year ? { name: String(ev.season.year) } : undefined,
    roundInfo: roundName ? { name: roundName } : undefined,
    status: {
      type: statusType(st?.state, st?.name),
      description: st?.shortDetail ?? st?.detail ?? st?.description,
    },
    startTimestamp: ev.date ? Math.floor(Date.parse(ev.date) / 1000) : undefined,
    homeTeam: team(home?.team),
    awayTeam: team(away?.team),
    homeScore: { current: home?.score !== undefined ? Number(home.score) : undefined },
    awayScore: { current: away?.score !== undefined ? Number(away.score) : undefined },
  };
}

export class EspnApi implements FootballApi {
  private readonly client: SofaScoreClient;
  /** event id → slug it resolved under, so incidents/statistics skip the fan-out. */
  private readonly leagueOfEvent = new Map<number, string>();

  constructor(client?: SofaScoreClient) {
    // Reuse the SofaScore client purely for its browser-headers + proxy + cache;
    // all ESPN calls pass absolute URLs so its baseUrl is irrelevant.
    this.client = client ?? new SofaScoreClient({});
  }

  private scoreboard(slug: string, dates?: string) {
    const q = dates ? `?dates=${dates}` : "";
    return this.client.get<{ events?: EspnEvent[] }>(`${SITE}/${slug}/scoreboard${q}`);
  }

  private league(sofaId: number): League | undefined {
    return bySofaId.get(sofaId);
  }

  // ---- FootballApi ---------------------------------------------------------

  async image(path: string): Promise<{ body: ArrayBuffer; contentType: string }> {
    let url: string | undefined;
    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/team\/(\d+)\/image/))) url = `${CDN}/teamlogos/soccer/500/${m[1]}.png`;
    else if ((m = path.match(/^\/player\/(\d+)\/image/)))
      url = `${CDN}/headshots/soccer/players/full/${m[1]}.png`;
    if (!url) throw new Error(`ESPN has no image mapping for ${path}`);
    return this.client.getBinary(url);
  }

  /** ESPN scoreboard is per-league; fan out over our covered leagues for a day. */
  async scheduledFootball(date: string): Promise<{ events: RawEvent[] }> {
    const dates = date.replace(/-/g, "");
    const results = await Promise.all(
      LEAGUES.map((l) =>
        this.scoreboard(l.slug, dates)
          .then((r) => (r.events ?? []).map((e) => toRawEvent(e, l)))
          .catch(() => []),
      ),
    );
    return { events: results.flat().filter((e): e is RawEvent => Boolean(e)) };
  }

  async liveFootball(): Promise<{ events: RawEvent[] }> {
    // ESPN has no cross-league "live" feed; today's scoreboards, filtered to in-play.
    const today = ymd(new Date());
    const { events } = await this.scheduledFootball(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}`);
    return { events: events.filter((e) => e.status?.type === "inprogress") };
  }

  async event(id: number): Promise<{ event: RawEvent | undefined }> {
    const known = this.leagueOfEvent.get(id);
    const slugs = known ? [known, ...LOOKUP_SLUGS.filter((s) => s !== known)] : LOOKUP_SLUGS;
    for (const slug of slugs) {
      try {
        const sum = await this.client.get<{ header?: EspnEvent }>(
          `${SITE}/${slug}/summary?event=${id}`,
        );
        const header = sum.header;
        if (header && Number(header.id) === id) {
          this.leagueOfEvent.set(id, slug);
          return { event: toRawEvent(header, LEAGUES.find((l) => l.slug === slug)) };
        }
      } catch {
        /* try next league */
      }
    }
    return { event: undefined };
  }

  private async summary(id: number): Promise<any | undefined> {
    const known = this.leagueOfEvent.get(id);
    const slugs = known ? [known] : LOOKUP_SLUGS;
    for (const slug of slugs) {
      try {
        const sum = await this.client.get<any>(`${SITE}/${slug}/summary?event=${id}`);
        if (sum?.header && Number(sum.header.id) === id) {
          this.leagueOfEvent.set(id, slug);
          return sum;
        }
      } catch {
        /* try next */
      }
    }
    return undefined;
  }

  async incidents(id: number): Promise<{ incidents: RawIncident[] }> {
    const sum = await this.summary(id);
    const comp = sum?.header?.competitions?.[0];
    const homeId = comp?.competitors?.find((c: EspnCompetitor) => c.homeAway === "home")?.team?.id;
    const keyEvents: any[] = sum?.keyEvents ?? [];
    const incidents: RawIncident[] = [];
    for (const k of keyEvents) {
      const t = (k.type?.type ?? k.type?.text ?? "").toLowerCase();
      const isHome = k.team?.id !== undefined ? String(k.team.id) === String(homeId) : undefined;
      const minute = parseInt(String(k.clock?.displayValue ?? "").replace(/[^0-9]/g, ""), 10);
      const time = Number.isFinite(minute) ? minute : undefined;
      const parts: any[] = k.participants ?? [];
      const player = parts[0]?.athlete?.displayName ?? k.athletesInvolved?.[0]?.displayName;
      const playerOut = parts[1]?.athlete?.displayName;
      if (/goal/.test(t)) {
        const pen = /penalty/i.test(k.type?.text ?? "");
        const own = /own/i.test(k.type?.text ?? "");
        incidents.push({
          incidentType: "goal",
          incidentClass: own ? "ownGoal" : pen ? "penalty" : "regular",
          isHome,
          time,
          player: player ? { name: player } : undefined,
          homeScore: k.homeScore,
          awayScore: k.awayScore,
        });
      } else if (/yellow|red|card/.test(t)) {
        incidents.push({
          incidentType: "card",
          incidentClass: /red/.test(t) ? "red" : "yellow",
          isHome,
          time,
          player: player ? { name: player } : undefined,
          text: k.type?.text,
        });
      } else if (/substitution|sub/.test(t)) {
        incidents.push({
          incidentType: "substitution",
          isHome,
          time,
          playerIn: player ? { name: player } : undefined,
          playerOut: playerOut ? { name: playerOut } : undefined,
        });
      }
    }
    return { incidents };
  }

  async statistics(id: number): Promise<StatisticsResponse> {
    const sum = await this.summary(id);
    const teams: any[] = sum?.boxscore?.teams ?? [];
    const comp = sum?.header?.competitions?.[0];
    const homeId = comp?.competitors?.find((c: EspnCompetitor) => c.homeAway === "home")?.team?.id;
    const homeTeam = teams.find((t) => String(t.team?.id) === String(homeId)) ?? teams[0];
    const awayTeam = teams.find((t) => t !== homeTeam) ?? teams[1];
    const homeStats: any[] = homeTeam?.statistics ?? [];
    const awayStats: any[] = awayTeam?.statistics ?? [];
    const awayByName = new Map(awayStats.map((s) => [s.name, s]));
    const items: RawStatItem[] = homeStats
      .filter((s) => awayByName.has(s.name))
      .map((s) => {
        const a = awayByName.get(s.name);
        return {
          name: s.label ?? s.displayName ?? s.name,
          home: String(s.displayValue ?? s.value ?? ""),
          away: String(a?.displayValue ?? a?.value ?? ""),
          homeValue: typeof s.value === "number" ? s.value : undefined,
          awayValue: typeof a?.value === "number" ? a.value : undefined,
        };
      });
    return { statistics: items.length ? [{ period: "ALL", groups: [{ statisticsItems: items }] }] : [] };
  }

  async momentum(_id: number): Promise<MomentumResponse> {
    return { graphPoints: [] }; // ESPN exposes no momentum graph.
  }

  async seasons(uniqueTournamentId: number): Promise<{ seasons: RawSeason[] }> {
    // Synthetic single season so the World-Cup / standings flow has an id to
    // thread through. The World Cup pins 2026; leagues use the current year.
    const year = uniqueTournamentId === WORLD_CUP_SOFA_ID ? 2026 : new Date().getUTCFullYear();
    return { seasons: [{ id: year, year: String(year), name: String(year) }] };
  }

  async standings(uniqueTournamentId: number, seasonId: number): Promise<StandingsResponse> {
    const league = this.league(uniqueTournamentId);
    if (!league) return { standings: [] };
    const root = await this.client.get<any>(
      `${CORE_STANDINGS}/${league.slug}/standings?season=${seasonId}`,
    );
    const children: any[] = root?.children?.length
      ? root.children
      : [{ name: undefined, standings: root?.standings }];
    const meta = {
      name: league.name,
      uniqueTournament: { id: league.sofaId, name: league.name },
    };
    const standings = children
      .map((c) => ({
        name: c.name as string | undefined,
        tournament: meta,
        rows: ((c.standings?.entries ?? []) as any[]).map(standingRow),
      }))
      .filter((g) => g.rows.length);
    return { standings };
  }

  async nextEvents(uniqueTournamentId: number, _seasonId: number): Promise<{ events: RawEvent[] }> {
    const evs = await this.rangeEvents(uniqueTournamentId);
    const now = Date.now() / 1000;
    return { events: evs.filter((e) => (e.startTimestamp ?? 0) >= now) };
  }

  async lastEvents(uniqueTournamentId: number, _seasonId: number): Promise<{ events: RawEvent[] }> {
    const evs = await this.rangeEvents(uniqueTournamentId);
    const now = Date.now() / 1000;
    return { events: evs.filter((e) => (e.startTimestamp ?? 0) < now).reverse() };
  }

  /** All events for a league across a window: WC tournament span, else now ±35d. */
  private async rangeEvents(uniqueTournamentId: number): Promise<RawEvent[]> {
    const league = this.league(uniqueTournamentId);
    if (!league) return [];
    let range: string;
    if (uniqueTournamentId === WORLD_CUP_SOFA_ID) {
      range = "20260601-20260731";
    } else {
      const now = new Date();
      const start = new Date(now.getTime() - 35 * 864e5);
      const end = new Date(now.getTime() + 35 * 864e5);
      range = `${ymd(start)}-${ymd(end)}`;
    }
    const r = await this.scoreboard(league.slug, range).catch(() => ({ events: [] as EspnEvent[] }));
    return (r.events ?? [])
      .map((e) => toRawEvent(e, league))
      .filter((e): e is RawEvent => Boolean(e))
      .sort((a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0));
  }

  async search(query: string): Promise<SearchResponse> {
    const data = await this.client
      .get<{ items?: any[] }>(`${WEB_SEARCH}?query=${encodeURIComponent(query)}&limit=20&sport=soccer`)
      .catch(() => ({ items: [] as any[] }));
    const results = (data.items ?? [])
      .map((it): { type: string; entity: Record<string, unknown> } | null => {
        const id = Number(it.id ?? 0);
        if (!id) return null;
        switch (it.type) {
          case "team":
            return {
              type: "team",
              entity: { id, name: it.displayName, country: { name: it.location }, sport: { name: "Football" } },
            };
          case "player":
            return {
              type: "player",
              entity: { id, name: it.displayName, team: { name: it.subtitle ?? it.location } },
            };
          case "league":
            return { type: "uniqueTournament", entity: { id, name: it.displayName } };
          default:
            return null;
        }
      })
      .filter((x): x is { type: string; entity: Record<string, unknown> } => x !== null);
    return { results };
  }
}

function stat(entry: any, name: string): number {
  const s = (entry.stats ?? []).find((x: any) => x.name === name);
  return s ? Number(s.value ?? 0) : 0;
}

function standingRow(entry: any): RawStandingRow {
  return {
    team: team(entry.team),
    position: stat(entry, "rank"),
    matches: stat(entry, "gamesPlayed"),
    wins: stat(entry, "wins"),
    draws: stat(entry, "ties"),
    losses: stat(entry, "losses"),
    scoresFor: stat(entry, "pointsFor"),
    scoresAgainst: stat(entry, "pointsAgainst"),
    points: stat(entry, "points"),
    promotion: entry.note?.description ? { text: entry.note.description } : undefined,
  };
}
