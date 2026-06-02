import { createServer } from "node:http";
import { JsonStore } from "@openalpha/memory-engine";
import { readState } from "./state.ts";

const PORT = Number(process.env.PORT || 4318);

/**
 * Minimal zero-dependency JSON API. Routes:
 *   GET /health
 *   GET /api/state         full projected state view
 *   GET /api/performance   the scorecard only
 *   GET /api/positions     open + recent closed
 *   GET /api/events?limit  recent agent log
 */
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");

  try {
    if (url.pathname === "/health") return send(res, 200, { ok: true });

    if (url.pathname === "/api/state") return send(res, 200, readState());

    if (url.pathname === "/api/performance") return send(res, 200, readState().performance);

    if (url.pathname === "/api/positions") {
      const v = readState();
      return send(res, 200, { open: v.open, closedRecent: v.closedRecent });
    }

    if (url.pathname === "/api/events") {
      const limit = Number(url.searchParams.get("limit") || 50);
      const dir = readState().dataDir ?? "./data";
      const store = new JsonStore(dir, 10);
      return send(res, 200, store.snapshot().events.slice(-limit).reverse());
    }

    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

function send(res: import("node:http").ServerResponse, code: number, body: unknown): void {
  res.statusCode = code;
  res.end(JSON.stringify(body, null, 2));
}

server.listen(PORT, () => {
  console.log(`◎ Open Alpha API on http://localhost:${PORT}  (data: ${readState().dataDir ?? "none"})`);
});
