# SofaScore ChatGPT App ⚽🏆

A **ChatGPT App** (OpenAI Apps SDK / MCP-UI) that answers football questions with
rich, interactive widgets — centered on the **2026 FIFA World Cup** (48 teams,
hosted by the USA, Canada & Mexico) while still handling general football.

It's an MCP server (Streamable HTTP) whose tools each render a React widget
inside ChatGPT via the `openai/outputTemplate` + `text/html+skybridge` pattern.
Data comes from SofaScore's public JSON API.

![World Cup hub](.artifacts/shots/worldcup__overview--dark.png)

## What it does

| Tool | What it answers | Widget |
| --- | --- | --- |
| `world_cup` | Anything about the World Cup — groups, knockout bracket, live/upcoming matches. Views: `overview` · `groups` · `knockout` · `matches`. | Tabbed World Cup hub with a knockout bracket |
| `list_matches` | "What football is on today?", live scores, a date's fixtures, one competition's matches. | Scoreboard grouped by tournament, live pulse |
| `get_match` | Full detail of one match: score, goal/card timeline, team stats, momentum. | Match page with momentum chart & stat bars |
| `get_standings` | A competition's league table (by name or SofaScore id). | Standings table (multi-group aware) |
| `search_football` | Find a team / player / competition / manager by name. | Result list that drills into the other tools |

Widgets are theme-aware (light/dark follow `window.openai.theme`), use SofaScore
crest/flag images with an initials fallback, and are interactive — match rows and
search results call back into other tools via `window.openai.callTool`.

## Architecture

```
src/
  server.ts            Express + StreamableHTTPServerTransport (POST /mcp, /health)
  mcp.ts               McpServer factory: server instructions + resources + tools
  resources.ts         registers each built widget as a ui:// text/html+skybridge resource
  sofascore/           API client (browser headers, TTL cache, injectable fetch),
                       endpoint helpers, raw→structuredContent mappers, World Cup logic
  shared/shapes.ts     structuredContent types shared by server + widgets
  tools/               list_matches · get_match · get_standings · world_cup · search_football
widgets/               React sources (built per-widget to one self-contained HTML)
  shared/              window.openai bridge + hooks, theme, reusable components
scripts/               build-widgets · smoke (wiring) · screenshots (visual)
test/fixtures/         demo SofaScore responses for offline runs
```

Each widget is built by `vite` + `vite-plugin-singlefile` into a single
`dist/widgets/<name>/index.html` (JS + CSS inlined), which is served verbatim as
the skybridge resource — no separate asset host needed.

## Run it

```bash
npm install
npm run dev          # builds widgets, then starts the server on :3000 (POST /mcp)
```

Point an MCP client at `http://localhost:3000/mcp`, or run with `SOFA_MOCK=1` to
serve the bundled fixtures instead of the live API:

```bash
SOFA_MOCK=1 npm run dev
```

### Add it to ChatGPT (Developer Mode)

1. Expose the server over HTTPS (e.g. `ngrok http 3000`).
2. In ChatGPT → **Settings → Connectors → Advanced → Developer mode**, add a new
   connector pointing at `https://<your-tunnel>/mcp`.
3. Ask: *"Show me the World Cup group standings"* or *"What football is live right now?"* —
   the matching widget renders inline.

## Verify

All verification runs offline (no live network needed):

```bash
npm run typecheck        # server + widgets typecheck
npm run build:widgets    # bundle the 5 self-contained widget HTML files
npm run verify           # build + wiring smoke test + Playwright screenshots
```

- **`scripts/smoke.ts`** boots the server with fixtures, connects an in-process MCP
  client, and asserts every tool's `openai/outputTemplate` resolves to a registered
  `ui://` resource with non-empty `structuredContent`.
- **`scripts/screenshots.ts`** renders each built widget with the real server output
  (Chromium, `window.openai` set exactly like the host) into `.artifacts/shots/`.

## Note on data & this environment

The live SofaScore API (`api.sofascore.com`) is used at runtime with browser-like
headers. Some sandboxed/CI networks block that host — in those cases run with
`SOFA_MOCK=1` (fixtures) or host the server on an unrestricted network; the app
resolves the current World Cup season dynamically (it is not hardcoded), so live
data flows automatically wherever the host is reachable.

Not affiliated with SofaScore; uses their public endpoints for informational use.
