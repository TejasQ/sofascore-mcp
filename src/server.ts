import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createApi } from "./sofascore/index.js";
import { createMcpServer } from "./mcp.js";

const PORT = Number(process.env.PORT ?? 3000);
const api = createApi();

const app = express();
app.use(express.json({ limit: "1mb" }));

// Permissive CORS so the ChatGPT host / MCP Inspector can reach the endpoint.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sofascore-mcp", mock: process.env.SOFA_MOCK === "1" });
});

// Image proxy: the ChatGPT iframe can't load api.sofascore.com images directly
// (Apps-sandbox CSP + SofaScore referer/403 checks), so widgets point crests at
// typed routes on our own origin and we fetch them server-side. Only these known
// shapes are proxied — no arbitrary upstream paths.
const upstreamImage = (kind: string, id: string): string | undefined => {
  if (kind === "team" && /^\d+$/.test(id)) return `/team/${id}/image`;
  if (kind === "tournament" && /^\d+$/.test(id)) return `/unique-tournament/${id}/image`;
  if (kind === "player" && /^\d+$/.test(id)) return `/player/${id}/image`;
  if (kind === "flag" && /^[a-z]{2}$/i.test(id))
    return `https://api.sofascore.com/api/img/flags/${id.toLowerCase()}.png`;
  return undefined;
};
app.get("/img/:kind/:id", async (req: Request, res: Response) => {
  const path = upstreamImage(req.params.kind, req.params.id);
  if (!path) return res.status(400).send("bad image path");
  try {
    const { body, contentType } = await api.image(path);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.send(Buffer.from(body));
  } catch {
    res.status(502).send("image unavailable");
  }
});

// Stateless Streamable HTTP: a fresh server + transport per request.
app.post("/mcp", async (req: Request, res: Response) => {
  const server = createMcpServer(api);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// This stateless server does not support server-initiated streams / sessions.
const methodNotAllowed = (_req: Request, res: Response) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST /mcp." },
    id: null,
  });
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

// Only auto-listen when run directly (the smoke test imports pieces instead).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  app.listen(PORT, () => {
    console.log(`SofaScore MCP server listening on http://localhost:${PORT}/mcp`);
    if (process.env.SOFA_MOCK === "1") console.log("(SOFA_MOCK=1 — serving fixtures)");
  });
}

export { app };
