# Poker Trainer

A personal poker training tool for building two core skills: hand equity estimation and draw probability calculation. No accounts, no server — just open `index.html` in a browser.

## Modes

### Equity & Pot Odds
You're shown a hand mid-street with all cards face-up (yours and your opponents'). You estimate:
- Your **equity** (% chance your hand wins)
- The **pot odds** (minimum equity needed to break even on a call)
- Your **decision** — Fold, Call, or Raise

On submit, you see the true equity (calculated exactly for flop/turn, via Monte Carlo for preflop), whether your decision was correct, and how far off your estimates were.

### Draw Probability
Solo mode — no opponents. You're shown your hole cards and a board (flop or turn), and the game identifies your primary draw (flush draw, open-ended straight draw, or gutshot). You estimate the probability of completing it by the river. On submit, you see the true probability and a breakdown using the rule of 2 and 4.

## Settings

| Setting | Description | Applies to |
|---|---|---|
| Table Size | Controls how many opponents you face (1–4, weighted) | Equity mode |
| Hand Stage | Weights toward earlier (preflop/flop) or later (flop/turn) streets | Both modes |
| Decision Margin | Target gap between equity and pot odds — lower = harder decisions | Equity mode |

Settings persist across sessions via `localStorage`.

## How equity is calculated

- **River**: exact (hand is complete)
- **Flop / Turn**: exact enumeration over all remaining card combinations
- **Preflop**: 50,000-iteration Monte Carlo, run in chunks via `setTimeout` to keep the UI responsive

For flop/turn hands in equity mode, equity is pre-calculated in a background pool of 800 scenarios while you're on the home screen, so there's no wait when you start playing.

## Files

```
index.html          main page (home screen + both training screens)
css/style.css       dark poker theme
js/
  cards.js          Card and Deck classes
  evaluator.js      5- and 7-card hand evaluator (exact integer scoring)
  equity.js         equity calculation (exact + async Monte Carlo)
  scenarios.js      scenario generation, pot/bet sizing, weighted random helpers
  draws.js          draw detection (flush, OESD, gutshot) and probability math
  app.js            application logic, UI, background pool, session stats
```

## Running locally

No build step. Open `index.html` directly in a browser. Chrome works best; note that some browsers restrict `file://` access to Web Workers, which is why the async equity calculation uses `setTimeout` chunking instead.
