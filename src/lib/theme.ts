// Theme preference shared by the inline <head> script (first paint) and the ThemeToggle.
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "i2a-theme";

/**
 * Runs synchronously in <head> before the first paint: applies the stored preference (or the
 * system setting) to <html data-theme>, so neither a flash of the wrong theme nor a hydration
 * mismatch can happen. Kept tiny and dependency-free on purpose.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;d.setAttribute("data-theme",t);d.setAttribute("data-theme-pref",p);d.style.colorScheme=t}catch(e){}})()`;
