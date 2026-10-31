import snapshot from "./package-exports.json";

// Models sometimes import names a library does not export (renamed or removed icons, made-up
// chart components). Vite then fails with MISSING_EXPORT after a 5-15 minute CI run. This checks
// named imports against a snapshot of the real exports (scripts/snapshot-exports.mjs):
//  - lucide-react icons are replaced by the closest existing icon, deterministically;
//  - other packages are reported so the caller can run one repair round.

const EXPORTS = snapshot as unknown as Record<string, string[]>;
const SETS = new Map<string, Set<string>>(
  Object.keys(EXPORTS)
    .filter((name) => Array.isArray(EXPORTS[name]))
    .map((name) => [name, new Set(EXPORTS[name])]),
);

const NAMED_IMPORT = /import\s+(type\s+)?(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([^}]*)\}\s*from\s*(["'])([^"']+)\4/g;

export interface UnresolvedImport {
  file: string;
  module: string;
  name: string;
}

export interface ImportCheck {
  content: string;
  /** Replacements made automatically: "Instagram → Camera". */
  fixed: string[];
  unresolved: UnresolvedImport[];
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/** Brand logos lucide-react v1 removed, mapped to neutral icons that exist. */
const REMOVED_BRAND_ICONS: Record<string, string> = {
  Chrome: "Globe",
  Chromium: "Globe",
  Codepen: "Code",
  Codesandbox: "Box",
  Dribbble: "Palette",
  Facebook: "Users",
  Figma: "PenTool",
  Framer: "Frame",
  Github: "Code",
  Gitlab: "GitBranch",
  Instagram: "Camera",
  Linkedin: "Briefcase",
  Pocket: "Bookmark",
  Slack: "Hash",
  Trello: "LayoutDashboard",
  Twitch: "Tv",
  Twitter: "AtSign",
  Youtube: "Play",
};

/** Closest existing lucide icon: brand map, then case/suffix variants, then a small edit distance. */
export function closestLucideIcon(name: string): string {
  const icons = SETS.get("lucide-react")!;
  const brand = REMOVED_BRAND_ICONS[name];
  if (brand && icons.has(brand)) return brand;
  const base = name.replace(/^Lucide/, "").replace(/Icon$/, "");
  const lower = base.toLowerCase();
  let best: { icon: string; score: number } | null = null;
  for (const icon of icons) {
    if (icon.startsWith("Lucide") || icon.endsWith("Icon") || icon === "icons") continue;
    if (icon.toLowerCase() === lower) return icon;
    const score = distance(icon.toLowerCase(), lower);
    if (score <= 2 && (!best || score < best.score)) best = { icon, score };
  }
  return best?.icon ?? "Circle";
}

export function isKnownModule(module: string): boolean {
  return SETS.has(module);
}

/** Checks (and for lucide-react repairs) the named imports of one source file. */
export function checkImports(file: string, source: string): ImportCheck {
  const fixed: string[] = [];
  const unresolved: UnresolvedImport[] = [];

  const content = source.replace(NAMED_IMPORT, (statement, typeOnly: string | undefined, defaultName: string | undefined, specifiers: string, quote: string, module: string) => {
    const exports = SETS.get(module);
    if (typeOnly || !exports) return statement;
    let changed = false;
    const next = specifiers
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        if (part.startsWith("type ")) return part;
        const [imported, alias] = part.split(/\s+as\s+/);
        if (!imported || exports.has(imported)) return part;
        if (module === "lucide-react") {
          const replacement = closestLucideIcon(imported);
          fixed.push(`${imported} → ${replacement}`);
          changed = true;
          return `${replacement} as ${alias ?? imported}`;
        }
        unresolved.push({ file, module, name: imported });
        return part;
      })
      .join(", ");
    return changed ? `import ${defaultName ? `${defaultName}, ` : ""}{ ${next} } from ${quote}${module}${quote}` : statement;
  });

  return { content, fixed, unresolved };
}
