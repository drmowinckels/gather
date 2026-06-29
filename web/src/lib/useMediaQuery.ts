import { useEffect, useState } from "react";

// Track a CSS media query in React. Returns false where matchMedia is
// unavailable (jsdom/SSR), so callers get a stable single-column default.
export function useMediaQuery(query: string): boolean {
  const supported =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() =>
    supported ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (!supported) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query, supported]);

  return matches;
}
