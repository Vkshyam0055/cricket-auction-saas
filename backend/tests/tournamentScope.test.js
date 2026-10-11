const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTournamentScopeFilter,
  mergeWithTournamentScope
} = require('../utils/tournamentScope');

test('strict tournament scope includes only the selected tournament', () => {
  const filter = buildTournamentScopeFilter('tournament-a');
  assert.deepEqual(filter, { tournament: 'tournament-a' });
});

test('legacy compatibility scope is explicit and limited to one resolved tournament', () => {
  const filter = buildTournamentScopeFilter('tournament-a', true);
  assert.deepEqual(filter, {
    $or: [
      { tournament: 'tournament-a' },
      { tournament: null },
      { tournament: { $exists: false } }
    ]
  });
});

test('scoped query retains organizer constraints', () => {
  const query = mergeWithTournamentScope(
    { organizer: 'organizer-a', _id: 'team-a' },
    { filter: buildTournamentScopeFilter('tournament-a') }
  );
  assert.deepEqual(query, {
    $and: [
      { organizer: 'organizer-a', _id: 'team-a' },
      { tournament: 'tournament-a' }
    ]
  });
});
