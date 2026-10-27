import { useState } from "react";
import { loadJSON, saveJSON } from "./lib/storage";

interface Task {
  id: string;
  title: string;
  done: boolean;
}

const STORAGE_KEY = "tasks";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadJSON<Task[]>(STORAGE_KEY, []));
  const [title, setTitle] = useState("");

  function update(next: Task[]) {
    setTasks(next);
    saveJSON(STORAGE_KEY, next);
  }

  function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    update([{ id: crypto.randomUUID(), title: title.trim(), done: false }, ...tasks]);
    setTitle("");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50 p-4">
      <h1 className="mb-4 text-2xl font-bold text-primary">کارهای من</h1>
      <form onSubmit={addTask} className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-slate-300 px-3 py-3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="کار جدید…"
        />
        <button className="rounded-xl bg-primary px-4 text-white">افزودن</button>
      </form>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={task.done}
              onChange={() => update(tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))}
            />
            <span className={task.done ? "text-slate-400 line-through" : ""}>{task.title}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
