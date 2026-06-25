import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { Mark } from "../components/Logo";
import { GITHUB_URL, SUPPORT_URL } from "../lib/links";

const PRINCIPLES = [
  {
    title: "No accounts, ever",
    body: "You shouldn't have to sign up to answer “when are you free?” Nobody makes a profile, nobody gets added to a list. Polls expire on their own and quietly disappear.",
  },
  {
    title: "One link does it",
    body: "Share a single link. People paint when they're free — on a phone, in their own timezone — and leave. No app to install, no invite to accept.",
  },
  {
    title: "Your data isn't the product",
    body: "There's nothing to monetise here. A poll holds only what it needs to do its job, and it's deleted once it's done.",
  },
  {
    title: "API-first, not API-eventually",
    body: "Everything the website does is a public REST call, so a script or a bot can run the very same flow. The web app is just one polite client.",
  },
];

export function About() {
  return (
    <Shell>
      <div className="content">
        <section className="page-hero">
          <div>
            <p className="eyebrow">About</p>
            <h1 className="h1">We made the boring part painless.</h1>
            <p className="lede">
              samkoma is a small, independent tool for the universally annoying
              job of finding a time that works for a group. One link, no
              accounts, and a live heatmap that lights up the slot the most
              people can make. That's the whole thing.
            </p>
          </div>
          <div className="hero-emblem" aria-hidden="true">
            <Mark size={148} />
          </div>
        </section>

        <section className="section">
          <h2 className="h2">Why it works this way</h2>
          <p className="section-lead">
            A few deliberate choices, each one in service of getting out of your
            way.
          </p>
          <div className="principles">
            {PRINCIPLES.map((p) => (
              <div className="principle" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="h2">Where it comes from</h2>
          <div className="prose" style={{ marginTop: 14 }}>
            <p>
              samkoma began as the scheduling brain behind <strong>Jinx</strong>
              , the RLadies+ community bot — but it's built to stand on its own.
              Jinx is simply one consumer of the public API; anyone can be
              another. The product is deliberately <strong>independent</strong>:
              not tied to any single community or company, and not anyone's
              growth funnel.
            </p>
            <p>
              It's open source and maintained by Dr. Athanasia Mowinckel. If
              you'd like to see how it's built, file an issue, or send a patch,
              it all lives on{" "}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
              .
            </p>
          </div>
        </section>

        <section className="section">
          <h2 className="h2">Keeping it free</h2>
          <div className="support-card">
            <span className="support-mark">
              <Mark size={44} />
            </span>
            <div className="support-copy">
              <p>
                samkoma runs on free tiers and stays free to use — no paywalls,
                no “pro” plan. If it saved you an email thread or two and you'd
                like to chip in toward the upkeep, you can buy me a coffee.
                Entirely optional, genuinely appreciated.
              </p>
            </div>
            <a
              className="btn btn-primary"
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
            >
              Buy me a coffee ☕
            </a>
          </div>
        </section>

        <section className="section">
          <h2 className="h2">Ready to find a time?</h2>
          <div className="cta-row">
            <Link to="/new" className="btn btn-primary">
              Create a poll →
            </Link>
            <Link to="/api" className="btn btn-outline">
              Explore the API
            </Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
