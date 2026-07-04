# SofaScore ChatGPT App ⚽🏆

A **ChatGPT App** (OpenAI Apps SDK / MCP-UI) that answers football questions with
rich, interactive widgets — centered on the **2026 FIFA World Cup** (48 teams,
hosted by the USA, Canada & Mexico) while still handling general football.

It's an MCP server (Streamable HTTP) whose tools each render a React widget
inside ChatGPT via the `openai/outputTemplate` + `text/html+skybridge` pattern.
Data comes from SofaScore's public JSON API.

![World Cup hub](docs/worldcup-hub.png)

<p>
  <img src="docs/match-detail.png" width="32%" alt="Match detail" />
  <img src="docs/knockout-bracket.png" width="32%" alt="Knockout bracket" />
  <img src="docs/standings-light.png" width="32%" alt="Standings (light theme)" />
</p>

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
  sofascore/           data layer: SofaScore client (browser headers, TTL cache,
                       optional proxy, server-side image fetch) + ESPN fallback
                       source, both behind one FootballApi interface (provider.ts,
                       fallback.ts, espn.ts); raw→structuredContent mappers, WC logic
api/index.ts           Vercel serverless entry (re-exports the Express app)
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

### Images (why they route through this server)

Team/tournament/player crests can't be loaded straight from `api.sofascore.com`
inside the ChatGPT Apps sandbox: the iframe's CSP (`img-src`) blocks the host,
and SofaScore itself 403s the referer-less cross-origin request. So the server
exposes an **image proxy** and the widgets point at it instead:

```
GET /img/team/:id          → https://api.sofascore.com/api/v1/team/:id/image
GET /img/tournament/:id     → …/unique-tournament/:id/image
GET /img/player/:id         → …/player/:id/image
GET /img/flag/:alpha2       → …/img/flags/:alpha2.png
```

Only these allow-listed shapes are proxied. `resources.ts` injects
`window.__SOFA_BASE__` (from `PUBLIC_BASE_URL`) into each widget's `<head>`, and
`widgets/shared/img.ts` builds `${__SOFA_BASE__}/img/...` URLs from it. If
`PUBLIC_BASE_URL` is unset (e.g. local MCP Inspector) the widgets fall back to
loading images directly from SofaScore.

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

### Environment variables

| Variable          | Purpose                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `PORT`            | HTTP port (default `3000`).                                                                                |
| `SOFA_MOCK`       | `1` serves the bundled fixtures instead of the live API — no network needed.                              |
| `PUBLIC_BASE_URL` | Public origin this server is reachable at (e.g. `https://sofa.example.com`). Needed for the image proxy so crests load inside the ChatGPT sandbox. On Vercel it defaults to the deployment URL. Unset elsewhere → widgets load images directly. |
| `SOFA_PROXY`      | Outbound HTTP(S) forward proxy for **all** SofaScore fetches (data + images). Point at a residential / unblocked proxy to defeat the Varnish/IP block. Falls back to `HTTPS_PROXY`. |
| `ESPN_ONLY`       | `1` skips SofaScore entirely and serves everything from the ESPN fallback. Handy on hosts where SofaScore is always blocked (avoids the per-request probe + cooldown). |

```bash
# Live, behind a proxy, with images proxied through this origin:
PUBLIC_BASE_URL=https://sofa.example.com \
SOFA_PROXY=http://user:pass@proxy-host:port \
npm run dev
```

### Add it to ChatGPT (Developer Mode)

1. Expose the server over HTTPS (e.g. `ngrok http 3000`).
2. In ChatGPT → **Settings → Connectors → Advanced → Developer mode**, add a new
   connector pointing at `https://<your-tunnel>/mcp`.
3. Ask: *"Show me the World Cup group standings"* or *"What football is live right now?"* —
   the matching widget renders inline.

### Deploy to Vercel

The repo is Vercel-ready: `api/index.ts` re-exports the Express app as a single
serverless function and `vercel.json` rewrites every path to it.

```bash
vercel deploy        # first run links the project; prod: `vercel --prod`
```

- **Build** — `vercel.json`'s `buildCommand` runs `npm run build`, bundling the
  five widget HTML files into `dist/widgets/`; `includeFiles` ships them with the
  function (the resource loader also resolves them from `process.cwd()`).
- **Base URL** — `PUBLIC_BASE_URL` defaults to the deployment's `VERCEL_URL`, so
  the image proxy works with no extra config. Set it explicitly for a custom
  domain.
- **Data** — ESPN fallback means live data works immediately. To keep SofaScore
  primary, add `SOFA_PROXY` in the Vercel project's Environment Variables; to
  drop it, set `ESPN_ONLY=1`.
- **Connector URL** — point ChatGPT at `https://<deployment>/mcp`.

The function's `maxDuration` is 30s to cover ESPN's multi-league fan-out; the
landing page at `/` is served statically from `public/`.

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

The primary source is the live SofaScore API (`api.sofascore.com`), used with
browser-like headers. Its edge (Varnish) returns **403 to datacenter IPs and
flagged TLS fingerprints regardless of headers** — so a cloud host, CI runner,
or this sandbox often can't reach it. This is an egress-IP block, not a missing
header.

**So the server falls back to ESPN's public soccer API automatically.** Every
data source sits behind one `FootballApi` interface; `FallbackApi` tries
SofaScore first (honouring `SOFA_PROXY`) and, on any 403 / timeout / empty
result, transparently serves the same request from ESPN — mapped into the exact
same shapes, so tools and widgets never know the difference. ESPN is reachable
from blocked networks, covers the **FIFA World Cup + the top-5 European leagues**,
and needs no API key. Result: **live data flows out of the box**, no proxy
required. Team crests come from `a.espncdn.com` via the same image proxy.

Ways to control the source:

1. **Default** — SofaScore → ESPN fallback. Just works anywhere.
2. **`ESPN_ONLY=1`** — skip SofaScore entirely (best on always-blocked hosts).
3. **`SOFA_PROXY=<url>`** — give SofaScore a residential / unblocked egress so it
   stays primary (see below).
4. **`SOFA_MOCK=1`** — bundled fixtures, fully offline (dev / tests / demos).

The World Cup season resolves dynamically (not hardcoded).

### Getting a proxy endpoint

`SOFA_PROXY` takes a standard `http(s)://[user:pass@]host:port` URL. What you
need is an IP SofaScore hasn't blocked — in practice a **residential** or
**mobile** proxy (datacenter proxies are usually blocked too). Options:

- **Managed residential proxy providers** — Bright Data, Oxylabs, Smartproxy,
  IPRoyal, Soax, etc. Sign up, create an endpoint, and they give you a
  `http://user:pass@gateway:port` URL. Paste it into `SOFA_PROXY`. Cheapest to
  start; billed per GB (crest images are tiny, JSON is tiny — usage is low).
- **Your own home/residential IP** — run the server on a machine at home, or
  tunnel through one (e.g. a small box on a home connection running
  [`ngrok`](https://ngrok.com) / [`tailscale`](https://tailscale.com) + a
  forward proxy like [`tinyproxy`](https://tinyproxy.github.io/) or
  [`squid`](http://www.squid-cache.org/)). Free if you already have the hardware.
- **A cheap VPS on a residential-friendly ASP** — some VPS/edge providers hand
  out IP ranges SofaScore doesn't block; try a `curl` from the box first (below).

**Test any candidate before wiring it in:**

```bash
curl -x "http://user:pass@proxy-host:port" \
  -H "User-Agent: Mozilla/5.0" -H "Referer: https://www.sofascore.com/" \
  -o /dev/null -w "%{http_code}\n" \
  https://api.sofascore.com/api/v1/sport/football/events/live
```

`200` → set that URL as `SOFA_PROXY`. `403` → that IP is blocked too; try another.

Not affiliated with SofaScore; uses their public endpoints for informational use.
