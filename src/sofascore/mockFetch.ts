import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Fixture-backed `fetch` used when SOFA_MOCK=1 (and by the smoke test). Lets the
 * whole server run end-to-end with zero network — essential in sandboxes where
 * api.sofascore.com is unreachable. Matches request URLs to files in
 * test/fixtures by the most specific pattern first.
 */

const fixturesDir = fileURLToPath(new URL("../../test/fixtures/", import.meta.url));

// Ordered most-specific first.
const ROUTES: Array<[RegExp, string]> = [
  [/\/event\/\d+\/incidents/, "incidents.json"],
  [/\/event\/\d+\/statistics/, "statistics.json"],
  [/\/event\/\d+\/graph/, "graph.json"],
  [/\/event\/\d+(\?|$)/, "event.json"],
  [/\/sport\/football\/events\/live/, "live.json"],
  [/\/sport\/football\/scheduled-events\//, "scheduled.json"],
  [/\/unique-tournament\/\d+\/seasons/, "wc_seasons.json"],
  [/\/standings\/total/, "standings.json"],
  [/\/events\/next\/0/, "wc_next.json"],
  [/\/events\/last\/0/, "wc_last.json"],
  [/\/search\/all/, "search.json"],
];

function loadFixture(file: string): unknown {
  return JSON.parse(readFileSync(new URL(file, `file://${fixturesDir}`), "utf8"));
}

export function createMockFetch(): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const route = ROUTES.find(([re]) => re.test(url));
    if (!route) {
      return new Response(JSON.stringify({ error: "no fixture", url }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    const body = JSON.stringify(loadFixture(route[1]));
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}
