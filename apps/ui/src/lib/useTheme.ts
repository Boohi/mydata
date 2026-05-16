import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type Density = "comfy" | "regular" | "compact";

const THEME_KEY = "mydata.theme";
const DENSITY_KEY = "mydata.density";

function readTheme(): Theme {
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" ? "dark" : "light";
}

function readDensity(): Density {
  const v = localStorage.getItem(DENSITY_KEY);
  return v === "comfy" || v === "compact" ? v : "regular";
}

export interface UseThemeResult {
  theme: Theme;
  density: Density;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [density, setDensityState] = useState<Density>(readDensity);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const setDensity = useCallback((next: Density) => setDensityState(next), []);

  return { theme, density, setTheme, setDensity };
}
