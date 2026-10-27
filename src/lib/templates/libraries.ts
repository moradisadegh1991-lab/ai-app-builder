import type { AppTemplate } from "../db/schema";

// Extra npm packages the AI may request. Restricting to a vetted list with
// known-good version ranges keeps generated projects buildable.
export const ALLOWED_LIBRARIES: Record<AppTemplate, Record<string, string>> = {
  capacitor: {
    "react-router-dom": "^7.18.0",
    "lucide-react": "^1.62.0",
    recharts: "^3.10.0",
    "date-fns": "^4.4.0",
    zustand: "^5.0.16",
    "@capacitor/preferences": "^8.0.1",
    "@capacitor/haptics": "^8.0.2",
    "@capacitor/camera": "^8.2.6",
    "@capacitor/local-notifications": "^8.3.1",
    "@capacitor/share": "^8.0.3",
  },
  web: {
    "react-router-dom": "^7.18.0",
    "lucide-react": "^1.62.0",
    recharts: "^3.10.0",
    "date-fns": "^4.4.0",
    zustand: "^5.0.16",
  },
  expo: {
    "@react-native-async-storage/async-storage": "2.2.0",
    "react-native-safe-area-context": "~5.10.1",
    "date-fns": "^4.4.0",
    zustand: "^5.0.16",
  },
};

export const LIBRARY_DESCRIPTIONS: Record<AppTemplate, string> = {
  capacitor: [
    "react-router-dom (routing; use HashRouter)",
    "lucide-react (icons)",
    "recharts (charts)",
    "date-fns (dates)",
    "zustand (state)",
    "@capacitor/preferences (native key-value storage)",
    "@capacitor/haptics, @capacitor/camera, @capacitor/local-notifications, @capacitor/share (device features)",
  ].join("\n- "),
  web: [
    "react-router-dom (routing; use BrowserRouter only if every route is reachable from /, otherwise HashRouter)",
    "lucide-react (icons)",
    "recharts (charts)",
    "date-fns (dates)",
    "zustand (state)",
  ].join("\n- "),
  expo: [
    "@react-native-async-storage/async-storage (persistent storage)",
    "react-native-safe-area-context (safe areas)",
    "date-fns (dates)",
    "zustand (state)",
  ].join("\n- "),
};
