import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a route handler so thrown errors become consistent JSON responses. */
export async function handleRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "ورودی نامعتبر است.", issues: error.issues }, { status: 400 });
    }
    console.error(error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Parses a JSON body; an empty body is treated as `{}`. */
export async function readJson<T>(request: Request, parse: (value: unknown) => T): Promise<T> {
  const text = await request.text();
  let body: unknown = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new HttpError(400, "بدنه درخواست باید JSON معتبر باشد.");
    }
  }
  return parse(body);
}
