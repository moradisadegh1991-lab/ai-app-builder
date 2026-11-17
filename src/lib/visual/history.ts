export type History<T> = { past: T[]; present: T; future: T[] };
export function editHistory<T>(state: History<T>, value: T): History<T> {
  return { past: [...state.past.slice(-49), state.present], present: value, future: [] };
}
export function undoHistory<T>(state: History<T>): History<T> {
  if (!state.past.length) return state;
  return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1]!, future: [state.present, ...state.future].slice(0, 50) };
}
export function redoHistory<T>(state: History<T>): History<T> {
  if (!state.future.length) return state;
  return { past: [...state.past, state.present].slice(-50), present: state.future[0]!, future: state.future.slice(1) };
}
