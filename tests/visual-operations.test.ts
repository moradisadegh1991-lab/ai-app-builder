import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createVisualTemplate } from "../src/lib/visual/templates";
import { addPage, renamePage, removePage, movePage, addComponent, moveComponent, removeComponent } from "../src/lib/visual/operations";
describe("visual editing operations", () => {
  it("adds, renames, orders and removes pages without changing the original", () => {
    const original = createVisualTemplate("daily", randomUUID), id = randomUUID();
    let next = addPage(original, id); next = renamePage(next, id, "آزمون"); next = movePage(next, id, -1);
    expect(next.pages[3]?.id).toBe(id); expect(original.pages).toHaveLength(4);
    next = removePage(next, id); expect(next.pages).toHaveLength(4);
    expect(() => removePage({ ...next, pages: [next.pages[0]!] }, next.pages[0]!.id)).toThrow();
  });
  it("adds, reorders and removes bounded safe components", () => {
    const original = createVisualTemplate("daily", randomUUID), page = original.pages[0]!.id, id = randomUUID();
    let next = addComponent(original, page, id, "button"); next = moveComponent(next, page, id, -1);
    expect(next.pages[0]!.components[1]!.id).toBe(id);
    next = removeComponent(next, page, id); expect(next.pages[0]!.components).toHaveLength(2);
    expect(() => addComponent(original, page, randomUUID(), "script" as never)).toThrow();
  });
});
