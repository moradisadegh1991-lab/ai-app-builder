import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createVisualTemplate, type VisualTemplateId } from "../src/lib/visual/templates";
import { parseVisualProject } from "../src/lib/visual/schema";
describe("visual templates", () => {
  it.each(["daily", "maintenance", "appointment"] as VisualTemplateId[])("produces valid data for %s without AI", (kind) => {
    const document = createVisualTemplate(kind, randomUUID);
    expect(parseVisualProject(document).success).toBe(true);
    expect(document.pages.length).toBe(4);
    expect(document.revision).toBe(0);
  });
});
