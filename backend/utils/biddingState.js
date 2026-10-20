// In-memory state tracking for organizer-controlled Start Bidding / Pause Bidding
// Scoped strictly per organizerId to guarantee multi-tenant tournament isolation

const biddingActiveMap = new Map(); // organizerKey (String) -> boolean
const operatorSocketsMap = new Map(); // organizerKey (String) -> Set of socket IDs

const isBiddingActive = (organizerId) => {
  if (!organizerId) return false;
  return Boolean(biddingActiveMap.get(String(organizerId)));
};

const setBiddingActive = (organizerId, active) => {
  if (!organizerId) return;
  biddingActiveMap.set(String(organizerId), Boolean(active));
};

const registerOperatorSocket = (organizerId, socketId) => {
  if (!organizerId || !socketId) return;
  const key = String(organizerId);
  if (!operatorSocketsMap.has(key)) {
    operatorSocketsMap.set(key, new Set());
  }
  operatorSocketsMap.get(key).add(socketId);
};

const removeOperatorSocket = (organizerId, socketId) => {
  if (!organizerId || !socketId) return 0;
  const key = String(organizerId);
  const set = operatorSocketsMap.get(key);
  if (!set) return 0;
  set.delete(socketId);
  if (set.size === 0) {
    operatorSocketsMap.delete(key);
    return 0;
  }
  return set.size;
};

const hasActiveOperators = (organizerId) => {
  if (!organizerId) return false;
  const set = operatorSocketsMap.get(String(organizerId));
  return Boolean(set && set.size > 0);
};

const clearBiddingState = () => {
  biddingActiveMap.clear();
  operatorSocketsMap.clear();
};

module.exports = {
  isBiddingActive,
  setBiddingActive,
  registerOperatorSocket,
  removeOperatorSocket,
  hasActiveOperators,
  clearBiddingState
};
