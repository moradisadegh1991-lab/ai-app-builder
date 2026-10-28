// lucide-react v1 dropped its brand logos, but models still write
// `import { Instagram } from "lucide-react"`, which fails the production build with
// MISSING_EXPORT. Each removed brand icon is aliased to a neutral icon that still exists,
// so `<Instagram />` in the generated code keeps compiling.
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

const LUCIDE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*(["'])lucide-react\2/g;

export function replaceRemovedLucideIcons(source: string): string {
  return source.replace(LUCIDE_IMPORT, (statement, specifiers: string, quote: string) => {
    let changed = false;
    const next = specifiers
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [imported, alias] = part.split(/\s+as\s+/);
        const replacement = imported ? REMOVED_BRAND_ICONS[imported] : undefined;
        if (!replacement) return part;
        changed = true;
        return `${replacement} as ${alias ?? imported}`;
      })
      .join(", ");
    return changed ? `import { ${next} } from ${quote}lucide-react${quote}` : statement;
  });
}
