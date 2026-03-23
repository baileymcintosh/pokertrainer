const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUITS = ['c','d','h','s'];
const RANK_VALUES = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14};
const SUIT_SYMBOLS = {'c':'♣','d':'♦','h':'♥','s':'♠'};
const SUIT_COLORS = {'c':'black','d':'red','h':'red','s':'black'};

class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
    this.value = RANK_VALUES[rank];
  }
  toString() { return this.rank + this.suit; }
  toDisplay() {
    return { rank: this.rank === 'T' ? '10' : this.rank, suit: SUIT_SYMBOLS[this.suit], color: SUIT_COLORS[this.suit] };
  }
}

class Deck {
  constructor() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(rank, suit));
      }
    }
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }
  deal(n) { return this.cards.splice(0, n); }
}
