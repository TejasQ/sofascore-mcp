import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SofaScoreApi } from "../sofascore/api.js";
import { buildWorldCup } from "../sofascore/worldcup.js";
import type { WorldCupView } from "../shared/shapes.js";
import { toolError, widgetResult } from "./util.js";

export function registerWorldCup(server: McpServer, api: SofaScoreApi) {
  server.registerTool(
    "world_cup",
    {
      title: "FIFA World Cup hub",
      description:
        "The FIFA World Cup hub: live & upcoming matches, group standings and the " +
        "knockout bracket. Use for ANY question about the World Cup / the Mundial / " +
        "the FIFA tournament (groups, who's playing, the bracket, scores). Pick a " +
        "view: 'overview' (default), 'groups', 'knockout' or 'matches'.",
      inputSchema: {
        view: z
          .enum(["overview", "groups", "knockout", "matches"])
          .optional()
          .describe("Which section of the World Cup hub to open."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: {
        "openai/outputTemplate": "ui://sofascore/worldcup.html",
        "openai/toolInvocation/invoking": "Heading to the World Cup…",
        "openai/toolInvocation/invoked": "World Cup hub ready",
      },
    },
    async ({ view }) => {
      try {
        const v: WorldCupView = view ?? "overview";
        const data = await buildWorldCup(api, v);

        const bits: string[] = [`${data.tournament.name} — ${data.seasonName}.`];
        if (data.highlight) bits.push(data.highlight + ".");
        if (data.groups.length) bits.push(`${data.groups.length} groups.`);
        const nextLive = data.matches.find((m) => m.status.live) ?? data.matches[0];
        if (nextLive) {
          const s =
            nextLive.homeScore !== undefined
              ? `${nextLive.home.name} ${nextLive.homeScore}–${nextLive.awayScore} ${nextLive.away.name}`
              : `${nextLive.home.name} vs ${nextLive.away.name}`;
          bits.push(`Featured: ${s}.`);
        }

        return widgetResult("worldcup", data as unknown as Record<string, unknown>, bits.join(" "));
      } catch (err) {
        return toolError(`Couldn't load the World Cup hub: ${(err as Error).message}`);
      }
    },
  );
}
