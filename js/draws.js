// draws.js — Draw detection and probability for Draw Probability training mode
// Depends on cards.js (RANK_VALUES, SUITS, RANKS, Deck) and scenarios.js (STREET_WEIGHTS, weightedRandom)

// RANK_VALUES is already defined in cards.js
const RANK_NAMES = {1:'A',2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A'};
const SUIT_NAMES = {s:'Spades',h:'Hearts',d:'Diamonds',c:'Clubs'};

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

// Post-flop: exact probability of completing a draw
function postFlopDrawProb(outs, remaining, cardsToBoard) {
  if (cardsToBoard === 1) return outs / remaining;
  const miss = remaining - outs;
  return 1 - (miss / remaining) * ((miss - 1) / (remaining - 1));
}

// Preflop suited: P(flush by river) — need 3+ of 11 remaining suited in 5 board cards from 50-card deck
function preflopFlushProb() {
  const N = 50, K = 11, n = 5;
  let p = 0;
  for (let k = 3; k <= 5; k++) p += comb(K, k) * comb(N - K, n - k) / comb(N, n);
  return p;
}

// Preflop pocket pair: P(set or better by river) — 1+ of 2 remaining rank cards in 5 board from 50
function preflopSetProb() {
  return 1 - comb(48, 5) / comb(50, 5);
}

// Detect primary draw for a post-flop board. Returns { type, description, outs } or null.
function detectPostFlopDraw(heroCards, boardCards) {
  const all = [...heroCards, ...boardCards];

  // 1. Flush draw: exactly 4 of one suit, hero contributes at least one
  const sc = {};
  for (const c of all) sc[c.suit] = (sc[c.suit] || 0) + 1;
  for (const [suit, count] of Object.entries(sc)) {
    if (count === 4 && heroCards.some(c => c.suit === suit)) {
      return { type: 'flush', description: `Flush draw (4 ${SUIT_NAMES[suit] || suit})`, outs: 9 };
    }
  }

  // 2. Straight draws
  const allRanks  = all.map(c => RANK_VALUES[c.rank]);
  const heroRanks = heroCards.map(c => RANK_VALUES[c.rank]);
  const unique    = [...new Set(allRanks)];
  if (unique.includes(14)) unique.push(1); // ace-low support

  function heroInWindow(w) {
    return heroRanks.some(r => {
      const vs = r === 14 ? [14, 1] : [r];
      return vs.some(v => w.includes(v));
    });
  }

  // OESD: 4 consecutive ranks, both ends open (8 outs)
  for (let lo = 2; lo <= 9; lo++) {
    const w = [lo, lo+1, lo+2, lo+3];
    if (w.every(r => unique.includes(r)) && heroInWindow(w) && lo-1 >= 1 && lo+4 <= 14) {
      return { type: 'oesd', description: 'Open-ended straight draw', outs: 8 };
    }
  }

  // Gutshot: 4 of 5 consecutive ranks with one gap (4 outs)
  for (let lo = 1; lo <= 10; lo++) {
    const w       = [lo, lo+1, lo+2, lo+3, lo+4];
    const present = w.filter(r => unique.includes(r));
    const missing = w.filter(r => !unique.includes(r));
    if (present.length === 4 && missing.length === 1 && heroInWindow(present)) {
      return {
        type: 'gutshot',
        description: `Gutshot straight draw (needs ${RANK_NAMES[missing[0]]})`,
        outs: 4
      };
    }
  }

  return null;
}

// Detect a preflop draw from hole cards only.
function detectPreflopDraw(heroCards) {
  const [c1, c2] = heroCards;
  if (c1.rank === c2.rank) {
    return {
      type: 'set_preflop',
      description: 'Pocket pair — hit a set or better by river',
      probability: preflopSetProb(),
      cardsToBoard: 5,
      explanation: '2 cards of your rank remain. Need 1+ to appear in the 5-card board.\nRule of thumb: ~19%'
    };
  }
  if (c1.suit === c2.suit) {
    return {
      type: 'flush_preflop',
      description: 'Suited hand — make a flush by river',
      probability: preflopFlushProb(),
      cardsToBoard: 5,
      explanation: '11 suited cards remain. Need 3+ to appear in the 5-card board.\nRule of thumb: ~6.4%'
    };
  }
  return null;
}

// Build explanation text shown after submitting an answer.
function buildDrawExplanation(draw) {
  if (draw.type === 'flush_preflop' || draw.type === 'set_preflop') {
    return draw.explanation + '\nExact: ' + (draw.probability * 100).toFixed(1) + '%';
  }
  const ruleN   = draw.cardsToBoard === 1 ? 2 : 4;
  const ruleEst = draw.outs * ruleN;
  return `${draw.outs} outs × ${ruleN} = ~${ruleEst}% (rule of ${ruleN})\nExact: ${(draw.probability * 100).toFixed(1)}%  |  ${draw.remaining} cards remain, ${draw.cardsToBoard} to come`;
}

// Generate a scenario that has an interesting draw.
function generateDrawScenario(streetLevel) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const sw     = STREET_WEIGHTS[streetLevel || 2];
    const street = weightedRandom(['preflop', 'flop', 'turn'], sw);
    const deck   = new Deck();
    deck.shuffle();
    const heroCards = deck.deal(2);

    if (street === 'preflop') {
      const draw = detectPreflopDraw(heroCards);
      if (!draw) continue;
      return { heroCards, boardCards: [], street, draw };
    }

    const boardCount = street === 'flop' ? 3 : 4;
    const boardCards = deck.deal(boardCount);
    const draw       = detectPostFlopDraw(heroCards, boardCards);
    if (!draw) continue;

    const remaining    = 52 - 2 - boardCount;
    const cardsToBoard = 5 - boardCount;
    draw.probability   = postFlopDrawProb(draw.outs, remaining, cardsToBoard);
    draw.cardsToBoard  = cardsToBoard;
    draw.remaining     = remaining;
    return { heroCards, boardCards, street, draw };
  }
  return null; // should almost never happen
}
