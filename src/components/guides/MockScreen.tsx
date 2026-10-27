// Draws a simplified, schematic picture of a screen (browser, phone or
// terminal) with the element to use highlighted and numbered, so each guide
// step shows *where* to click without relying on third-party screenshots.

export type MockElement =
  | { t: "heading"; label: string }
  | { t: "text"; label: string; muted?: boolean }
  | { t: "button"; label: string; hl?: number; variant?: "primary" | "secondary" | "danger" }
  | { t: "input"; label: string; value?: string; hl?: number; mono?: boolean }
  | { t: "select"; label: string; value: string; hl?: number }
  | { t: "toggle"; label: string; on?: boolean; hl?: number }
  | { t: "check"; label: string; on?: boolean; hl?: number }
  | { t: "code"; label?: string; value: string; hl?: number }
  | { t: "tabs"; items: string[]; active: number; hl?: number }
  | { t: "card"; title: string; text?: string; badge?: string; hl?: number }
  | { t: "row"; items: MockElement[] };

export type Mock =
  | { kind: "browser"; url: string; sidebar?: string[]; activeSide?: number; body: MockElement[] }
  | { kind: "phone"; title: string; body: MockElement[] }
  | { kind: "terminal"; title?: string; lines: { text: string; style?: "cmd" | "out" | "ok" | "warn" | "hl" }[] };

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -top-2.5 -left-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow ring-2 ring-white">
      {n.toLocaleString("fa-IR")}
    </span>
  );
}

function Highlight({ n, children, className = "" }: { n?: number; children: React.ReactNode; className?: string }) {
  if (!n) return <div className={className}>{children}</div>;
  return (
    <div className={`relative ${className}`}>
      <Badge n={n} />
      {/* Only the ring pulses, so the highlighted element stays fully readable. */}
      <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-lg ring-2 ring-rose-500 motion-safe:animate-pulse" />
      {children}
    </div>
  );
}

function Element({ el }: { el: MockElement }) {
  switch (el.t) {
    case "heading":
      return <div className="text-sm font-bold">{el.label}</div>;
    case "text":
      return <div className={`text-xs ${el.muted ? "text-slate-400" : "text-slate-600 dark:text-slate-300"}`}>{el.label}</div>;
    case "button": {
      const styles = {
        primary: "bg-sky-600 text-white",
        secondary: "border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
        danger: "bg-rose-600 text-white",
      }[el.variant ?? "primary"];
      return (
        <Highlight n={el.hl} className="inline-block">
          <div className={`rounded-md px-3 py-1.5 text-xs font-medium ${styles}`}>{el.label}</div>
        </Highlight>
      );
    }
    case "input":
      return (
        <Highlight n={el.hl}>
          <div className="text-[11px] text-slate-500">{el.label}</div>
          <div
            dir={el.mono ? "ltr" : undefined}
            className={`mt-0.5 truncate rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 ${el.mono ? "font-mono" : ""}`}
          >
            {el.value ?? " "}
          </div>
        </Highlight>
      );
    case "select":
      return (
        <Highlight n={el.hl}>
          <div className="text-[11px] text-slate-500">{el.label}</div>
          <div className="mt-0.5 flex items-center justify-between rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800">
            <span dir="auto">{el.value}</span>
            <span className="text-slate-400">▾</span>
          </div>
        </Highlight>
      );
    case "toggle":
      return (
        <Highlight n={el.hl}>
          <div className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-xs">
            <span>{el.label}</span>
            <span className={`flex h-4 w-7 items-center rounded-full px-0.5 ${el.on ? "justify-end bg-emerald-500" : "bg-slate-300"}`}>
              <span className="size-3 rounded-full bg-white" />
            </span>
          </div>
        </Highlight>
      );
    case "check":
      return (
        <Highlight n={el.hl} className="inline-block">
          <div className="flex items-center gap-2 px-1 py-0.5 text-xs">
            <span
              className={`flex size-3.5 items-center justify-center rounded-sm border ${el.on ? "border-sky-600 bg-sky-600 text-[9px] text-white" : "border-slate-400"}`}
            >
              {el.on ? "✓" : ""}
            </span>
            <span dir="auto">{el.label}</span>
          </div>
        </Highlight>
      );
    case "code":
      return (
        <Highlight n={el.hl}>
          {el.label && <div className="text-[11px] text-slate-500">{el.label}</div>}
          <pre
            dir="ltr"
            className="mt-0.5 overflow-hidden rounded-md bg-slate-900 p-2 text-left font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-emerald-300"
          >
            {el.value}
          </pre>
        </Highlight>
      );
    case "tabs":
      return (
        <Highlight n={el.hl}>
          <div className="flex gap-1 border-b border-slate-200 text-[11px] dark:border-slate-700">
            {el.items.map((item, i) => (
              <span
                key={item}
                className={`px-2 py-1 ${i === el.active ? "border-b-2 border-sky-600 font-medium text-sky-700 dark:text-sky-300" : "text-slate-500"}`}
              >
                {item}
              </span>
            ))}
          </div>
        </Highlight>
      );
    case "card":
      return (
        <Highlight n={el.hl}>
          <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between gap-2 text-xs font-medium">
              <span dir="auto">{el.title}</span>
              {el.badge && (
                <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {el.badge}
                </span>
              )}
            </div>
            {el.text && (
              <div className="mt-0.5 text-[11px] text-slate-500" dir="auto">
                {el.text}
              </div>
            )}
          </div>
        </Highlight>
      );
    case "row":
      return (
        <div className="flex flex-wrap items-end gap-2">
          {el.items.map((item, i) => (
            <div key={i} className="min-w-0 flex-1">
              <Element el={item} />
            </div>
          ))}
        </div>
      );
  }
}

const TERMINAL_COLORS = {
  cmd: "text-white",
  out: "text-slate-400",
  ok: "text-emerald-400",
  warn: "text-amber-400",
  hl: "rounded bg-rose-600/40 px-1 text-white",
};

export function MockScreen({ mock }: { mock: Mock }) {
  if (mock.kind === "terminal") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-lg" dir="ltr">
        <div className="flex items-center gap-1.5 border-b border-slate-800 px-3 py-2">
          <span className="size-2.5 rounded-full bg-rose-500" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <span className="ms-2 text-[11px] text-slate-400">{mock.title ?? "Terminal"}</span>
        </div>
        <div className="space-y-1 p-3 text-left font-mono text-[11px] leading-relaxed">
          {mock.lines.map((line, i) => (
            <div key={i} className={`break-all ${TERMINAL_COLORS[line.style ?? "out"]}`}>
              {line.style === "cmd" || line.style === "hl" ? <span className="text-emerald-400">$ </span> : null}
              {line.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mock.kind === "phone") {
    return (
      <div className="mx-auto w-56 rounded-[2rem] border-4 border-slate-800 bg-slate-800 p-1 shadow-lg">
        <div className="overflow-hidden rounded-[1.6rem] bg-slate-50 dark:bg-slate-900">
          <div className="flex justify-center py-1.5">
            <span className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
          <div className="border-b border-slate-200 px-3 pb-2 text-xs font-bold dark:border-slate-700">{mock.title}</div>
          <div className="space-y-2.5 p-3">
            {mock.body.map((el, i) => (
              <Element key={i} el={el} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <span className="flex gap-1">
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
        </span>
        <span
          dir="ltr"
          className="flex-1 truncate rounded-md bg-white px-2 py-0.5 text-left font-mono text-[11px] text-slate-500 dark:bg-slate-900"
        >
          🔒 {mock.url}
        </span>
      </div>
      <div className="flex">
        {mock.sidebar && (
          <div dir="ltr" className="hidden w-28 shrink-0 space-y-1 border-r border-slate-200 p-2 text-[11px] sm:block dark:border-slate-700">
            {mock.sidebar.map((item, i) => (
              <div
                key={item}
                className={`truncate rounded px-1.5 py-1 ${i === mock.activeSide ? "bg-sky-100 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200" : "text-slate-500"}`}
              >
                {item}
              </div>
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3 p-4">
          {mock.body.map((el, i) => (
            <Element key={i} el={el} />
          ))}
        </div>
      </div>
    </div>
  );
}
