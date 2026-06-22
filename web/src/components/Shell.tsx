import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useTheme } from "../lib/useTheme";

interface ShellProps {
  children: ReactNode;
  showNewPoll?: boolean;
}

export function Shell({ children, showNewPoll = true }: ShellProps) {
  const [theme, toggle] = useTheme();

  return (
    <div className="page">
      <header className="shell">
        <nav className="nav" aria-label="Primary">
          <div className="nav-links">
            <Link to="/" className="wordmark">
              samkoma
            </Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            {showNewPoll && (
              <Link to="/new" className="btn btn-primary btn-sm">
                New poll
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="shell" style={{ flex: 1, width: "100%" }}>
        {children}
      </main>

      <footer className="footer">
        <div className="shell">
          samkoma · group scheduling with one shared link ·{" "}
          <a
            href="https://github.com/drmowinckels/samkoma"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
