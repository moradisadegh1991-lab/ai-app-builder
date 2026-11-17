import type { VisualProject, VisualComponent } from "./schema";
export type VisualTemplateId = "daily" | "maintenance" | "appointment";
const definitions: Record<VisualTemplateId, { title: string; pages: [string, string, string][] }> = {
  daily: { title: "گزارش روزانه", pages: [["خانه", "/", "نمای کلی گزارش‌های روزانه"], ["گزارش‌ها", "/reports", "فهرست نمونه گزارش‌ها"], ["گزارش جدید", "/new-report", "فرم نمونه گزارش"], ["وضعیت", "/status", "وضعیت نمونه فعالیت‌ها"]] },
  maintenance: { title: "درخواست تعمیرات", pages: [["داشبورد", "/", "نمای کلی درخواست‌ها"], ["درخواست جدید", "/request", "فرم نمونه درخواست"], ["درخواست‌ها", "/requests", "فهرست نمونه درخواست‌ها"], ["وضعیت", "/status", "وضعیت نمونه کار"]] },
  appointment: { title: "نوبت‌دهی", pages: [["معرفی", "/", "به سامانه نوبت‌دهی خوش آمدید"], ["خدمات", "/services", "خدمات نمونه"], ["زمان‌ها", "/times", "زمان‌های نمونه"], ["درخواست", "/booking", "ثبت درخواست نمونه"]] },
};
export function createVisualTemplate(kind: VisualTemplateId, nextId: () => string): VisualProject {
  const definition = definitions[kind];
  return { schemaVersion: 1, revision: 0, designTokens: { primary: "#096c5c", background: "#ffffff", direction: "rtl" },
    pages: definition.pages.map(([title, route, text]) => ({ id: nextId(), title, route, components: [
      { id: nextId(), type: "heading", props: { text: title }, style: { fontSize: 28, padding: 12 }, children: [] } satisfies VisualComponent,
      { id: nextId(), type: "text", props: { text }, style: { fontSize: 16, padding: 12 }, children: [] } satisfies VisualComponent,
    ] })) };
}
