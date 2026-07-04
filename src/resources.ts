import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Widget names — must match the Vite entries in vite.config.ts. */
export const WIDGETS = ["matches", "match", "standings", "worldcup", "search"] as const;
export type WidgetName = (typeof WIDGETS)[number];

/** Skybridge resource URI for a widget. */
export const widgetUri = (name: WidgetName) => `ui://sofascore/${name}.html`;

/**
 * Candidate locations for the built widget HTML. `import.meta.url` works when
 * run from source (tsx) or a normal build; `process.cwd()` covers serverless
 * bundlers (Vercel) that relocate the compiled function away from `dist/`.
 */
const DIST_CANDIDATES = [
  fileURLToPath(new URL("../dist/widgets/", import.meta.url)),
  resolve(process.cwd(), "dist/widgets"),
];

/**
 * The public origin this server is reachable at (e.g. https://sofa.example.com).
 * Injected into each widget so its images load from our own image proxy instead
 * of api.sofascore.com (blocked by the ChatGPT Apps-sandbox CSP). On Vercel it
 * defaults to the deployment URL; unset elsewhere → widgets load images directly
 * (fine for the local MCP Inspector).
 */
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
).replace(/\/$/, "");

function readWidgetFile(name: WidgetName): string | undefined {
  for (const dir of DIST_CANDIDATES) {
    try {
      return readFileSync(resolve(dir, name, "index.html"), "utf8");
    } catch {
      /* try next candidate */
    }
  }
  return undefined;
}

function loadWidgetHtml(name: WidgetName): string {
  const html = readWidgetFile(name);
  if (html) {
    const inject = `<script>window.__SOFA_BASE__=${JSON.stringify(PUBLIC_BASE_URL)}</script>`;
    return html.replace(/<head[^>]*>/i, (m) => `${m}${inject}`);
  }
  return `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
      <p>Widget <b>${name}</b> not built yet. Run <code>npm run build:widgets</code>.</p>
    </body></html>`;
}

/**
 * Register each widget's built HTML as a `text/html+skybridge` resource. The
 * ChatGPT host loads this HTML into the iframe when a tool's
 * `openai/outputTemplate` points at the matching `ui://` URI.
 */
export function registerResources(server: McpServer): void {
  for (const name of WIDGETS) {
    const uri = widgetUri(name);
    server.registerResource(
      name,
      uri,
      {
        title: `SofaScore ${name} widget`,
        mimeType: "text/html+skybridge",
        _meta: {
          "openai/widgetPrefersBorder": true,
        },
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: "text/html+skybridge",
            text: loadWidgetHtml(name),
          },
        ],
      }),
    );
  }
}
