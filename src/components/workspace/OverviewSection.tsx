"use client";

import type { ProjectView } from "@/lib/projects";
import { Icon } from "../ui/Icon";
import { DEPLOYMENT_STATUS, TONE_BADGE, VPS_STATUS, buildStatus, projectStatus } from "../ui/status";
import { deployLabel, type NextAction, type SectionId, type WorkspaceSection } from "./model";
import { ExternalLink, Fact, Section, StepMarker } from "./parts";

const TEMPLATE_LABEL: Record<string, string> = {
  web: "وب‌سایت React + Vite",
  capacitor: "اپ Android (React + Capacitor)",
  expo: "اپ Android (React Native / Expo)",
};

/** Summary of the project: lifecycle at a glance, key facts and the suggested next step. */
export function OverviewSection({
  project,
  sections,
  next,
  onNavigate,
}: {
  project: ProjectView;
  sections: WorkspaceSection[];
  next: NextAction;
  onNavigate: (id: SectionId) => void;
}) {
  const pipeline = sections.filter((section) => section.id !== "overview" && section.id !== "preview");
  const done = pipeline.filter((section) => section.state === "done").length;
  const build = buildStatus(project.build, project.kind === "website");
  const deploy =
    project.hosting === "vercel"
      ? project.deployment && (DEPLOYMENT_STATUS[project.deployment.status] ?? null)
      : project.hosting === "vps"
        ? project.vps && (VPS_STATUS[project.vps.status] ?? null)
        : null;
  const status = projectStatus(project.status);

  return (
    <div className="flex flex-col gap-5">
      <section className="panel overflow-hidden shadow-xs">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="eyebrow">اقدام بعدی</div>
            <h2 className="mt-1 text-lg font-bold text-fg">{next.title}</h2>
            <p className="mt-1 text-sm leading-7 text-muted">{next.description}</p>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={() => onNavigate(next.section)}>
            ادامه
            <Icon name="arrow-left" size={16} />
          </button>
        </div>
        <div className="border-t border-line px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-xs text-muted">
            <span>پیشرفت پروژه</span>
            <span>
              {done.toLocaleString("fa-IR")} از {pipeline.length.toLocaleString("fa-IR")} مرحله
            </span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {pipeline.map((section, index) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(section.id)}
                  disabled={section.state === "locked"}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-start transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <StepMarker state={section.state} number={index + 1} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg">{section.label}</span>
                    <span className="block truncate text-xs text-muted">{section.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon="sparkles" title="ایدهٔ پروژه">
          <p className="text-sm leading-8 whitespace-pre-wrap text-fg-2">{project.idea}</p>
          {project.attachments.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold text-muted">پیوست‌ها</div>
              <ul className="flex flex-wrap gap-2">
                {project.attachments.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="badge">
                    <Icon name={item.kind === "image" ? "image" : "file"} size={13} />
                    <span className="max-w-40 truncate" dir="auto">
                      {item.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section icon="layers" title="مشخصات">
          <dl className="-my-2 divide-y divide-line">
            <Fact label="وضعیت">
              <span className={`${TONE_BADGE[status.tone]} badge-dot`}>{status.label}</span>
            </Fact>
            <Fact label="نوع">{TEMPLATE_LABEL[project.template] ?? project.template}</Fact>
            <Fact label="محل اجرا">{deployLabel(project)}</Fact>
            <Fact label="مخزن">
              {project.repo ? (
                <ExternalLink href={project.repo.url} className="ltr">
                  {project.repo.owner}/{project.repo.name}
                </ExternalLink>
              ) : (
                <span className="text-muted">ساخته نشده</span>
              )}
            </Fact>
            <Fact label="آخرین Build">
              <span className={TONE_BADGE[build.tone]}>{build.label}</span>
            </Fact>
            {deploy && (
              <Fact label="استقرار">
                <span className={TONE_BADGE[deploy.tone]}>{deploy.label}</span>
              </Fact>
            )}
            {project.generation?.model && (
              <Fact label="مدل آخرین تولید">
                <span className="ltr font-mono text-xs">{project.generation.model}</span>
              </Fact>
            )}
          </dl>
        </Section>
      </div>
    </div>
  );
}
