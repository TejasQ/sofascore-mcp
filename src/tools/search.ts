import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FootballApi } from "../sofascore/provider.js";
import { mapSearchResult } from "../sofascore/shape.js";
import type { SearchData, SearchResult } from "../shared/shapes.js";
import { toolError, widgetResult } from "./util.js";

export function registerSearch(server: McpServer, api: FootballApi) {
  server.registerTool(
    "search_football",
    {
      title: "Search teams, players & competitions",
      description:
        "Search SofaScore for football teams, players, competitions or managers " +
        "by name. Use to find an entity before drilling in (e.g. find a team to " +
        "then get its league table, or a competition id for standings).",
      inputSchema: {
        query: z.string().min(1).describe("What to search for, e.g. 'Argentina' or 'Messi'."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: {
        "openai/outputTemplate": "ui://sofascore/search.html",
        "openai/toolInvocation/invoking": "Searching SofaScore…",
        "openai/toolInvocation/invoked": "Search results",
      },
    },
    async ({ query }) => {
      try {
        const res = await api.search(query);
        const results: SearchResult[] = (res.results ?? [])
          .map(mapSearchResult)
          .filter((x): x is SearchResult => x !== null)
          .slice(0, 24);

        const data: SearchData = { query, count: results.length, results };
        const summary = results.length
          ? `Found ${results.length} result${results.length > 1 ? "s" : ""} for "${query}".`
          : `No results for "${query}".`;
        return widgetResult("search", data as unknown as Record<string, unknown>, summary);
      } catch (err) {
        return toolError(`Search failed: ${(err as Error).message}`);
      }
    },
  );
}
