import {
  FaShoppingBag,
  FaCoffee,
  FaUtensils,
  FaConciergeBell,
  FaWallet,
  FaFire,
  FaWineGlassAlt,
  FaBullhorn,
  FaCrown,
  FaStar,
} from 'react-icons/fa';

// Ranking is driven purely by lifetime contribution count (number of expense
// posts), not by amount spent. Ranges are inclusive on both ends.
export const RANK_TIERS = [
  {
    name: 'Window Shopper',
    min: 0,
    max: 15,
    color: '#71717a', // zinc
    icon: FaShoppingBag,
    tagline: 'Every foodie journey starts somewhere',
  },
  {
    name: 'Coffee Casual',
    min: 16,
    max: 40,
    color: '#0ea5e9', // sky
    icon: FaCoffee,
    tagline: 'Building the habit, one receipt at a time',
  },
  {
    name: 'Brunch Enthusiast',
    min: 41,
    max: 75,
    color: '#06b6d4', // cyan
    icon: FaUtensils,
    tagline: 'Weekend warrior with a taste for good eats',
  },
  {
    name: 'Frequent Diner',
    min: 76,
    max: 120,
    color: '#10b981', // emerald
    icon: FaConciergeBell,
    tagline: "A familiar face at all your favorite spots",
  },
  {
    name: 'Big Spender',
    min: 121,
    max: 180,
    color: '#8b5cf6', // violet
    icon: FaWallet,
    tagline: 'Living good, and your wallet shows it',
  },
  {
    name: 'Taste Maker',
    min: 181,
    max: 260,
    color: '#6366f1', // indigo
    icon: FaFire,
    tagline: 'Setting trends other diners follow',
  },
  {
    name: 'Connoisseur',
    min: 261,
    max: 340,
    color: '#d946ef', // fuchsia
    icon: FaWineGlassAlt,
    tagline: 'A refined palate that misses nothing',
  },
  {
    name: 'Foodie Influencer',
    min: 341,
    max: 420,
    color: '#f97316', // orange
    icon: FaBullhorn,
    tagline: 'Your recommendations carry real weight',
  },
  {
    name: 'Chief Gastronomist',
    min: 421,
    max: 500,
    color: '#f43f5e', // rose
    icon: FaCrown,
    tagline: 'Elite status, mastery of the culinary world',
  },
  {
    name: 'The Michelin Star',
    min: 501,
    max: Infinity,
    color: '#f59e0b', // amber/gold
    icon: FaStar,
    tagline: 'Legendary. The pinnacle of food devotion',
  },
];

export function getRank(count = 0) {
  const n = Math.max(0, count || 0);
  return RANK_TIERS.find((tier) => n >= tier.min && n <= tier.max) || RANK_TIERS[0];
}

export function getNextRank(count = 0) {
  const current = getRank(count);
  const idx = RANK_TIERS.indexOf(current);
  return RANK_TIERS[idx + 1] || null;
}

// Useful for "X contributions away from Y" style nudges.
export function getRankProgress(count = 0) {
  const n = Math.max(0, count || 0);
  const current = getRank(n);
  const next = getNextRank(n);
  if (!next) return { current, next: null, percent: 100, remaining: 0 };
  const span = next.min - current.min;
  const progressed = n - current.min;
  const percent = Math.min(100, Math.max(0, Math.round((progressed / span) * 100)));
  return { current, next, percent, remaining: next.min - n };
}