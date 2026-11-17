/** Heuristic planning range, not a tokenizer, provider quote, or guaranteed maximum. */
export function estimateTokens({ kind, textLength, screens, needsBackend, attachments }: {
  kind: "spec" | "code"; textLength: number; screens: number; needsBackend: boolean; attachments: number;
}) {
  const length = Number.isFinite(textLength) ? Math.max(0, Math.floor(textLength)) : 0;
  const pages = Number.isFinite(screens) ? Math.min(8, Math.max(1, Math.floor(screens))) : 1;
  const files = Number.isFinite(attachments) ? Math.min(20, Math.max(0, Math.floor(attachments))) : 0;
  const attachmentAllowance = files * 4096;
  if (kind === "spec") return { input: [2000, 8000 + length + attachmentAllowance], output: [1000, 8000] } as const;
  const backend = needsBackend ? 1 : 0;
  return {
    input: [15000 + pages * 2000 + backend * 6000, 60000 + pages * 6000 + length + attachmentAllowance + backend * 30000],
    output: [10000 + pages * 1000 + backend * 4000, 55000 + pages * 3000 + backend * 20000],
  } as const;
}
