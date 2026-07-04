import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SofaScoreApi } from "../sofascore/api.js";
import { mapIncident, mapStatistics, matchStatus, teamRef, tournamentRef } from "../sofascore/shape.js";
import type { Incident, MatchDetail, Stat } from "../shared/shapes.js";
import { scoreline, toolError, widgetResult } from "./util.js";

export function registerGetMatch(server: McpServer, api: SofaScoreApi) {
  server.registerTool(
    "get_match",
    {
      title: "Match details",
      description:
        "Get the full detail for one football match by its SofaScore event id: " +
        "score, status, goal & card timeline, team statistics and momentum. Use " +
        "after list_matches / world_cup / search_football when the user drills " +
        "into a specific game.",
      inputSchema: {
        eventId: z.number().int().describe("SofaScore event id for the match."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: {
        "openai/outputTemplate": "ui://sofascore/match.html",
        "openai/toolInvocation/invoking": "Pulling up the match…",
        "openai/toolInvocation/invoked": "Match loaded",
      },
    },
    async ({ eventId }) => {
      try {
        const { event } = await api.event(eventId);
        if (!event) return toolError(`No match found for event ${eventId}.`);

        const [incRes, statRes, momRes] = await Promise.all([
          api.incidents(eventId).catch(() => ({ incidents: [] })),
          api.statistics(eventId).catch(() => ({ statistics: [] })),
          api.momentum(eventId).catch(() => ({ graphPoints: [] })),
        ]);

        const incidents: Incident[] = (incRes.incidents ?? [])
          .map(mapIncident)
          .filter((x): x is Incident => x !== null)
          .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

        const all = (statRes.statistics ?? []).find((s) => s.period === "ALL");
        const statistics: Stat[] = all
          ? mapStatistics(all.groups.flatMap((g) => g.statisticsItems))
          : [];

        const momentum = (momRes.graphPoints ?? []).map((p) => ({
          minute: p.minute,
          value: p.value,
        }));

        const home = teamRef(event.homeTeam);
        const away = teamRef(event.awayTeam);
        const hs = event.homeScore?.current ?? event.homeScore?.display;
        const as = event.awayScore?.current ?? event.awayScore?.display;

        const data: MatchDetail = {
          id: event.id,
          tournament: tournamentRef(event),
          seasonName: event.season?.name,
          round: event.roundInfo?.name,
          status: matchStatus(event),
          startTimestamp: event.startTimestamp ?? 0,
          home,
          away,
          homeScore: hs,
          awayScore: as,
          incidents,
          statistics,
          momentum: momentum.length ? momentum : undefined,
        };

        const status = data.status.live ? ` (${data.status.text})` : data.status.type === "finished" ? " (FT)" : "";
        const summary = `${scoreline(home.name, hs, away.name, as)}${status} — ${data.tournament.name}.`;
        return widgetResult("match", data as unknown as Record<string, unknown>, summary);
      } catch (err) {
        return toolError(`Couldn't load that match: ${(err as Error).message}`);
      }
    },
  );
}
