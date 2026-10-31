import { describe, expect, it } from "vitest";
import { checkImports, closestLucideIcon } from "../src/lib/templates/imports";

describe("checkImports", () => {
  it("leaves valid imports and type imports untouched", () => {
    const source = `import { Home, Star } from "lucide-react";\nimport type { LucideIcon } from "lucide-react";\nimport { type LucideProps, Menu } from "lucide-react";\nimport { format } from "date-fns";`;
    const result = checkImports("src/App.tsx", source);
    expect(result.content).toBe(source);
    expect(result.fixed).toEqual([]);
    expect(result.unresolved).toEqual([]);
  });

  it("repairs lucide-react icons that do not exist and keeps the local name", () => {
    const source = `import { MapPin, Instagram, Calender, Zzzzzzzz } from "lucide-react";\nexport const A = () => <Instagram />;`;
    const result = checkImports("src/Footer.tsx", source);
    expect(result.content).toContain("MapPin, Camera as Instagram, Calendar as Calender, Circle as Zzzzzzzz");
    expect(result.content).toContain("<Instagram />");
    expect(result.fixed).toEqual(["Instagram → Camera", "Calender → Calendar", "Zzzzzzzz → Circle"]);
  });

  it("keeps an existing alias and a default import", () => {
    const result = checkImports("a.tsx", `import Chart, { Youtube as Yt, X } from 'lucide-react';`);
    expect(result.content).toBe(`import Chart, { Play as Yt, X } from 'lucide-react';`);
  });

  it("reports unknown exports of other libraries instead of guessing", () => {
    const source = `import { LineChart, Gauge, ResponsiveContainer } from "recharts";\nimport { useNavigate, useRouter } from "react-router-dom";`;
    const result = checkImports("src/Dash.tsx", source);
    expect(result.content).toBe(source);
    expect(result.unresolved).toEqual([
      { file: "src/Dash.tsx", module: "recharts", name: "Gauge" },
      { file: "src/Dash.tsx", module: "react-router-dom", name: "useRouter" },
    ]);
  });

  it("ignores packages it has no snapshot for", () => {
    const source = `import { anything } from "some-other-package";`;
    expect(checkImports("a.ts", source).unresolved).toEqual([]);
  });

  it("maps removed brand icons and finds suffix variants", () => {
    expect(closestLucideIcon("Github")).toBe("Code");
    expect(closestLucideIcon("HomeIcon")).toBe("Home");
  });
});
