"use client";

import { useState } from "react";
import { Icon } from "./ui/Icon";

const TASKS = ["طراحی صفحهٔ اصلی", "مرتب‌کردن ایده‌ها", "شروع یک پروژهٔ تازه"];

/** An interactive, explicitly labelled product illustration; no simulated live service state. */
export function ProductPreview() {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [done, setDone] = useState([true, false, false]);
  return (
    <div className="product-showcase">
      <div className="showcase-caption">
        <span className="eyebrow">یک ایده، یک فضای ساخت</span>
        <span>
          نمونهٔ نمایشی پلتفرم <Icon name="arrow-left" size={14} />
        </span>
      </div>
      <div className="studio-preview">
        <div className="studio-toolbar">
          <div className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span className="studio-project-name">
            <Icon name="folder" size={15} /> پروژهٔ مدیریت روزانه
          </span>
          <span className="studio-demo-label">نمایش نمونه</span>
        </div>
        <div className="studio-body">
          <aside className="studio-agent-list" aria-label="نقش‌های تیم در نمونه">
            <div className="studio-team-title">
              <span className="studio-ai-mark">
                <Icon name="sparkles" size={17} />
              </span>
              <div>
                <strong>تیم ایده‌ات</strong>
                <small>هر تخصص، یک ایجنت</small>
              </div>
            </div>
            {[
              { label: "معمار محصول", text: "نقشهٔ راه و نیازمندی‌ها", icon: "layers" as const },
              { label: "طراح UI/UX", text: "ظاهر و تجربهٔ کاربر", icon: "pencil" as const },
              { label: "توسعه‌دهنده", text: "کد فرانت‌اند و بک‌اند", icon: "code" as const },
              { label: "ارزیاب و خطایاب", text: "بررسی کیفیت و اصلاح", icon: "shield" as const },
            ].map((agent, i) => (
              <div key={agent.label} className={`studio-agent ${i === 2 ? "is-selected" : ""}`}>
                <span className="studio-agent-icon">
                  <Icon name={agent.icon} size={17} />
                </span>
                <div>
                  <strong>{agent.label}</strong>
                  <small>{agent.text}</small>
                </div>
                <span className="studio-agent-node" />
              </div>
            ))}
            <div className="studio-note">
              <Icon name="git-branch" size={15} />
              <span>
                از ایده تا کد،
                <br />
                در یک مسیر روشن.
              </span>
            </div>
          </aside>
          <div className="studio-canvas">
            <div className="canvas-toolbar">
              <div className="preview-switch" role="group" aria-label="نمای نمونه">
                <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}>
                  <Icon name="eye" size={14} />
                  پیش‌نمایش
                </button>
                <button type="button" aria-pressed={view === "code"} onClick={() => setView("code")}>
                  <Icon name="code" size={14} />
                  کد
                </button>
              </div>
              <Icon name="monitor" size={15} className="text-muted" />
            </div>
            {view === "preview" ? (
              <div className="demo-app">
                <div className="demo-app-top">
                  <span className="demo-app-brand">
                    <span /> روزنو
                  </span>
                  <span className="demo-avatar">ر</span>
                </div>
                <span className="demo-greeting">یک روز تازه، یک فرصت تازه</span>
                <h3>
                  قدم‌های کوچک،
                  <br />
                  اتفاق‌های بزرگ.
                </h3>
                <p>برای چیزهایی که مهم‌اند، جا باز کن.</p>
                <div className="demo-progress">
                  <div>
                    <span>برنامهٔ امروز</span>
                    <strong>{done.filter(Boolean).length.toLocaleString("fa-IR")} از ۳ انجام شده</strong>
                  </div>
                  <span className="demo-progress-track">
                    <i style={{ width: `${(done.filter(Boolean).length / TASKS.length) * 100}%` }} />
                  </span>
                </div>
                <div className="demo-tasks">
                  {TASKS.map((task, i) => (
                    <button
                      type="button"
                      key={task}
                      aria-pressed={done[i]}
                      onClick={() =>
                        setDone((current) => current.map((value, index) => (index === i ? !value : value)))
                      }
                    >
                      <span className={done[i] ? "demo-check is-done" : "demo-check"}>
                        {done[i] && <Icon name="check" size={11} />}
                      </span>
                      <span className={done[i] ? "demo-task-done" : ""}>{task}</span>
                      <Icon name="chevron-left" size={12} />
                    </button>
                  ))}
                </div>
                <span className="demo-app-foot">
                  ساخته‌شده از یک ایدهٔ ساده <Icon name="sparkles" size={12} />
                </span>
              </div>
            ) : (
              <div className="demo-code" dir="ltr">
                <span className="demo-file">
                  <Icon name="file" size={14} /> src/App.tsx
                </span>
                <pre>
                  <code>
                    <span className="syntax-purple">export default function</span>
                    {" App() {\n  "}
                    <span className="syntax-purple">const</span>
                    {" [tasks, setTasks] = "}
                    <span className="syntax-blue">useState</span>
                    {"([]);\n\n  "}
                    <span className="syntax-purple">return</span>
                    {" (\n    <"}
                    <span className="syntax-green">main</span>
                    {" className="}
                    <span className="syntax-amber">"your-next-idea"</span>
                    {">\n      <"}
                    <span className="syntax-green">h1</span>
                    {">قدم‌های کوچک، اتفاق‌های بزرگ.</h1>\n      {tasks."}
                    <span className="syntax-blue">map</span>
                    {"(task => (\n        <Task key={task.id} {...task} />\n      ))}\n    </main>\n  );\n}"}
                  </code>
                </pre>
                <div className="demo-code-note">
                  <Icon name="git-branch" size={14} />
                  Your idea. Your code.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="showcase-footer">
        <span>
          <Icon name="smartphone" size={14} />
          مناسب موبایل و دسکتاپ
        </span>
        <span>
          <Icon name="code" size={14} />
          کد قابل‌ویرایش
        </span>
        <span>
          <Icon name="globe" size={14} />
          آماده برای قدم بعدی
        </span>
      </div>
    </div>
  );
}
