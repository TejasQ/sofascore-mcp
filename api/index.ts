/**
 * Vercel serverless entry. The whole Express app (POST /mcp, /health, the image
 * proxy) is a standard Node request listener, so Vercel can invoke it directly.
 * `vercel.json` rewrites every path here. Runs stateless — a fresh MCP server +
 * transport per request — which is exactly what serverless wants.
 */
import { app } from "../src/server.js";

export default app;
