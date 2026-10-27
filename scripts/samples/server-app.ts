import { createApi } from "./base";
import { sql } from "./db";

// Sample backend used by the smoke test.
export const app = createApi();

app.get("/messages", async (c) => {
  const rows = await sql`SELECT id, name, body, created_at FROM messages ORDER BY id DESC LIMIT 100`;
  return c.json(rows);
});

app.post("/messages", async (c) => {
  const input = await c.req.json<{ name?: string; body?: string }>();
  const name = input.name?.trim();
  const body = input.body?.trim();
  if (!name || !body) return c.json({ error: "name and body are required" }, 400);
  const [row] = await sql`INSERT INTO messages (name, body) VALUES (${name}, ${body}) RETURNING id, name, body, created_at`;
  return c.json(row, 201);
});
