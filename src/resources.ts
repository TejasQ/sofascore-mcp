import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Widget names — must match the Vite entries in vite.config.ts. */
export const WIDGETS = ["matches", "match", "standings", "worldcup", "search"] as const;
export type WidgetName = (typeof WIDGETS)[number];

/** Skybridge resource URI for a widget. */
export const widgetUri = (name: WidgetName) => `ui://sofascore/${name}.html`;

const distDir = fileURLToPath(new URL("../dist/widgets/", import.meta.url));

function loadWidgetHtml(name: WidgetName): string {
  try {
    return readFileSync(new URL(`${name}/index.html`, `file://${distDir}`), "utf8");
  } catch {
    return `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
      <p>Widget <b>${name}</b> not built yet. Run <code>npm run build:widgets</code>.</p>
    </body></html>`;
  }
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
