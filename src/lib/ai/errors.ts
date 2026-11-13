import type { CompletionResult } from "./types";

/** Inference was billed, but the response must never be parsed as complete JSON. */
export class CompletionTruncatedError extends Error {
  constructor(public readonly completion: CompletionResult) {
    super("پاسخ مدل به سقف خروجی رسید و کامل نشد؛ ارزیابی نهایی هنوز انجام نشده است.");
    this.name = "CompletionTruncatedError";
  }
}
