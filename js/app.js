// Main application logic — depends on all other JS files

let currentScenario = null;
let selectedDecision = null;
let currentEquityResult = null;
let calculatingEquity = false;
let equityCalcId = 0;
let sessionStats = {
  handsPlayed: 0,
  correctDecisions: 0,
  totalEquityError: 0
};

const settings = { villainsLevel: 3, streetLevel: 2, targetMargin: 10 };

// ── Mode ────────────────────────────────────────────────────────────────────
let activeMode = 'equity'; // 'equity' | 'draws'
let currentDrawScenario = null;
let drawsStats = { handsPlayed: 0, totalError: 0 };

function setMode(mode) {
  activeMode = mode;
  document.getElementById('tab-equity').classList.toggle('active', mode === 'equity');
  document.getElementById('tab-draws').classList.toggle('active', mode === 'draws');
  document.getElementById('home-screen').classList.toggle('draws-mode', mode === 'draws');
  const tagline = document.getElementById('home-tagline');
  const subtitle = document.getElementById('header-subtitle');
  const accuracyItem = document.getElementById('stat-accuracy-item');
  if (mode === 'draws') {
    tagline.textContent = 'Practice counting outs and estimating draw completion probabilities.';
    subtitle.textContent = 'Draw Probability Training';
    accuracyItem.style.display = 'none';
  } else {
    tagline.textContent = 'Sharpen your read on hand equity and pot odds through repetitive decision-making.';
    subtitle.textContent = 'Equity & Pot Odds Decision Making';
    accuracyItem.style.display = '';
  }
}

// ── Slider label text ──────────────────────────────────────────────────────

const VILLAIN_LABELS = {
  1: 'Mostly heads-up — 1 opponent',
  2: 'Leans small — usually 1–2 opponents',
  3: 'Leans multi-way — usually 2–3 opponents',
  4: 'Full ring — usually 3–4 opponents',
};
const STREET_LABELS = {
  1: 'Early streets — more preflop and flop',
  2: 'Balanced — mix of all streets',
  3: 'Late streets — more turn heavy',
};

function getDifficultyLabel(pct) {
  const p = Math.round(pct);
  if (p <= 2)  return p + '% target — coin flip, must be exact';
  if (p <= 7)  return p + '% target — very tight';
  if (p <= 14) return p + '% target — moderate';
  if (p <= 20) return p + '% target — comfortable';
  return p + '% target — clear edge';
}

function readSliderInt(id) {
  return Math.round(parseFloat(document.getElementById(id).value));
}

function updateSliderLabels() {
  document.getElementById('label-villains').textContent   = VILLAIN_LABELS[readSliderInt('slider-villains')];
  document.getElementById('label-street').textContent     = STREET_LABELS[readSliderInt('slider-street')];
  const marginPct = 25 - parseFloat(document.getElementById('slider-difficulty').value);
  document.getElementById('label-difficulty').textContent = getDifficultyLabel(marginPct);
}

// ── Screen switching ───────────────────────────────────────────────────────

function showHomeScreen() {
  document.getElementById('home-screen').style.display     = 'block';
  document.getElementById('training-screen').style.display = 'none';
  document.getElementById('draws-screen').style.display    = 'none';
  document.getElementById('btn-settings').style.display    = 'none';
}

function showTrainingScreen() {
  if (activeMode === 'draws') { showDrawsScreen(); return; }

  // Read and persist settings
  settings.villainsLevel = readSliderInt('slider-villains');
  settings.streetLevel   = readSliderInt('slider-street');
  settings.targetMargin  = 25 - Math.round(parseFloat(document.getElementById('slider-difficulty').value));
  try { localStorage.setItem('pokerTrainerSettings', JSON.stringify(settings)); } catch(e) {}

  document.getElementById('home-screen').style.display     = 'none';
  document.getElementById('training-screen').style.display = 'flex';
  document.getElementById('draws-screen').style.display    = 'none';
  document.getElementById('btn-settings').style.display    = 'block';
  loadNewScenario();
}

// ── Draws mode screen ───────────────────────────────────────────────────────

function showDrawsScreen() {
  settings.streetLevel = readSliderInt('slider-street');
  try { localStorage.setItem('pokerTrainerSettings', JSON.stringify(settings)); } catch(e) {}

  document.getElementById('home-screen').style.display     = 'none';
  document.getElementById('training-screen').style.display = 'none';
  document.getElementById('draws-screen').style.display    = 'flex';
  document.getElementById('btn-settings').style.display    = 'block';
  loadDrawScenario();
}

function loadDrawScenario() {
  currentDrawScenario = generateDrawScenario(settings.streetLevel);

  document.getElementById('draws-prob-input').value = '';
  document.getElementById('btn-draws-submit').disabled = true;
  document.getElementById('draws-results-panel').style.display = 'none';
  document.getElementById('draws-input-panel').style.display   = 'block';

  renderDrawScenario(currentDrawScenario);
  updateStats();
}

function renderDrawScenario(scenario) {
  if (!scenario) return;
  const { heroCards, boardCards, street, draw } = scenario;

  const badge = document.getElementById('draws-street-badge');
  badge.textContent = street.charAt(0).toUpperCase() + street.slice(1);
  badge.className = 'street-badge street-' + street;

  const boardEl = document.getElementById('draws-board-cards');
  boardEl.innerHTML = '';
  if (boardCards.length === 0) {
    boardEl.innerHTML = '<span class="no-board">Preflop — no community cards yet</span>';
  } else {
    for (const card of boardCards) boardEl.appendChild(renderCardEl(card));
  }

  const heroEl = document.getElementById('draws-hero-cards');
  heroEl.innerHTML = '';
  for (const card of heroCards) heroEl.appendChild(renderCardEl(card));

  document.getElementById('draws-type-badge').textContent = draw.description;
}

function handleDrawInput() {
  const val = document.getElementById('draws-prob-input').value.trim();
  document.getElementById('btn-draws-submit').disabled = (val === '' || isNaN(parseFloat(val)));
}

function handleDrawSubmit() {
  const input = document.getElementById('draws-prob-input').value.trim();
  if (input === '' || isNaN(parseFloat(input))) return;

  const userProb = parseFloat(input) / 100;
  const trueProb = currentDrawScenario.draw.probability;
  const error    = Math.abs(userProb - trueProb);

  drawsStats.handsPlayed++;
  drawsStats.totalError += error;

  document.getElementById('draws-input-panel').style.display   = 'none';
  document.getElementById('draws-results-panel').style.display = 'block';

  document.getElementById('draws-result-true').textContent = pct(trueProb);
  document.getElementById('draws-result-user').textContent = pct(userProb);

  const errEl = document.getElementById('draws-result-error');
  errEl.textContent = pct(error) + ' off';
  errEl.className   = 'result-error ' + errorClass(error);

  document.getElementById('draws-method-note').textContent = buildDrawExplanation(currentDrawScenario.draw);
  updateStats();
}

// ── Background scenario pool ───────────────────────────────────────────────
// Generates flop/turn hands with equity pre-calculated and stores them.
// Pool fills while user is on the home screen; hands are drawn from it during play.

const scenarioPool = [];
const POOL_MAX  = 800;
const HALF_WIN  = 0.075; // ±7.5 pp window around target margin

function poolStep() {
  if (scenarioPool.length < POOL_MAX) {
    // Uniform distributions — settings-based weighting applied at draw time
    const deck       = new Deck().shuffle();
    const street     = Math.random() < 0.5 ? 'flop' : 'turn';
    const numVillains = 1 + Math.floor(Math.random() * 4);

    const heroCards   = deck.deal(2);
    const villainCards = [];
    for (let i = 0; i < numVillains; i++) villainCards.push(deck.deal(2));
    const boardCards  = deck.deal(street === 'flop' ? 3 : 4);
    const pot         = (Math.floor(Math.random() * 96) + 4) * 5;
    const betMults    = [0.25, 0.33, 0.50, 0.67, 1.0];
    const betToCall   = Math.round(pot * betMults[Math.floor(Math.random() * betMults.length)] / 5) * 5;

    const equityResult = calculateEquity(heroCards, villainCards, boardCards);
    const gap = Math.abs(equityResult.equity - betToCall / (pot + betToCall));

    scenarioPool.push({
      scenario: { street, heroCards, villainCards, boardCards, pot, betToCall, _equityResult: equityResult },
      gap, street, numVillains
    });
  }
  setTimeout(poolStep, 0);
}

function drawFromPool() {
  const target = (settings.targetMargin || 10) / 100;
  const lo = Math.max(0,    target - HALF_WIN);
  const hi = Math.min(0.50, target + HALF_WIN);

  const vw = VILLAIN_WEIGHTS[settings.villainsLevel] || VILLAIN_WEIGHTS[3];
  const sw = STREET_WEIGHTS[settings.streetLevel]    || STREET_WEIGHTS[2];
  // sw = [preflopW, flopW, turnW]; pool only has flop/turn
  const flopW = sw[1], turnW = sw[2];

  // Build weighted candidate list
  const candidates = [];
  for (const entry of scenarioPool) {
    if (entry.gap < lo || entry.gap > hi) continue;
    const sW = entry.street === 'flop' ? flopW : turnW;
    const vW = vw[entry.numVillains - 1] || 0.01;
    candidates.push({ entry, w: sW * vW });
  }
  if (candidates.length === 0) return null;

  // Weighted random pick
  const total = candidates.reduce((s, c) => s + c.w, 0);
  let r = Math.random() * total;
  let chosen = candidates[candidates.length - 1].entry;
  for (const c of candidates) { r -= c.w; if (r <= 0) { chosen = c.entry; break; } }

  scenarioPool.splice(scenarioPool.indexOf(chosen), 1);
  return chosen.scenario;
}

function generateFilteredScenario() {
  // Decide street upfront using current street weights
  const sw      = STREET_WEIGHTS[settings.streetLevel] || STREET_WEIGHTS[2];
  const street  = weightedRandom(['preflop', 'flop', 'turn'], sw);

  if (street === 'preflop') {
    // Preflop: generate cards now, equity computed async after render
    const deck = new Deck().shuffle();
    const numVillains = weightedRandom([1, 2, 3, 4], VILLAIN_WEIGHTS[settings.villainsLevel] || VILLAIN_WEIGHTS[3]);
    const heroCards   = deck.deal(2);
    const villainCards = [];
    for (let i = 0; i < numVillains; i++) villainCards.push(deck.deal(2));
    const pot       = (Math.floor(Math.random() * 96) + 4) * 5;
    const betMults  = [0.25, 0.33, 0.50, 0.67, 1.0];
    const betToCall = Math.round(pot * betMults[Math.floor(Math.random() * betMults.length)] / 5) * 5;
    return { street: 'preflop', heroCards, villainCards, boardCards: [], pot, betToCall };
  }

  // Flop/turn: pull from pool
  const fromPool = drawFromPool();
  if (fromPool) return fromPool;

  // Pool miss (rare) — generate synchronously
  const target = (settings.targetMargin || 10) / 100;
  const lo = Math.max(0, target - HALF_WIN);
  const hi = Math.min(0.50, target + HALF_WIN);
  for (let i = 0; i < 40; i++) {
    const deck        = new Deck().shuffle();
    const numVillains = weightedRandom([1, 2, 3, 4], VILLAIN_WEIGHTS[settings.villainsLevel] || VILLAIN_WEIGHTS[3]);
    const heroCards   = deck.deal(2);
    const villainCards = [];
    for (let j = 0; j < numVillains; j++) villainCards.push(deck.deal(2));
    const boardCards  = deck.deal(street === 'flop' ? 3 : 4);
    const pot         = (Math.floor(Math.random() * 96) + 4) * 5;
    const betMults    = [0.25, 0.33, 0.50, 0.67, 1.0];
    const betToCall   = Math.round(pot * betMults[Math.floor(Math.random() * betMults.length)] / 5) * 5;
    const er          = calculateEquity(heroCards, villainCards, boardCards);
    const gap         = Math.abs(er.equity - betToCall / (pot + betToCall));
    if (gap >= lo && gap <= hi) {
      return { street, heroCards, villainCards, boardCards, pot, betToCall, _equityResult: er };
    }
  }
  // Final fallback — return unfiltered
  const deck        = new Deck().shuffle();
  const numVillains = weightedRandom([1, 2, 3, 4], VILLAIN_WEIGHTS[settings.villainsLevel] || VILLAIN_WEIGHTS[3]);
  const heroCards   = deck.deal(2);
  const villainCards = [];
  for (let i = 0; i < numVillains; i++) villainCards.push(deck.deal(2));
  const boardCards  = deck.deal(street === 'flop' ? 3 : 4);
  const pot         = (Math.floor(Math.random() * 96) + 4) * 5;
  const betMults    = [0.25, 0.33, 0.50, 0.67, 1.0];
  const betToCall   = Math.round(pot * betMults[Math.floor(Math.random() * betMults.length)] / 5) * 5;
  const er          = calculateEquity(heroCards, villainCards, boardCards);
  return { street, heroCards, villainCards, boardCards, pot, betToCall, _equityResult: er };
}

// ── Init ───────────────────────────────────────────────────────────────────

function init() {
  // Restore saved settings
  try {
    const saved = JSON.parse(localStorage.getItem('pokerTrainerSettings') || '{}');
    if (saved.villainsLevel != null) { settings.villainsLevel = saved.villainsLevel; document.getElementById('slider-villains').value  = String(saved.villainsLevel); }
    if (saved.streetLevel    != null) { settings.streetLevel   = saved.streetLevel;   document.getElementById('slider-street').value    = String(saved.streetLevel); }
    if (saved.targetMargin   != null) { settings.targetMargin  = saved.targetMargin;  document.getElementById('slider-difficulty').value = String(25 - saved.targetMargin); }
  } catch(e) {}

  updateSliderLabels();

  // Slider live labels
  document.getElementById('slider-villains').addEventListener('input', updateSliderLabels);
  document.getElementById('slider-street').addEventListener('input', updateSliderLabels);
  document.getElementById('slider-difficulty').addEventListener('input', updateSliderLabels);

  // Mode tabs
  document.getElementById('tab-equity').addEventListener('click', () => setMode('equity'));
  document.getElementById('tab-draws').addEventListener('click',  () => setMode('draws'));

  // Home screen
  document.getElementById('btn-start').addEventListener('click', showTrainingScreen);
  document.getElementById('btn-settings').addEventListener('click', showHomeScreen);

  // Equity training screen
  document.getElementById('btn-fold').addEventListener('click', handleDecisionSelect);
  document.getElementById('btn-call').addEventListener('click', handleDecisionSelect);
  document.getElementById('btn-raise').addEventListener('click', handleDecisionSelect);
  document.getElementById('btn-submit').addEventListener('click', handleSubmit);
  document.getElementById('btn-next').addEventListener('click', loadNewScenario);

  // Draws training screen
  document.getElementById('draws-prob-input').addEventListener('input', handleDrawInput);
  document.getElementById('btn-draws-submit').addEventListener('click', handleDrawSubmit);
  document.getElementById('btn-draws-next').addEventListener('click', loadDrawScenario);

  showHomeScreen();
  setTimeout(poolStep, 100); // start background pool generation
}

function loadNewScenario() {
  currentScenario = generateFilteredScenario();
  currentEquityResult = currentScenario._equityResult || null;
  calculatingEquity = !currentEquityResult;
  selectedDecision = null;

  document.getElementById('equity-input').value = '';
  document.getElementById('pot-odds-input').value = '';
  document.querySelectorAll('.decision-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-submit').disabled = true;
  document.getElementById('results-panel').style.display = 'none';
  document.getElementById('input-panel').style.display = 'block';

  renderScenario(currentScenario);
  updateStats();

  const calcStatus = document.getElementById('calc-status');
  if (calculatingEquity) {
    if (calcStatus) calcStatus.style.display = 'block';
    equityCalcId++;
    const myId = equityCalcId;
    calculateEquityAsync(
      currentScenario.heroCards,
      currentScenario.villainCards,
      currentScenario.boardCards,
      (result) => {
        if (equityCalcId !== myId) return; // stale — user moved to next hand
        currentEquityResult = result;
        calculatingEquity = false;
        if (calcStatus) calcStatus.style.display = 'none';
        if (selectedDecision) document.getElementById('btn-submit').disabled = false;
      }
    );
  } else {
    if (calcStatus) calcStatus.style.display = 'none';
  }
}

function renderScenario(scenario) {
  // Street badge
  const streetBadge = document.getElementById('street-badge');
  streetBadge.textContent = scenario.street.charAt(0).toUpperCase() + scenario.street.slice(1);
  streetBadge.className = 'street-badge street-' + scenario.street;

  // Pot and bet info
  document.getElementById('pot-display').textContent = '$' + scenario.pot;

  const betDisplay = document.getElementById('bet-display-container');
  betDisplay.innerHTML = '<span class="bet-label">Bet to Call:</span> <span class="bet-value">$' + scenario.betToCall + '</span>';

  // Board cards
  const boardArea = document.getElementById('board-cards');
  boardArea.innerHTML = '';
  if (scenario.boardCards.length === 0) {
    boardArea.innerHTML = '<span class="no-board">Preflop — no community cards yet</span>';
  } else {
    for (const card of scenario.boardCards) {
      boardArea.appendChild(renderCardEl(card));
    }
  }

  // Hero cards
  const heroCardsEl = document.getElementById('hero-cards');
  heroCardsEl.innerHTML = '';
  for (const card of scenario.heroCards) {
    heroCardsEl.appendChild(renderCardEl(card));
  }

  // Hero hand name (just hole cards context — show "—" preflop since no board)
  const heroHandNameEl = document.getElementById('hero-hand-name');
  if (scenario.boardCards.length === 0) {
    heroHandNameEl.textContent = '';
  } else {
    const allHeroCards = [...scenario.heroCards, ...scenario.boardCards];
    heroHandNameEl.textContent = getHandName(allHeroCards);
  }

  // Villain hands
  const villainsArea = document.getElementById('villains-area');
  villainsArea.innerHTML = '<h3>Opponent Hand' + (scenario.villainCards.length > 1 ? 's' : '') + '</h3>';

  scenario.villainCards.forEach((vc, idx) => {
    const villainDiv = document.createElement('div');
    villainDiv.className = 'villain-hand';
    if (scenario.villainCards.length > 1) {
      const label = document.createElement('div');
      label.className = 'villain-label';
      label.textContent = 'Villain ' + (idx + 1);
      villainDiv.appendChild(label);
    }
    const cardsRow = document.createElement('div');
    cardsRow.className = 'cards-row';
    for (const card of vc) {
      cardsRow.appendChild(renderCardEl(card));
    }
    villainDiv.appendChild(cardsRow);
    villainsArea.appendChild(villainDiv);
  });
}

function handleDecisionSelect(e) {
  document.querySelectorAll('.decision-btn').forEach(b => b.classList.remove('selected'));
  e.currentTarget.classList.add('selected');
  selectedDecision = e.currentTarget.dataset.decision;
  // Only enable submit once equity is ready (preflop MC may still be running)
  document.getElementById('btn-submit').disabled = calculatingEquity;
}

function handleSubmit() {
  const equityInput = document.getElementById('equity-input').value.trim();
  const potOddsInput = document.getElementById('pot-odds-input').value.trim();
  const scenario = currentScenario;

  if (equityInput === '' || isNaN(parseFloat(equityInput))) {
    showInputError('equity-input', 'Please enter your equity estimate.');
    return;
  }
  if (potOddsInput === '' || isNaN(parseFloat(potOddsInput))) {
    showInputError('pot-odds-input', 'Please enter your pot odds estimate.');
    return;
  }

  clearInputErrors();

  const userEquity   = parseFloat(equityInput)   / 100;
  const userPotOdds  = parseFloat(potOddsInput)  / 100;

  // Equity is pre-calculated in background; fall back to sync only if somehow not ready
  const equityCalc   = currentEquityResult || calculateEquity(scenario.heroCards, scenario.villainCards, scenario.boardCards);
  const trueEquity   = equityCalc.equity;
  const requiredEquity = calcRequiredEquity(scenario.pot, scenario.betToCall);

  const correctDecision = trueEquity > requiredEquity ? 'call' : 'fold';
  const userIsCorrect   = correctDecision === 'fold'
    ? selectedDecision === 'fold'
    : (selectedDecision === 'call' || selectedDecision === 'raise');

  const equityError = Math.abs(userEquity - trueEquity);
  sessionStats.handsPlayed++;
  sessionStats.totalEquityError += equityError;
  if (userIsCorrect) sessionStats.correctDecisions++;

  showResults({ trueEquity, userEquity, equityError, requiredEquity, userPotOdds,
                correctDecision, userIsCorrect, scenario,
                method: equityCalc.method, simulations: equityCalc.simulations });
  updateStats();
}

function showInputError(inputId, message) {
  const input = document.getElementById(inputId);
  input.classList.add('input-error');
  const existing = input.parentElement.querySelector('.error-msg');
  if (!existing) {
    const errEl = document.createElement('div');
    errEl.className = 'error-msg';
    errEl.textContent = message;
    input.parentElement.appendChild(errEl);
  }
}

function clearInputErrors() {
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.error-msg').forEach(el => el.remove());
}

function showResults(data) {
  const {
    trueEquity, userEquity, equityError,
    requiredEquity, userPotOdds,
    correctDecision, userIsCorrect,
    scenario
  } = data;

  document.getElementById('input-panel').style.display = 'none';
  const resultsPanel = document.getElementById('results-panel');
  resultsPanel.style.display = 'block';

  // Equity comparison
  document.getElementById('result-true-equity').textContent = pct(trueEquity);
  document.getElementById('result-user-equity').textContent = pct(userEquity);
  const equityErrorEl = document.getElementById('result-equity-error');
  equityErrorEl.textContent = pct(equityError) + ' off';
  equityErrorEl.className = 'result-error ' + errorClass(equityError);

  // Pot odds comparison (always present — no check situations)
  document.getElementById('result-required-equity').textContent = pct(requiredEquity);
  document.getElementById('result-user-pot-odds').textContent = pct(userPotOdds);
  const potOddsError = Math.abs(userPotOdds - requiredEquity);
  const potOddsErrorEl = document.getElementById('result-pot-odds-error');
  potOddsErrorEl.textContent = pct(potOddsError) + ' off';
  potOddsErrorEl.className = 'result-error ' + errorClass(potOddsError);

  // Decision result
  const decisionResultEl = document.getElementById('decision-result');
  const decisionIcon = document.getElementById('decision-icon');
  const decisionMessage = document.getElementById('decision-message');

  if (userIsCorrect) {
    decisionResultEl.className = 'decision-result correct';
    decisionIcon.textContent = '✓';
    decisionMessage.textContent = 'Correct! ' + getDecisionExplanation(correctDecision, trueEquity, requiredEquity);
  } else {
    decisionResultEl.className = 'decision-result incorrect';
    decisionIcon.textContent = '✗';
    decisionMessage.textContent = 'Incorrect. ' + getDecisionExplanation(correctDecision, trueEquity, requiredEquity);
  }

  // Hand breakdown
  const heroHandResult = document.getElementById('hero-hand-result');
  if (scenario.boardCards.length > 0) {
    const allHeroCards = [...scenario.heroCards, ...scenario.boardCards];
    heroHandResult.textContent = getHandName(allHeroCards);
  } else {
    heroHandResult.textContent = 'Hole cards only';
  }

  const villainHandResults = document.getElementById('villain-hand-results');
  villainHandResults.innerHTML = '';
  scenario.villainCards.forEach((vc, idx) => {
    const div = document.createElement('div');
    div.className = 'hand-breakdown-row';
    const label = scenario.villainCards.length > 1 ? 'Villain ' + (idx + 1) : 'Villain';
    let handName;
    if (scenario.boardCards.length > 0) {
      handName = getHandName([...vc, ...scenario.boardCards]);
    } else {
      handName = 'Hole cards only';
    }
    div.innerHTML = '<span class="breakdown-label">' + label + ':</span> <span class="breakdown-hand">' + handName + '</span>';
    villainHandResults.appendChild(div);
  });

  // Method note
  const methodNote = document.getElementById('method-note');
  if (data.method === 'montecarlo') {
    methodNote.textContent = 'Equity calculated via Monte Carlo (' + data.simulations.toLocaleString() + ' simulations)';
  } else {
    methodNote.textContent = 'Equity calculated via exact enumeration (' + data.simulations.toLocaleString() + ' combination' + (data.simulations !== 1 ? 's' : '') + ')';
  }
}

function getDecisionExplanation(correctDecision, trueEquity, requiredEquity) {
  if (correctDecision === 'fold') {
    return 'Your equity (' + pct(trueEquity) + ') is below the required ' + pct(requiredEquity) + ' to call profitably. Fold.';
  }
  return 'Your equity (' + pct(trueEquity) + ') exceeds the ' + pct(requiredEquity) + ' required. Call or raise.';
}

function errorClass(err) {
  if (err <= 0.03) return 'error-good';
  if (err <= 0.08) return 'error-close';
  return 'error-bad';
}

function pct(val) {
  return (val * 100).toFixed(1) + '%';
}

function renderCardEl(card) {
  const display = card.toDisplay();
  const el = document.createElement('div');
  el.className = 'card ' + display.color;
  el.innerHTML =
    '<div class="card-rank">' + display.rank + '</div>' +
    '<div class="card-suit">' + display.suit + '</div>';
  return el;
}

function updateStats() {
  if (activeMode === 'draws') {
    document.getElementById('stat-hands').textContent = drawsStats.handsPlayed;
    document.getElementById('stat-avg-error').textContent = drawsStats.handsPlayed > 0
      ? (drawsStats.totalError / drawsStats.handsPlayed * 100).toFixed(1) + '%' : '—';
  } else {
    document.getElementById('stat-hands').textContent = sessionStats.handsPlayed;
    const accuracy = sessionStats.handsPlayed > 0
      ? Math.round((sessionStats.correctDecisions / sessionStats.handsPlayed) * 100) + '%' : '—';
    document.getElementById('stat-accuracy').textContent = accuracy;
    document.getElementById('stat-avg-error').textContent = sessionStats.handsPlayed > 0
      ? (sessionStats.totalEquityError / sessionStats.handsPlayed * 100).toFixed(1) + '%' : '—';
  }
}

document.addEventListener('DOMContentLoaded', init);
