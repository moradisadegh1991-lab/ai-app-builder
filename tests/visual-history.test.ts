import { describe, expect, it } from "vitest";
import { editHistory, redoHistory, undoHistory } from "../src/lib/visual/history";
describe("visual undo and redo", () => {
  it("restores edits in order and discards redo after a new edit", () => {
    let state = { past: [] as string[], present: "a", future: [] as string[] };
    state = editHistory(state, "b"); state = editHistory(state, "c");
    state = undoHistory(state); expect(state.present).toBe("b");
    state = undoHistory(state); expect(state.present).toBe("a");
    state = redoHistory(state); expect(state.present).toBe("b");
    state = editHistory(state, "d"); expect(state.future).toEqual([]);
    expect(redoHistory(state).present).toBe("d");
  });
  it("bounds retained history", () => {
    let state = { past: [] as number[], present: 0, future: [] as number[] };
    for (let i = 1; i <= 70; i++) state = editHistory(state, i);
    expect(state.past).toHaveLength(50);
  });
});
