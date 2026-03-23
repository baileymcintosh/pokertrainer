// Scenario generator — depends on cards.js

const VILLAIN_WEIGHTS = {
  1: [0.60, 0.25, 0.10, 0.05], // heads-up biased
  2: [0.30, 0.40, 0.22, 0.08], // leans 1-2
  3: [0.10, 0.30, 0.38, 0.22], // leans 2-3
  4: [0.03, 0.12, 0.30, 0.55], // full ring biased
};

const STREET_WEIGHTS = {
  1: [0.40, 0.45, 0.15], // early: preflop/flop heavy
  2: [0.15, 0.45, 0.40], // balanced
  3: [0.05, 0.25, 0.70], // late: turn heavy
};

function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function roundTo5(n) {
  return Math.round(n / 5) * 5;
}

function generateScenario(settings = {}) {
  const villainWeights = VILLAIN_WEIGHTS[settings.villainsLevel || 3];
  const streetWeights  = STREET_WEIGHTS[settings.streetLevel  || 2];

  const streets = ['preflop', 'flop', 'turn'];
  const street = weightedRandom(streets, streetWeights);

  const numVillains = weightedRandom([1, 2, 3, 4], villainWeights);

  const boardCount = { preflop: 0, flop: 3, turn: 4, river: 5 }[street];

  const deck = new Deck();
  deck.shuffle();

  const heroCards = deck.deal(2);
  const villainCards = [];
  for (let i = 0; i < numVillains; i++) {
    villainCards.push(deck.deal(2));
  }
  const boardCards = deck.deal(boardCount);

  const pot = Math.max(5, roundTo5(20 + Math.random() * 480));

  const betOptions = [
    pot * 0.25,
    pot * 0.33,
    pot * 0.50,
    pot * 0.67,
    pot * 1.0
  ];
  const betToCall = roundTo5(betOptions[Math.floor(Math.random() * betOptions.length)]);

  return { street, heroCards, villainCards, boardCards, pot, betToCall };
}

function calcRequiredEquity(pot, betToCall) {
  if (betToCall === 0) return null;
  return betToCall / (pot + betToCall);
}
