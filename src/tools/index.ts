import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SofaScoreApi } from "../sofascore/api.js";
import { registerListMatches } from "./listMatches.js";
import { registerGetMatch } from "./getMatch.js";
import { registerStandings } from "./standings.js";
import { registerWorldCup } from "./worldCup.js";
import { registerSearch } from "./search.js";

export function registerAllTools(server: McpServer, api: SofaScoreApi) {
  registerWorldCup(server, api);
  registerListMatches(server, api);
  registerGetMatch(server, api);
  registerStandings(server, api);
  registerSearch(server, api);
}
