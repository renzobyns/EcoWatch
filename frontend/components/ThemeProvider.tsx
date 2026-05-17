"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("dark");

    useEffect(() => {
        const stored = localStorage.getItem("ecowatch_theme") as Theme | null;
        const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial: Theme = stored ?? (sys ? "dark" : "light");
        setThemeState(initial);
        document.documentElement.classList.toggle("dark", initial === "dark");
    }, []);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem("ecowatch_theme", t);
        document.documentElement.classList.toggle("dark", t === "dark");
    };

    const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
