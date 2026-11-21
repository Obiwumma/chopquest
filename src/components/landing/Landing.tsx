// The landing page at "/": what ChopQuest is, in one scroll, then "Open the app" (/start).
// Drawn as a full-screen layer above the app shell, so the vine nav and the bean stay hidden here.
/* eslint-disable @next/next/no-img-element -- small local photos, sized in CSS */

import Link from "next/link";
import { Anton, Inter } from "next/font/google";
import LiveCounts from "./LiveCounts";
import LandingFx from "./LandingFx";
import type { CSSProperties } from "react";
import "./landing.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--lp-anton" });
const inter = Inter({ weight: ["500", "600", "700", "800"], subsets: ["latin"], variable: "--lp-inter" });

const TICKER = ["Meat out, flavour in", "Soy chunks, always", "Moi moi Mondays", "Big bites of akara", "Awara in pepper sauce", "Same jollof, new protein", "Kuli-kuli crunch"];

// Each headline word flies in from its own side and angle.
const fly = (x: string, y: string, r: string, d: number) => ({ "--x": x, "--y": y, "--r": r, "--d": `${d}s` }) as CSSProperties;
const delay = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function Landing() {
  return (
    <div className={`lp ${anton.variable} ${inter.variable}`}>
      <LandingFx />
      <div className="progress" aria-hidden />
      <div className="page">
        <header className="hero">
          <div className="top">
            <Link href="/start" className="logo" aria-label="ChopQuest">
              <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
                <ellipse cx="16" cy="19" rx="11" ry="10" fill="#fdf3dc" stroke="#3b2a1a" strokeWidth="2" />
                <path d="M16 9c0-4 2-6 5-7-1 4-2 6-5 7zM16 9c-1-3-3-4-6-4 1 3 3 4 6 4z" fill="#22c55e" />
                <circle cx="12.5" cy="18" r="1.4" fill="#3b2a1a" />
                <circle cx="19.5" cy="18" r="1.4" fill="#3b2a1a" />
                <path d="M13.5 22q2.5 2 5 0" stroke="#3b2a1a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </Link>
            <div className="r">
              <Link href="/cafeterias" className="circ" aria-label="Find a cafeteria">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
              </Link>
              <Link href="/board" className="circ" aria-label="Campus Plant Board">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M9 20V9h6v11M3 20v-7h6M15 20v-5h6v5M2 20h20" />
                </svg>
              </Link>
              <Link className="btn" href="/start" style={{ background: "var(--cream)", color: "var(--deep)" }}>
                Open the app
              </Link>
            </div>
          </div>

          <div className="heroGrid">
            <div>
              <h1 className="big" aria-label="Plants made to be craved">
                <span className="w" style={fly("-70vw", "-30vh", "-35deg", 0.15)} aria-hidden>Plants</span>
                <br />
                <span className="w" style={fly("0", "-70vh", "25deg", 0.35)} aria-hidden>made</span>{" "}
                <span className="w" style={fly("80vw", "-10vh", "40deg", 0.5)} aria-hidden>to</span>
                <br />
                <span className="y">
                  <span className="w" style={fly("-40vw", "60vh", "-30deg", 0.65)} aria-hidden>be</span>{" "}
                  <span className="w" style={fly("70vw", "50vh", "30deg", 0.8)} aria-hidden>craved</span>
                </span>
              </h1>
              <div className="cta">
                <Link className="btn" href="/home" style={{ background: "var(--cream)", color: "var(--deep)" }}>
                  I&apos;m a student
                </Link>
                <Link className="btn" href="/kitchen" style={{ background: "#ffffff1f", color: "var(--cream)" }}>
                  I run a kitchen
                </Link>
                <Link className="circ" href="/start" aria-label="Open the app" style={{ background: "#ffffff1f", color: "var(--cream)" }}>
                  <Arrow />
                </Link>
              </div>
            </div>
            <div className="plate">
              <span className="skewer" aria-hidden />
              <img src="/landing/hero-plate.jpg" alt="Awara (tofu) stir-fry with rice, carrots, broccoli and peppers" />
            </div>
            <div className="sig">
              <small>Signature swap</small>
              <div className="price">Awara stir-fry plate</div>
              <p>Golden awara (Nigerian tofu) with rice, carrots, broccoli and peppers. The meat is gone, the protein stays. Protein and cost on every plate (estimates).</p>
            </div>
            <div className="notch">
              <div className="dots" aria-hidden>
                <i />
                <i />
              </div>
              <div className="mini">
                <img src="/landing/akara.jpg" alt="A basket of akara" />
                <div>
                  <b>
                    Akara
                    <br />
                    basket
                  </b>
                  <Link className="btn" href="/board" style={{ background: "var(--cream)", color: "var(--deep)", minHeight: 36, padding: "0 14px" }}>
                    Rate it
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="ticker" aria-hidden>
            <div>
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i}>
                  {t} <i>●</i>{" "}
                </span>
              ))}
            </div>
          </div>
        </header>

        <section className="cream" data-reveal="zoom">
          <h2>
            Big flavours. Local alt proteins. No boring plates.<span className="sticker">Made in Abuja</span>
          </h2>
          <p>
            We help campus cafeterias swap the meat in their best sellers for moi moi, akara, awara, soy chunks and beans. Same dish, same price or less, and students
            rate every swap on the Plant Board before you try it.
          </p>
          <Link className="btn" href="/board" style={{ background: "var(--g)", color: "var(--cream)" }}>
            See the Plant Board
          </Link>{" "}
          <Link className="circ" href="/board" aria-label="See the Plant Board" style={{ background: "var(--g)", color: "var(--cream)", verticalAlign: "middle" }}>
            <Arrow />
          </Link>
          <img className="float f1" src="/landing/moimoi.jpg" alt="Moi moi" />
          <img className="float f2" src="/landing/kuli.jpg" alt="Kuli-kuli" />
        </section>

        <div className="split">
          <div className="look" data-reveal="left">
            <img src="/landing/awara.jpg" alt="Awara (soy cheese) in pepper sauce" />
            <h3 className="big">
              Look
              <br />
              inside
            </h3>
          </div>
          <div className="good" data-reveal="right" style={delay(0.12)}>
            <h3 className="big">The good stuff</h3>
            <p>Nigerian alt proteins we already love, ready to replace the meat.</p>
            <div className="facts">
              <span>Soy chunks <b>50 g</b></span>
              <span>Kuli-kuli <b>30 g</b></span>
              <span>Egusi <b>26 g</b></span>
              <span>Groundnuts <b>23 g</b></span>
              <span>Okpa <b>8 g</b></span>
            </div>
            <img src="/landing/okpa.jpg" alt="Okpa, steamed bambara nut pudding" />
          </div>
        </div>
        <p className="note">Protein per 100 g from our food list. Estimates, not medical advice.</p>

        <section className="how" data-reveal="up">
          <h2 className="big">
            How it <span className="y">works</span>
          </h2>
          <div className="steps">
            <div className="st" data-reveal="up" style={delay(0.15)}>
              <div className="n">01</div>
              <b>Break it down</b>
              <p>Chloe, our AI, splits a menu dish into parts and grams, checked against 38 Nigerian foods.</p>
            </div>
            <div className="st" data-reveal="up" style={delay(0.3)}>
              <div className="n">02</div>
              <b>Swap the meat</b>
              <p>The manager sets cost and protein limits. The engine returns the top 3 plant swaps with ₦ cost and reasons.</p>
            </div>
            <div className="st" data-reveal="up" style={delay(0.45)}>
              <div className="n">03</div>
              <b>Let students judge</b>
              <p>The kitchen publishes it, students rate it on the Plant Board, and the best cafeterias climb the ranking.</p>
            </div>
          </div>
        </section>

        <LiveCounts />

        <div className="sides">
          <div className="side s1" data-reveal="left">
            <h3 className="big">Chop Squad</h3>
            <ul>
              <li>Find the best plant dishes on campus</li>
              <li>Read honest reviews before you try</li>
              <li>Ask for a plant version of your favourite</li>
              <li>Grow your bean with every alt protein</li>
            </ul>
            <Link className="btn" href="/home" style={{ background: "var(--g)", color: "var(--cream)", justifySelf: "start" }}>
              I&apos;m a student
            </Link>
          </div>
          <div className="side s2" data-reveal="right" style={delay(0.12)}>
            <h3 className="big">Kitchen</h3>
            <ul>
              <li>Pick a top seller from your menu</li>
              <li>Set your cost and protein limits</li>
              <li>Get 3 swaps with numbers and reasons</li>
              <li>See what students are asking for</li>
            </ul>
            <Link className="btn" href="/kitchen" style={{ background: "var(--cream)", color: "var(--pep)", justifySelf: "start" }}>
              I run a kitchen
            </Link>
          </div>
        </div>

        <footer data-reveal="up">
          <h3 className="big">Team Chloe</h3>
          <div className="team">
            <span>Ola · Frontend</span>
            <span>Pascal · AI</span>
            <span>Marv · Backend</span>
            <span>Jason · Market survey</span>
          </div>
          <Link className="btn" href="/start" style={{ background: "var(--deep)", color: "var(--cream)", justifySelf: "start" }}>
            Open the app <Arrow />
          </Link>
          <small>
            Built for Hack the Fork Nigeria 2026, Challenge 2: AI for plant-based menu innovation.
            <br />
            Photos from Wikimedia Commons (CC BY-SA 4.0 / CC0): tofu stir-fry, fried bean cake, moi moi, kuli-kuli, awara with pepper sauce, okpa.
          </small>
        </footer>
      </div>
    </div>
  );
}
