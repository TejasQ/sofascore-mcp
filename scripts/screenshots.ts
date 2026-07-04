/// <reference lib="dom" />
/**
 * Render each built widget with the real server output (from smoke.ts) and
 * screenshot it. Uses the preinstalled Chromium. SofaScore image requests are
 * aborted so the crest initials-fallback renders (mirrors a no-network sandbox;
 * in ChatGPT the real crests load).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputDir = `${root}.artifacts/output/`;
const shotsDir = `${root}.artifacts/shots/`;
const distDir = `${root}dist/widgets/`;

// Files that also get a light-theme render to prove theme-awareness.
const LIGHT_TOO = new Set(["worldcup__overview", "standings__worldcup", "match__final"]);

const THEME_BG: Record<string, string> = { dark: "#0b1220", light: "#eef1f5" };

async function launch(): Promise<Browser> {
  const candidates = [
    undefined,
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ];
  let lastErr: unknown;
  for (const executablePath of candidates) {
    try {
      return await chromium.launch({ headless: true, executablePath });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function main() {
  if (!existsSync(outputDir)) {
    console.error("No .artifacts/output — run `tsx scripts/smoke.ts` first.");
    process.exit(1);
  }
  mkdirSync(shotsDir, { recursive: true });

  const files = readdirSync(outputDir).filter((f) => f.endsWith(".json"));
  const browser = await launch();

  for (const file of files) {
    const key = file.replace(/\.json$/, "");
    const widget = key.split("__")[0];
    const htmlPath = `${distDir}${widget}/index.html`;
    if (!existsSync(htmlPath)) {
      console.warn(`  ! no built widget for ${widget}, skipping ${key}`);
      continue;
    }
    const html = readFileSync(htmlPath, "utf8");
    const data = JSON.parse(readFileSync(`${outputDir}${file}`, "utf8"));

    const themes = LIGHT_TOO.has(key) ? ["dark", "light"] : ["dark"];
    for (const theme of themes) {
      const page = await browser.newPage({
        viewport: { width: 480, height: 720 },
        deviceScaleFactor: 2,
      });
      // Block image loads so the initials fallback renders instantly.
      await page.route("**/api.sofascore.com/**", (r) => r.abort());
      await page.setContent(html, { waitUntil: "load" });
      await page.addStyleTag({ content: `html,body{background:${THEME_BG[theme]}}` });
      // Deliver globals exactly like the ChatGPT host does: set window.openai
      // then fire the update event the widget hooks subscribe to.
      await page.evaluate(
        ({ d, t }) => {
          (window as any).openai = { toolOutput: d, theme: t, displayMode: "inline", locale: "en-US" };
          window.dispatchEvent(new Event("openai:set_globals"));
        },
        { d: data, t: theme },
      );
      await page.waitForTimeout(350);

      const name = themes.length > 1 ? `${key}--${theme}` : key;
      await page.screenshot({ path: `${shotsDir}${name}.png`, fullPage: true });
      console.log(`  📸 ${name}.png`);
      await page.close();
    }
  }

  await browser.close();
  console.log(`\n✅ Screenshots written to .artifacts/shots/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
