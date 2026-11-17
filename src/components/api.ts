import { friendlyError } from "./friendly-error";

// Avoid exposing raw service responses to the end user.
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
  } catch (error) {
    throw new Error(friendlyError(error));
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(friendlyError(data.error ?? String(response.status)));
  return data as T;
}

export interface ProviderInfo {
  id: "openai" | "anthropic" | "gemini";
  label: string;
  model: string;
  available: boolean;
  source: "user" | "platform" | null;
  price?: { inputPerMillion: number; outputPerMillion: number; currency: "USD" | "IRT"; updatedAt: string; source: "liara-catalog" | "administrator" | "environment-estimate" } | null;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
}
