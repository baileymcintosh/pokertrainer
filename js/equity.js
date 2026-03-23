// Equity calculator — depends on cards.js and evaluator.js

function calcShare(heroCards, villainCards, board) {
  const heroAll = [...heroCards, ...board];
  const heroScore = evaluateBest(heroAll);

  let maxScore = heroScore;
  const villainScores = villainCards.map(vc => {
    const s = evaluateBest([...vc, ...board]);
    if (s > maxScore) maxScore = s;
    return s;
  });

  if (heroScore < maxScore) return 0;

  // Hero is tied or winning — count tied players
  let tiedCount = 1; // hero
  for (const vs of villainScores) {
    if (vs === maxScore) tiedCount++;
  }
  return 1 / tiedCount;
}

function calculateEquity(heroCards, villainCards, boardCards) {
  // Build remaining deck
  const usedKeys = new Set();
  for (const c of heroCards) usedKeys.add(c.toString());
  for (const vc of villainCards) for (const c of vc) usedKeys.add(c.toString());
  for (const c of boardCards) usedKeys.add(c.toString());

  const remaining = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const key = rank + suit;
      if (!usedKeys.has(key)) {
        remaining.push(new Card(rank, suit));
      }
    }
  }

  const needed = 5 - boardCards.length;

  if (needed === 0) {
    const equity = calcShare(heroCards, villainCards, boardCards);
    return { equity, method: 'exact', simulations: 1 };
  }

  if (needed <= 2) {
    // Exact enumeration
    const combos = combinations(remaining, needed);
    let totalShare = 0;
    for (const combo of combos) {
      const fullBoard = [...boardCards, ...combo];
      totalShare += calcShare(heroCards, villainCards, fullBoard);
    }
    const equity = combos.length > 0 ? totalShare / combos.length : 0;
    return { equity, method: 'exact', simulations: combos.length };
  }

  // Monte Carlo for preflop (needed >= 3)
  const ITERATIONS = 50000;
  let totalShare = 0;
  const remLen = remaining.length;

  for (let i = 0; i < ITERATIONS; i++) {
    // Partial Fisher-Yates to pick `needed` cards
    const deck = remaining.slice(); // shallow copy
    for (let j = 0; j < needed; j++) {
      const r = j + Math.floor(Math.random() * (remLen - j));
      const tmp = deck[j];
      deck[j] = deck[r];
      deck[r] = tmp;
    }
    const sample = deck.slice(0, needed);
    const fullBoard = [...boardCards, ...sample];
    totalShare += calcShare(heroCards, villainCards, fullBoard);
  }

  return {
    equity: totalShare / ITERATIONS,
    method: 'montecarlo',
    simulations: ITERATIONS
  };
}

// Async equity calculation — runs chunked MC in background so UI stays responsive.
// For non-preflop streets, exact enumeration is fast enough to just defer once.
function calculateEquityAsync(heroCards, villainCards, boardCards, onDone) {
  const needed = 5 - boardCards.length;

  if (needed <= 2) {
    // Exact enumeration is <10ms — just defer past current render frame
    setTimeout(() => onDone(calculateEquity(heroCards, villainCards, boardCards)), 0);
    return;
  }

  // Preflop: chunked Monte Carlo (yields between chunks so browser stays responsive)
  const TOTAL = 50000;
  const CHUNK = 1000;

  const usedKeys = new Set();
  for (const c of heroCards) usedKeys.add(c.toString());
  for (const vc of villainCards) for (const c of vc) usedKeys.add(c.toString());
  for (const c of boardCards) usedKeys.add(c.toString());

  const remaining = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      if (!usedKeys.has(rank + suit)) remaining.push(new Card(rank, suit));
    }
  }

  let totalShare = 0;
  let done = 0;

  function runChunk() {
    const end = Math.min(done + CHUNK, TOTAL);
    for (let i = done; i < end; i++) {
      for (let j = 0; j < needed; j++) {
        const r = j + Math.floor(Math.random() * (remaining.length - j));
        const tmp = remaining[j]; remaining[j] = remaining[r]; remaining[r] = tmp;
      }
      totalShare += calcShare(heroCards, villainCards, boardCards.concat(remaining.slice(0, needed)));
    }
    done = end;
    if (done < TOTAL) {
      setTimeout(runChunk, 0);
    } else {
      onDone({ equity: totalShare / TOTAL, method: 'montecarlo', simulations: TOTAL });
    }
  }

  setTimeout(runChunk, 0);
}
