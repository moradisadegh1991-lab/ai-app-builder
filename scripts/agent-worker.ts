import { workOne } from "../src/lib/workflows/worker";

// Start with: node --env-file=.env.local --import tsx scripts/agent-worker.ts
// A real worker process is required; a web request never launches detached background work.
const shutdown = new AbortController();
process.on("SIGTERM", () => shutdown.abort());
process.on("SIGINT", () => shutdown.abort());
async function main() {
  do {
    try {
      const worked = await workOne(shutdown.signal);
      if (process.argv.includes("--once")) break;
      if (!worked) await new Promise((r) => setTimeout(r, 2000));
    } catch (error) {
      console.error("Worker error", error instanceof Error ? error.message : String(error));
      if (process.argv.includes("--once")) {
        process.exitCode = 1;
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  } while (!shutdown.signal.aborted);
}
main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
