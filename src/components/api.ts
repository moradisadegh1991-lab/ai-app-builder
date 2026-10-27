// Tiny client-side fetch helper that surfaces the API's Persian error messages.
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `خطای ${response.status}`);
  return data as T;
}

export interface ProviderInfo {
  id: "openai" | "anthropic" | "gemini";
  label: string;
  model: string;
  available: boolean;
  source: "user" | "platform" | null;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  quota: { usedToday: number; dailyLimit: number };
}
