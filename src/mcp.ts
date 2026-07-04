import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SofaScoreApi } from "./sofascore/api.js";
import { registerResources } from "./resources.js";
import { registerAllTools } from "./tools/index.js";

export const SERVER_INSTRUCTIONS = [
  "SofaScore football companion. Use these tools whenever the user asks about",
  "football (soccer): live scores, fixtures, results, league tables, players or",
  "— especially — the FIFA World Cup.",
  "",
  "- world_cup: anything about the World Cup / Mundial (groups, bracket, WC scores).",
  "- list_matches: 'what's on today', live scores, matches on a date, a league's fixtures.",
  "- get_match: full detail of one match once you have its event id.",
  "- get_standings: a competition's league table.",
  "- search_football: find a team / player / competition by name.",
  "Each tool renders an interactive widget; keep your text reply short since the",
  "widget shows the detail.",
].join("\n");

/** Create a fresh MCP server instance (one per request in stateless HTTP mode). */
export function createMcpServer(api: SofaScoreApi): McpServer {
  const server = new McpServer(
    { name: "sofascore-mcp", version: "0.1.0" },
    {
      instructions: SERVER_INSTRUCTIONS,
      capabilities: { tools: {}, resources: {} },
    },
  );
  registerResources(server);
  registerAllTools(server, api);
  return server;
}
