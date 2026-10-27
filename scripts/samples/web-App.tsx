import { useEffect, useState } from "react";
import { apiFetch } from "./lib/api";

interface Message {
  id: number;
  name: string;
  body: string;
  created_at: string;
}

// Sample website used by the smoke test: a landing section plus a guestbook
// that reads and writes through the backend (/api/messages).
export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Message[]>("/api/messages")
      .then(setMessages)
      .catch(() => setError("ارتباط با سرور برقرار نشد."));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const created = await apiFetch<Message>("/api/messages", {
      method: "POST",
      body: JSON.stringify({ name, body }),
    });
    setMessages([created, ...messages]);
    setBody("");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-primary px-6 py-16 text-center text-white">
        <h1 className="text-4xl font-bold">دفتر یادبود</h1>
        <p className="mt-2 opacity-90">پیام خود را بنویسید.</p>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow">
          <input className="w-full rounded-lg border p-3" placeholder="نام" value={name} onChange={(e) => setName(e.target.value)} required />
          <textarea className="w-full rounded-lg border p-3" placeholder="پیام" value={body} onChange={(e) => setBody(e.target.value)} required />
          <button className="rounded-lg bg-primary px-4 py-2 text-white">ارسال</button>
        </form>
        {error && <p className="text-red-600">{error}</p>}
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl bg-white p-4 shadow-sm">
              <b>{m.name}</b>
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
