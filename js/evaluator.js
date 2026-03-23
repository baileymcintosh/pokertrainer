// Hand evaluator for Texas Hold'em
// Hand ranks: 0=High Card, 1=Pair, 2=Two Pair, 3=Trips, 4=Straight,
//             5=Flush, 6=Full House, 7=Quads, 8=Straight Flush

function enc(rank, ...cards) {
  let s = rank * 1e10;
  const bases = [1e8, 1e6, 1e4, 1e2, 1];
  for (let i = 0; i < cards.length && i < 5; i++) {
    s += (cards[i] || 0) * bases[i];
  }
  return s;
}

function evaluateHand5(cards) {
  // Sort by value descending
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const vals = sorted.map(c => c.value);

  // Check flush
  const isFlush = sorted.every(c => c.suit === sorted[0].suit);

  // Check straight
  const uniqueVals = [...new Set(vals)];
  let isStraight = false;
  let straightHigh = 0;

  if (uniqueVals.length === 5) {
    if (vals[0] - vals[4] === 4) {
      isStraight = true;
      straightHigh = vals[0];
    } else if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
      // Wheel: A-2-3-4-5
      isStraight = true;
      straightHigh = 5;
    }
  }

  // Group by rank frequency
  const counts = {};
  for (const v of vals) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const groups = Object.entries(counts)
    .map(([v, cnt]) => ({ val: parseInt(v), cnt }))
    .sort((a, b) => b.cnt - a.cnt || b.val - a.val);

  const cnt0 = groups[0].cnt;
  const cnt1 = groups.length > 1 ? groups[1].cnt : 0;

  if (isStraight && isFlush) {
    return enc(8, straightHigh);
  }

  if (cnt0 === 4) {
    const quadRank = groups[0].val;
    const kickerRank = groups[1].val;
    return enc(7, quadRank, kickerRank);
  }

  if (cnt0 === 3 && cnt1 === 2) {
    const tripRank = groups[0].val;
    const pairRank = groups[1].val;
    return enc(6, tripRank, pairRank);
  }

  if (isFlush) {
    return enc(5, vals[0], vals[1], vals[2], vals[3], vals[4]);
  }

  if (isStraight) {
    return enc(4, straightHigh);
  }

  if (cnt0 === 3) {
    const tripRank = groups[0].val;
    const kickers = groups.slice(1).map(g => g.val).sort((a, b) => b - a);
    return enc(3, tripRank, kickers[0], kickers[1]);
  }

  if (cnt0 === 2 && cnt1 === 2) {
    const highPair = groups[0].val;
    const lowPair = groups[1].val;
    const kicker = groups[2].val;
    return enc(2, highPair, lowPair, kicker);
  }

  if (cnt0 === 2) {
    const pairRank = groups[0].val;
    const kickers = groups.slice(1).map(g => g.val).sort((a, b) => b - a);
    return enc(1, pairRank, kickers[0], kickers[1], kickers[2]);
  }

  // High card
  return enc(0, vals[0], vals[1], vals[2], vals[3], vals[4]);
}

function combinations(arr, k) {
  const result = [];
  function helper(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

function evaluateBest(cards) {
  if (cards.length < 5) return 0;
  if (cards.length === 5) return evaluateHand5(cards);
  const combos = combinations(cards, 5);
  let best = 0;
  for (const combo of combos) {
    const score = evaluateHand5(combo);
    if (score > best) best = score;
  }
  return best;
}

function getHandName(cards) {
  if (cards.length < 5) return '—';
  const score = evaluateBest(cards);
  const handRank = Math.floor(score / 1e10);
  const names = [
    'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
  ];
  return names[handRank] || 'High Card';
}
