import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SofaScoreApi } from "../sofascore/api.js";
import { groupByTournament } from "../sofascore/shape.js";
import type { MatchesData } from "../shared/shapes.js";
import { resolveTournamentId, toolError, widgetResult } from "./util.js";

const today = () => new Date().toISOString().slice(0, 10);

export function registerListMatches(server: McpServer, api: SofaScoreApi) {
  server.registerTool(
    "list_matches",
    {
      title: "Football matches & live scores",
      description:
        "List football matches with live scores. Use for questions like " +
        "'what football is on today', 'live scores', or matches on a specific " +
        "date. Optionally filter to one competition. Returns an interactive " +
        "scoreboard grouped by tournament.",
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Date as YYYY-MM-DD. Defaults to today."),
        liveOnly: z
          .boolean()
          .optional()
          .describe("Only matches in progress right now."),
        tournament: z
          .string()
          .optional()
          .describe("Filter to a competition, e.g. 'Premier League' or 'World Cup'."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: {
        "openai/outputTemplate": "ui://sofascore/matches.html",
        "openai/toolInvocation/invoking": "Checking the scores…",
        "openai/toolInvocation/invoked": "Here are the matches",
      },
    },
    async ({ date, liveOnly, tournament }) => {
      try {
        const day = date ?? today();
        const res = liveOnly ? await api.liveFootball() : await api.scheduledFootball(day);
        let events = res.events ?? [];

        const filterId = tournament ? resolveTournamentId(tournament) : undefined;
        if (tournament) {
          events = events.filter((e) => {
            const utid = e.tournament?.uniqueTournament?.id;
            if (filterId && utid === filterId) return true;
            const name = (e.tournament?.uniqueTournament?.name ?? e.tournament?.name ?? "").toLowerCase();
            return name.includes(tournament.toLowerCase());
          });
        }

        // Live first, then by kickoff; cap to keep the payload tight.
        events = events
          .slice()
          .sort((a, b) => {
            const al = a.status?.type === "inprogress" ? 0 : 1;
            const bl = b.status?.type === "inprogress" ? 0 : 1;
            if (al !== bl) return al - bl;
            return (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0);
          })
          .slice(0, 80);

        const groups = groupByTournament(events).map((g) => ({
          ...g,
          matches: g.matches.slice(0, 20),
        }));
        const liveCount = events.filter((e) => e.status?.type === "inprogress").length;

        const data: MatchesData = {
          title: liveOnly ? "Live football" : "Football matches",
          subtitle: tournament ? tournament : undefined,
          date: liveOnly ? undefined : day,
          liveOnly: Boolean(liveOnly),
          count: events.length,
          groups,
        };

        const summary = events.length
          ? `${events.length} football match${events.length > 1 ? "es" : ""}` +
            (liveOnly ? " live now" : ` on ${day}`) +
            (liveCount && !liveOnly ? ` (${liveCount} live)` : "") + "."
          : liveOnly
            ? "No football matches are live right now."
            : `No football matches found for ${day}.`;

        return widgetResult("matches", data as unknown as Record<string, unknown>, summary);
      } catch (err) {
        return toolError(`Couldn't load matches: ${(err as Error).message}`);
      }
    },
  );
}
