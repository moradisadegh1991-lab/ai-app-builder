import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.env.SANDBOX_DIST ?? "/work/dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://app");
      if (url.pathname.startsWith("/api/")) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const upstream = await fetch(`http://127.0.0.1:3000${url.pathname}${url.search}`, {
          method: request.method,
          headers: {
            "content-type": request.headers["content-type"] ?? "application/json",
          },
          body: ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.concat(chunks),
          signal: AbortSignal.timeout(10000),
        });
        response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
        response.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      let target = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (!target.startsWith(root + "/") && target !== root) {
        response.writeHead(403).end();
        return;
      }
      if (!(await stat(target).catch(() => null))?.isFile()) target = `${root}/index.html`;
      response.setHeader("content-type", types[path.extname(target)] ?? "application/octet-stream");
      response.end(await readFile(target));
    } catch {
      response.writeHead(502).end("Sandbox server error");
    }
  })
  .listen(4173, "0.0.0.0");
