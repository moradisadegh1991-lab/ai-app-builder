import { TONE_BADGE, projectStatus } from "./ui/status";

export function StatusBadge({ status }: { status: string }) {
  const { label, tone } = projectStatus(status);
  return <span className={`${TONE_BADGE[tone]} badge-dot`}>{label}</span>;
}
