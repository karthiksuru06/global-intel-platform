import { create } from "zustand";

const useTheme = create((set) => ({
  theme: localStorage.getItem("gip-theme") || "dark",

  toggleTheme: () => {
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("gip-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content",
        next === "dark" ? "#0a0a14" : "#f0f2f5"
      );
      window.dispatchEvent(new CustomEvent("theme-changed", { detail: { theme: next } }));
      return { theme: next };
    });
  },

  setTheme: (theme) => {
    localStorage.setItem("gip-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));

// Apply theme on load (prevents flash)
const savedTheme = localStorage.getItem("gip-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

export default useTheme;
