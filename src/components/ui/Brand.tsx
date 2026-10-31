import Link from "next/link";

/** Logo mark + wordmark. */
export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2.5 py-1.5" aria-label="Idea2App AI">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg shadow-xs" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      </span>
      {!compact && (
        <span className="ltr text-[15px] font-extrabold tracking-tight text-fg">
          Idea2App<span className="text-primary"> AI</span>
        </span>
      )}
    </Link>
  );
}
