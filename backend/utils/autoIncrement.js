/**
 * Auto Increment Slab Calculation Engine
 * 
 * Provides percentage-of-team-purse slab validation, selection,
 * rupee increment calculation (rounded upward to nearest integer rupee),
 * and preview generation for CricLeagueManager.
 */

const DEFAULT_AUTO_INCREMENT_SLABS = Object.freeze([
  { fromPercentage: 0, toPercentage: 10, incrementPercentage: 1 },
  { fromPercentage: 10, toPercentage: 25, incrementPercentage: 1.5 },
  { fromPercentage: 25, toPercentage: 50, incrementPercentage: 2 },
  { fromPercentage: 50, toPercentage: 75, incrementPercentage: 3 },
  { fromPercentage: 75, toPercentage: 100, incrementPercentage: 4 }
]);

/**
 * Validates a list of percentage-based auto-increment slabs.
 * 
 * Requirements:
 * - Non-empty array of slabs
 * - fromPercentage, toPercentage, incrementPercentage must be positive finite numbers
 * - fromPercentage must be >= 0
 * - toPercentage must be > fromPercentage
 * - incrementPercentage must be > 0
 * - Slabs must start at 0%
 * - Slabs must be continuous without gaps or overlapping ranges
 * - Slabs must cover up to at least 100% of Team Purse
 * 
 * @param {Array} slabs
 * @returns {{ isValid: boolean, message?: string, slabs?: Array }}
 */
function validateAutoIncrementSlabs(slabs) {
  if (!Array.isArray(slabs) || slabs.length === 0) {
    return { isValid: false, message: 'Auto-increment slabs must be a non-empty list.' };
  }

  const cleaned = [];

  for (let i = 0; i < slabs.length; i++) {
    const raw = slabs[i];
    if (!raw || typeof raw !== 'object') {
      return { isValid: false, message: `Slab ${i + 1} is invalid.` };
    }

    const fromPercentage = Number(raw.fromPercentage);
    const toPercentage = Number(raw.toPercentage);
    const incrementPercentage = Number(raw.incrementPercentage);

    if (!Number.isFinite(fromPercentage) || fromPercentage < 0) {
      return { isValid: false, message: `Slab ${i + 1} 'From %' must be a valid non-negative number.` };
    }
    if (!Number.isFinite(toPercentage) || toPercentage <= fromPercentage) {
      return { isValid: false, message: `Slab ${i + 1} 'To %' must be greater than 'From %' (${fromPercentage}%).` };
    }
    if (!Number.isFinite(incrementPercentage) || incrementPercentage <= 0) {
      return { isValid: false, message: `Slab ${i + 1} 'Increment %' must be greater than 0%.` };
    }

    cleaned.push({
      fromPercentage: Number(fromPercentage.toFixed(2)),
      toPercentage: Number(toPercentage.toFixed(2)),
      incrementPercentage: Number(incrementPercentage.toFixed(2))
    });
  }

  // Check start boundary
  if (Math.abs(cleaned[0].fromPercentage) > 0.0001) {
    return { isValid: false, message: `First slab must start at 0% (currently starts at ${cleaned[0].fromPercentage}%).` };
  }

  // Check continuity, gaps, and overlaps
  for (let i = 1; i < cleaned.length; i++) {
    const prevTo = cleaned[i - 1].toPercentage;
    const currFrom = cleaned[i].fromPercentage;

    if (Math.abs(currFrom - prevTo) > 0.0001) {
      if (currFrom < prevTo) {
        return {
          isValid: false,
          message: `Overlapping slab range: Slab ${i + 1} starts at ${currFrom}% before Slab ${i} ends at ${prevTo}%.`
        };
      }
      return {
        isValid: false,
        message: `Gap in slab range: Slab ${i + 1} starts at ${currFrom}% leaving a gap after Slab ${i} ends at ${prevTo}%.`
      };
    }
  }

  // Check end boundary (must reach at least 100%)
  const lastTo = cleaned[cleaned.length - 1].toPercentage;
  if (lastTo < 100) {
    return {
      isValid: false,
      message: `Slabs must cover up to at least 100% of Team Purse (currently ends at ${lastTo}%).`
    };
  }

  return { isValid: true, slabs: cleaned };
}

/**
 * Returns the effective auto-increment slabs for a tournament.
 * Falls back safely to DEFAULT_AUTO_INCREMENT_SLABS if tournament has no configured slabs.
 * 
 * @param {Object} tournament
 * @returns {Array}
 */
function getEffectiveAutoIncrementSlabs(tournament) {
  if (tournament?.autoIncrementSlabs && Array.isArray(tournament.autoIncrementSlabs) && tournament.autoIncrementSlabs.length > 0) {
    const validation = validateAutoIncrementSlabs(tournament.autoIncrementSlabs);
    if (validation.isValid && validation.slabs) {
      return validation.slabs;
    }
  }
  return DEFAULT_AUTO_INCREMENT_SLABS.map(s => ({ ...s }));
}

/**
 * Calculates the applicable auto-increment slab and rupee increment
 * for a given currentBid and teamPurse.
 * 
 * - Determines applicable slab based on current bid as a percentage of Team Purse
 * - Applies configured percentage to Team Purse
 * - Rounds calculated rupee increment upward to nearest integer rupee
 * 
 * @param {Object} params
 * @param {number} params.currentBid - Current bid amount in rupees
 * @param {number} params.teamPurse - Team Purse (teamBudget) in rupees
 * @param {Array} [params.slabs] - Configured slabs (optional, falls back to defaults)
 * @returns {{ teamPurse: number, currentBid: number, bidPercent: number, applicableSlab: Object, slabIndex: number, incrementPercentage: number, rupeeIncrement: number, nextBid: number }}
 */
function calculateAutoIncrement({ currentBid, teamPurse, slabs }) {
  const purse = Number(teamPurse);
  if (!Number.isFinite(purse) || purse <= 0) {
    const error = new Error('INVALID_TEAM_PURSE');
    error.publicMessage = 'Team Purse must be a positive valid amount.';
    error.statusCode = 400;
    throw error;
  }

  const bid = Math.max(0, Number(currentBid || 0));
  if (!Number.isFinite(bid)) {
    const error = new Error('INVALID_CURRENT_BID');
    error.publicMessage = 'Current bid must be a valid number.';
    error.statusCode = 400;
    throw error;
  }

  const effectiveSlabs = (Array.isArray(slabs) && slabs.length > 0)
    ? slabs
    : DEFAULT_AUTO_INCREMENT_SLABS;

  const bidPercent = (bid / purse) * 100;

  let matchedSlab = null;
  let matchedIndex = -1;

  for (let i = 0; i < effectiveSlabs.length; i++) {
    const slab = effectiveSlabs[i];
    const isFirst = (i === 0);
    const isLast = (i === effectiveSlabs.length - 1);

    if (isFirst && bidPercent <= slab.toPercentage) {
      matchedSlab = slab;
      matchedIndex = i;
      break;
    } else if (!isFirst && !isLast && bidPercent > slab.fromPercentage && bidPercent <= slab.toPercentage) {
      matchedSlab = slab;
      matchedIndex = i;
      break;
    } else if (isLast && bidPercent > slab.fromPercentage) {
      matchedSlab = slab;
      matchedIndex = i;
      break;
    }
  }

  if (!matchedSlab) {
    if (bidPercent <= 0) {
      matchedSlab = effectiveSlabs[0];
      matchedIndex = 0;
    } else {
      matchedSlab = effectiveSlabs[effectiveSlabs.length - 1];
      matchedIndex = effectiveSlabs.length - 1;
    }
  }

  const incrementPercent = Number(matchedSlab.incrementPercentage);
  const rawIncrement = (purse * incrementPercent) / 100;
  const rupeeIncrement = Math.max(1, Math.ceil(rawIncrement));
  const nextBid = bid + rupeeIncrement;

  return {
    teamPurse: purse,
    currentBid: bid,
    bidPercent: Number(bidPercent.toFixed(4)),
    applicableSlab: {
      fromPercentage: matchedSlab.fromPercentage,
      toPercentage: matchedSlab.toPercentage,
      incrementPercentage: matchedSlab.incrementPercentage
    },
    slabIndex: matchedIndex,
    incrementPercentage: incrementPercent,
    rupeeIncrement,
    nextBid
  };
}

/**
 * Calculates preview ranges and rupee increments for a given Team Purse.
 * 
 * @param {Object} params
 * @param {number} params.teamPurse
 * @param {Array} [params.slabs]
 * @returns {Array}
 */
function calculateSlabPreviews({ teamPurse, slabs }) {
  const purse = Number(teamPurse);
  if (!Number.isFinite(purse) || purse <= 0) {
    return [];
  }

  const effectiveSlabs = (Array.isArray(slabs) && slabs.length > 0)
    ? slabs
    : DEFAULT_AUTO_INCREMENT_SLABS;

  return effectiveSlabs.map((slab, index) => {
    const fromRupees = Math.round((purse * slab.fromPercentage) / 100);
    const toRupees = Math.round((purse * slab.toPercentage) / 100);
    const rawIncrement = (purse * slab.incrementPercentage) / 100;
    const rupeeIncrement = Math.max(1, Math.ceil(rawIncrement));
    return {
      index,
      fromPercentage: slab.fromPercentage,
      toPercentage: slab.toPercentage,
      incrementPercentage: slab.incrementPercentage,
      fromRupees,
      toRupees,
      rupeeIncrement
    };
  });
}

module.exports = {
  DEFAULT_AUTO_INCREMENT_SLABS,
  validateAutoIncrementSlabs,
  getEffectiveAutoIncrementSlabs,
  calculateAutoIncrement,
  calculateSlabPreviews
};
