import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FootballApi } from "../sofascore/provider.js";
import { mapStandingsGroups } from "../sofascore/shape.js";
import { pickSeason, WORLD_CUP_ID } from "../sofascore/worldcup.js";
import type { StandingsData } from "../shared/shapes.js";
import { resolveTournamentId, toolError, widgetResult } from "./util.js";

export function registerStandings(server: McpServer, api: FootballApi) {
  server.registerTool(
    "get_standings",
    {
      title: "League table / standings",
      description:
        "Get the league table (standings) for a competition — points, wins, " +
        "goal difference and rank. Accepts a competition name like 'Premier " +
        "League', 'La Liga' or 'World Cup', or a SofaScore unique-tournament id.",
      inputSchema: {
        tournament: z
          .string()
          .optional()
          .describe("Competition name, e.g. 'Premier League' or 'World Cup'."),
        tournamentId: z
          .number()
          .int()
          .optional()
          .describe("SofaScore unique-tournament id (overrides tournament name)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: {
        "openai/outputTemplate": "ui://sofascore/standings.html",
        "openai/toolInvocation/invoking": "Fetching the table…",
        "openai/toolInvocation/invoked": "Here's the table",
      },
    },
    async ({ tournament, tournamentId }) => {
      try {
        const id =
          tournamentId ?? (tournament ? resolveTournamentId(tournament) : undefined);
        if (!id) {
          return toolError(
            `I don't recognise the competition "${tournament ?? ""}". Try a name like ` +
              `"Premier League", "La Liga" or "World Cup", or pass a tournamentId.`,
          );
        }

        const { seasons } = await api.seasons(id);
        const season = id === WORLD_CUP_ID ? pickSeason(seasons) : seasons?.[0];
        if (!season) return toolError("No season data available for that competition.");

        const { standings } = await api.standings(id, season.id);
        const groups = mapStandingsGroups(standings ?? []);
        const name =
          standings?.[0]?.tournament?.uniqueTournament?.name ??
          standings?.[0]?.tournament?.name ??
          tournament ??
          "Standings";

        const data: StandingsData = {
          tournament: { id, name },
          seasonName: season.name ?? season.year,
          groups,
        };

        const leader = groups[0]?.rows?.[0];
        const summary = leader
          ? `${name} (${data.seasonName}) — ${leader.team.name} lead with ${leader.points} pts.`
          : `${name} standings.`;
        return widgetResult("standings", data as unknown as Record<string, unknown>, summary);
      } catch (err) {
        return toolError(`Couldn't load the table: ${(err as Error).message}`);
      }
    },
  );
}
