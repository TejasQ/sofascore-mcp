/**
 * Build each widget separately into dist/widgets/<name>/index.html as a single
 * self-contained HTML file. Per-widget passes are required because
 * vite-plugin-singlefile inlines a single entry at a time.
 */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const WIDGETS = ["matches", "match", "standings", "worldcup", "search"] as const;

for (let i = 0; i < WIDGETS.length; i++) {
  const w = WIDGETS[i];
  await build({
    configFile: false,
    root: resolve(root, "widgets"),
    plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
    logLevel: "warn",
    build: {
      outDir: resolve(root, "dist/widgets"),
      emptyOutDir: i === 0,
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      rollupOptions: { input: resolve(root, `widgets/${w}/index.html`) },
    },
  });
  console.log(`  ✓ built widget: ${w}`);
}
console.log("✅ widgets built → dist/widgets/<name>/index.html");
