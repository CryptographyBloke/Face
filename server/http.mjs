import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
};

export function createNodeHandler(
  api,
  { root = resolve("web/dist"), port = 8787 } = {},
) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost:" + port);
      if (url.pathname.startsWith("/v1/") || url.pathname === "/health") {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(
              '{"error":{"code":"BODY_SIZE","message":"Request too large"}}',
            );
            return;
          }
          chunks.push(chunk);
        }
        const response = await api(
          new Request(url, {
            method: req.method,
            headers: req.headers,
            ...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
          }),
          req.socket.remoteAddress || "local",
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      const path = resolve(root, "." + pathname);
      if (!path.startsWith(root + "/") && path !== root) {
        res.writeHead(400);
        res.end();
        return;
      }
      let data,
        actual = path;
      try {
        data = await readFile(path);
      } catch {
        if (extname(pathname) && !/^\/(u|profile|spaces)\//.test(pathname)) {
          res.writeHead(404);
          res.end();
          return;
        }
        actual = root + "/index.html";
        data = await readFile(actual);
      }
      res.writeHead(200, {
        "Content-Type": mime[extname(actual)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      res.end(req.method === "HEAD" ? null : data);
    } catch {
      res.writeHead(500);
      res.end("Server unavailable");
    }
  };
}
