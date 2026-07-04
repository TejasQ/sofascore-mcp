/**
 * Offline end-to-end wiring test. Boots the MCP server with fixture data,
 * connects an in-process MCP client, then lists + calls every tool and asserts:
 *   - the tool advertises an `openai/outputTemplate`
 *   - that template resolves to a registered `ui://` resource
 *   - the call returns non-empty `structuredContent` and a text summary
 * It also writes each call's structuredContent to .artifacts/output/*.json so the
 * screenshot step can render widgets with the exact server output.
 */
process.env.SOFA_MOCK = "1";

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createApi } from "../src/sofascore/index.js";
import { createMcpServer } from "../src/mcp.js";

interface Case {
  file: string; // "<widget>__<variant>"
  tool: string;
  args: Record<string, unknown>;
}

const CASES: Case[] = [
  { file: "worldcup__overview", tool: "world_cup", args: { view: "overview" } },
  { file: "worldcup__groups", tool: "world_cup", args: { view: "groups" } },
  { file: "worldcup__knockout", tool: "world_cup", args: { view: "knockout" } },
  { file: "worldcup__matches", tool: "world_cup", args: { view: "matches" } },
  { file: "matches__today", tool: "list_matches", args: {} },
  { file: "matches__live", tool: "list_matches", args: { liveOnly: true } },
  { file: "match__final", tool: "get_match", args: { eventId: 12000000 } },
  { file: "standings__worldcup", tool: "get_standings", args: { tournament: "World Cup" } },
  { file: "search__argentina", tool: "search_football", args: { query: "Argentina" } },
];

const outDir = fileURLToPath(new URL("../.artifacts/output/", import.meta.url));

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  const api = createApi();
  const server = createMcpServer(api);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "smoke", version: "0.0.0" });
  await client.connect(clientTransport);

  const { tools } = await client.listTools();
  const { resources } = await client.listResources();
  const resourceUris = new Set(resources.map((r) => r.uri));

  console.log(`Tools:     ${tools.map((t) => t.name).join(", ")}`);
  console.log(`Resources: ${resources.map((r) => r.uri).join(", ")}\n`);

  if (tools.length !== 5) fail(`expected 5 tools, got ${tools.length}`);
  if (resources.length !== 5) fail(`expected 5 resources, got ${resources.length}`);

  // Every tool descriptor must point at a registered resource.
  for (const t of tools) {
    const uri = (t._meta as Record<string, unknown> | undefined)?.["openai/outputTemplate"];
    if (typeof uri !== "string") fail(`tool ${t.name} is missing openai/outputTemplate`);
    if (!resourceUris.has(uri)) fail(`tool ${t.name} -> ${uri} is not a registered resource`);
    console.log(`  ✓ ${t.name} → ${uri}`);
  }

  // Every registered resource must return skybridge HTML.
  for (const r of resources) {
    const res = await client.readResource({ uri: r.uri });
    const c = res.contents?.[0] as { text?: string; mimeType?: string } | undefined;
    if (!c?.text || !c.text.includes("<html")) fail(`resource ${r.uri} returned no HTML`);
    if (c.mimeType !== "text/html+skybridge") fail(`resource ${r.uri} wrong mimeType ${c.mimeType}`);
  }
  console.log(`  ✓ all 5 resources return text/html+skybridge HTML\n`);

  // Call each case and validate the payload.
  for (const c of CASES) {
    const result: any = await client.callTool({ name: c.tool, arguments: c.args });
    if (result.isError) fail(`${c.tool}(${JSON.stringify(c.args)}) errored: ${result.content?.[0]?.text}`);
    const sc = result.structuredContent;
    if (!sc || Object.keys(sc).length === 0) fail(`${c.tool} returned empty structuredContent`);
    const uri = result._meta?.["openai/outputTemplate"];
    if (!resourceUris.has(uri)) fail(`${c.tool} result outputTemplate ${uri} not registered`);
    const summary = result.content?.[0]?.text ?? "";
    writeFileSync(`${outDir}${c.file}.json`, JSON.stringify(sc, null, 2));
    console.log(`  ✓ ${c.tool}(${JSON.stringify(c.args)})\n      → ${summary}`);
  }

  await client.close();
  await server.close();
  console.log(`\n✅ Wiring OK — ${CASES.length} tool calls, outputs written to .artifacts/output/`);
}

main().catch((err) => fail(err?.stack ?? String(err)));
