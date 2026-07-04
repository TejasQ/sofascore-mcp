import type {
  Incident,
  MatchDetail,
  MatchStatus,
  MatchStatusType,
  MatchSummary,
  SearchResult,
  Stat,
  StandingsGroup,
  TeamRef,
  TournamentRef,
} from "../shared/shapes.js";
import type {
  RawEvent,
  RawIncident,
  RawStandingRow,
  RawStatItem,
  RawTeam,
} from "./api.js";

/** Two-digit zero-padded number. */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** UTC HH:MM label for a unix-seconds timestamp (widgets re-format locally). */
function kickoffLabel(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function teamRef(t: RawTeam): TeamRef {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName ?? t.nameCode,
    countryCode: t.country?.alpha2?.toLowerCase(),
  };
}

export function tournamentRef(ev: RawEvent): TournamentRef {
  const ut = ev.tournament?.uniqueTournament;
  return {
    id: ut?.id ?? 0,
    name: ut?.name ?? ev.tournament?.name ?? "Football",
    categoryName: ev.tournament?.category?.name,
  };
}

export function matchStatus(ev: RawEvent): MatchStatus {
  const type = (ev.status?.type ?? "unknown") as MatchStatusType;
  const desc = ev.status?.description ?? "";
  switch (type) {
    case "finished":
      return { type, text: "FT", live: false };
    case "inprogress":
      return { type, text: desc || "LIVE", live: true };
    case "notstarted":
      return { type, text: kickoffLabel(ev.startTimestamp), live: false };
    case "postponed":
      return { type, text: "Postponed", live: false };
    case "canceled":
      return { type, text: "Canceled", live: false };
    default:
      return { type: "unknown", text: desc || "", live: false };
  }
}

export function matchSummary(ev: RawEvent): MatchSummary {
  return {
    id: ev.id,
    tournament: tournamentRef(ev),
    status: matchStatus(ev),
    startTimestamp: ev.startTimestamp ?? 0,
    round: ev.roundInfo?.name ?? (ev.roundInfo?.round ? `Round ${ev.roundInfo.round}` : undefined),
    home: teamRef(ev.homeTeam),
    away: teamRef(ev.awayTeam),
    homeScore: ev.homeScore?.current ?? ev.homeScore?.display,
    awayScore: ev.awayScore?.current ?? ev.awayScore?.display,
  };
}

/** Group summaries by tournament, preserving live/soonest ordering. */
export function groupByTournament(events: RawEvent[]) {
  const groups = new Map<string, { tournament: TournamentRef; matches: MatchSummary[] }>();
  for (const ev of events) {
    const t = tournamentRef(ev);
    const key = `${t.id}:${t.name}`;
    if (!groups.has(key)) groups.set(key, { tournament: t, matches: [] });
    groups.get(key)!.matches.push(matchSummary(ev));
  }
  return [...groups.values()];
}

export function mapIncident(inc: RawIncident): Incident | null {
  const team: "home" | "away" | undefined =
    inc.isHome === undefined ? undefined : inc.isHome ? "home" : "away";
  const minute = inc.time;
  switch (inc.incidentType) {
    case "goal": {
      const cls = inc.incidentClass ?? "regular";
      const goalType =
        cls === "penalty" ? "penalty" : cls === "ownGoal" ? "ownGoal" : "regular";
      return {
        type: "goal",
        team,
        minute,
        addedMinute: inc.addedTime,
        player: inc.player?.name,
        assist: inc.assist1?.name,
        scoreHome: inc.homeScore,
        scoreAway: inc.awayScore,
        goalType,
      };
    }
    case "card": {
      const cls = inc.incidentClass ?? "yellow";
      return {
        type: "card",
        team,
        minute,
        addedMinute: inc.addedTime,
        player: inc.player?.name,
        detail: inc.text,
        cardColor: cls === "yellow" ? "yellow" : "red",
      };
    }
    case "substitution":
      return {
        type: "substitution",
        team,
        minute,
        player: inc.playerIn?.name,
        detail: inc.playerOut?.name,
      };
    case "period":
      return { type: "period", minute, detail: inc.text };
    default:
      return null;
  }
}

export function mapStatistics(items: RawStatItem[]): Stat[] {
  return items.map((it) => {
    let homeValue = it.homeValue;
    let awayValue = it.awayValue;
    if (homeValue === undefined) homeValue = parseNumber(it.home);
    if (awayValue === undefined) awayValue = parseNumber(it.away);
    return { name: it.name, home: it.home, away: it.away, homeValue, awayValue };
  });
}

function parseNumber(s: string): number | undefined {
  const m = /-?\d+(\.\d+)?/.exec(s ?? "");
  return m ? Number(m[0]) : undefined;
}

export function mapStandingRow(row: RawStandingRow) {
  return {
    position: row.position,
    team: teamRef(row.team),
    played: row.matches,
    win: row.wins,
    draw: row.draws,
    loss: row.losses,
    goalsFor: row.scoresFor,
    goalsAgainst: row.scoresAgainst,
    goalDiff: row.scoresFor - row.scoresAgainst,
    points: row.points,
    promotion: row.promotion?.text,
  };
}

export function mapStandingsGroups(
  standings: Array<{ name?: string; rows: RawStandingRow[] }>,
): StandingsGroup[] {
  return standings.map((s) => ({
    name: s.name,
    rows: (s.rows ?? []).map(mapStandingRow),
  }));
}

export function mapSearchResult(entry: {
  type: string;
  entity: Record<string, any>;
}): SearchResult | null {
  const e = entry.entity ?? {};
  switch (entry.type) {
    case "team":
      return {
        type: "team",
        id: e.id,
        name: e.name,
        subtitle: e.country?.name,
        countryCode: e.country?.alpha2?.toLowerCase(),
        sport: e.sport?.name,
      };
    case "player":
      return {
        type: "player",
        id: e.id,
        name: e.name,
        subtitle: e.team?.name,
        teamId: e.team?.id,
      };
    case "uniqueTournament":
      return {
        type: "tournament",
        id: e.id,
        name: e.name,
        subtitle: e.category?.name,
      };
    case "manager":
      return { type: "manager", id: e.id, name: e.name, subtitle: e.team?.name };
    case "referee":
      return { type: "referee", id: e.id, name: e.name, subtitle: e.country?.name };
    default:
      return null;
  }
}
