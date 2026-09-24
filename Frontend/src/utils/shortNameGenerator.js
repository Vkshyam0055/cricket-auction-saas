/**
 * Short Name Generator for Cricket Auction Teams
 * 
 * Rules:
 * - 1 to 5 characters max
 * - Uppercase alphanumeric [A-Z0-9]
 * - Deterministic, readable acronyms
 * - Collision detection against existing teams of the same organizer
 */

export function sanitizeShortName(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
}

/**
 * Generates an initial candidate short name based on full team name
 * @param {string} fullName 
 * @returns {string[]} Ordered list of candidate short names
 */
function generateCandidates(fullName) {
  if (!fullName || typeof fullName !== 'string') return [];
  const clean = fullName.trim();
  if (!clean) return [];

  const words = clean.split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return [];

  const candidates = [];

  if (words.length === 1) {
    const word = words[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (word.length >= 3) {
      candidates.push(word.slice(0, 3)); // e.g. "Titans" -> "TIT"
    }
    if (word.length >= 4) {
      candidates.push(word.slice(0, 4)); // "TITA"
    }
    candidates.push(word.slice(0, 5));     // "TITAN"
    candidates.push(word.slice(0, 2));     // "TI"
  } else {
    // Multi-word acronym (e.g. "Chennai Super Kings" -> "CSK")
    const initials = words.map(w => w.replace(/[^A-Za-z0-9]/g, '')[0] || '').join('').toUpperCase();
    if (initials) {
      candidates.push(initials.slice(0, 5));
    }

    // Two words: e.g. "Royal Riders" -> RR (already in initials), try ROR, RRI, RYR
    if (words.length === 2) {
      const w1 = words[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const w2 = words[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      if (w1.length >= 2 && w2.length >= 1) {
        candidates.push((w1.slice(0, 2) + w2.slice(0, 1)).slice(0, 5)); // "ROR"
      }
      if (w1.length >= 1 && w2.length >= 2) {
        candidates.push((w1.slice(0, 1) + w2.slice(0, 2)).slice(0, 5)); // "RRI"
      }
      if (w1.length >= 2 && w2.length >= 2) {
        candidates.push((w1.slice(0, 2) + w2.slice(0, 2)).slice(0, 5)); // "RORI"
      }
    }

    // If words have numbers (e.g. "Sanjay 11 Kadera" -> "S11K")
    const withDigits = words.map(w => {
      const digits = w.replace(/[^0-9]/g, '');
      if (digits) return digits;
      const letters = w.replace(/[^A-Za-z]/g, '');
      return letters[0] || '';
    }).join('').toUpperCase();
    if (withDigits && !candidates.includes(withDigits)) {
      candidates.push(withDigits.slice(0, 5));
    }
  }

  return Array.from(new Set(candidates.filter(c => c && /^[A-Z0-9]{1,5}$/.test(c))));
}

/**
 * Suggests a deterministic, unique short name for a team.
 * Checks against existing teams under the same organizer.
 * 
 * @param {string} fullName - Full Team Name
 * @param {Array} existingTeams - List of existing team objects
 * @param {string|null} currentTeamId - _id of current team (if editing) to avoid self-collision
 * @returns {{ shortName: string, isCollision: boolean, message?: string }}
 */
export function suggestShortName(fullName, existingTeams = [], currentTeamId = null) {
  if (!fullName || !fullName.trim()) {
    return { shortName: '', isCollision: false };
  }

  const existingShortNames = new Set(
    (existingTeams || [])
      .filter(t => !currentTeamId || String(t._id) !== String(currentTeamId))
      .map(t => String(t.shortName || '').trim().toUpperCase())
      .filter(Boolean)
  );

  const candidates = generateCandidates(fullName);

  // 1. Try each readable candidate
  for (const candidate of candidates) {
    if (!existingShortNames.has(candidate)) {
      return { shortName: candidate, isCollision: false };
    }
  }

  // 2. If the primary candidate collided, try appending deterministic numeric suffixes
  const primary = candidates[0] || fullName.trim().slice(0, 3).toUpperCase();
  const base = primary.slice(0, 4); // Leave room for 1 digit (max length 5)
  for (let num = 2; num <= 9; num++) {
    const candidateWithNum = `${base}${num}`;
    if (!existingShortNames.has(candidateWithNum)) {
      return {
        shortName: candidateWithNum,
        isCollision: true,
        message: `"${primary}" is already taken by another team. Suggested "${candidateWithNum}". You can edit it.`
      };
    }
  }

  // 3. Fallback if exhausted: return primary but warn user
  return {
    shortName: primary.slice(0, 5),
    isCollision: true,
    message: `"${primary}" is already in use. Please enter a unique Short Name.`
  };
}
