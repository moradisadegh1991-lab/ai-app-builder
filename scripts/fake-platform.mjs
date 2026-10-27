// Minimal stand-in for the Idea2App platform, used only by the agent smoke
// test in CI: serves the agent scripts from public/agent, accepts the
// installer's registration and records status reports to a file.
//
// Usage: node scripts/fake-platform.mjs <port> <repo-url> <reports-file>
import { appendFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const [port = "8787", repo, reportsFile = "reports.jsonl"] = process.argv.slice(2);
const publicDir = path.join(import.meta.dirname, "..", "public");

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname.startsWith("/agent/")) {
    const file = path.join(publicDir, path.normalize(url.pathname).replace(/^\/+/, ""));
    if (!file.startsWith(path.join(publicDir, "agent"))) return res.writeHead(403).end();
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end(readFileSync(file));
  }
  if (req.method === "POST" && url.pathname === "/api/agent/register") {
    const body = JSON.parse(await readBody(req));
    if (body.token !== "test-token" || !body.publicKey?.startsWith("ssh-ed25519 ")) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "bad registration" }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ secret: "i2a_agent_test", repo, branch: "main", project: "Sample" }));
  }
  if (req.method === "POST" && url.pathname === "/api/agent/report") {
    if (req.headers.authorization !== "Bearer i2a_agent_test") return res.writeHead(401).end();
    appendFileSync(reportsFile, (await readBody(req)) + "\n");
    res.writeHead(200, { "content-type": "application/json" });
    return res.end('{"ok":true}');
  }
  res.writeHead(404).end();
}).listen(Number(port), "127.0.0.1", () => console.log(`fake platform on :${port}`));
