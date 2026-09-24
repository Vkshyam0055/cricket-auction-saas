/**
 * Database Migration Script: Team Identity Normalization
 * 
 * 1. Converts Player.soldTo from legacy team name strings to Team._id (ObjectId).
 * 2. Sanitizes unsold / empty player soldTo values to null.
 * 3. Converts Tournament.liveScreenConfig.selectedSquadTeam to Team._id.
 * 
 * Usage:
 *   node scripts/migrateTeamIdentity.js --dry-run
 *   node scripts/migrateTeamIdentity.js --execute
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const isExecute = process.argv.includes('--execute');

async function runMigration() {
    console.log(`\n========================================`);
    console.log(`TEAM IDENTITY MIGRATION (${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'})`);
    console.log(`========================================\n`);

    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is missing in environment!');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log(' Connected to MongoDB.');

    const db = mongoose.connection.db;
    const playersCol = db.collection('players');
    const teamsCol = db.collection('teams');
    const tournamentsCol = db.collection('tournaments');

    // 1. Fetch all teams
    const allTeams = await teamsCol.find({}).toArray();
    console.log(` Found ${allTeams.length} total teams.`);

    // 2. Fetch all players
    const allPlayers = await playersCol.find({}).toArray();
    console.log(` Found ${allPlayers.length} total players.`);

    // 3. Analyze players
    const plannedPlayerUpdates = [];
    const alreadyObjectIdPlayers = [];
    const unsoldOrEmptyPlayers = [];
    const unmatchablePlayers = [];

    for (const player of allPlayers) {
        const soldToVal = player.soldTo;

        // Check if already an ObjectId or null
        if (!soldToVal || soldToVal === 'Unsold' || soldToVal === '') {
            unsoldOrEmptyPlayers.push(player._id);
            plannedPlayerUpdates.push({
                playerId: player._id,
                name: player.name,
                from: soldToVal,
                to: null,
                reason: 'Unsold/Empty to null'
            });
            continue;
        }

        // Check if already a valid 24-hex ObjectId referencing a real team
        if (mongoose.Types.ObjectId.isValid(soldToVal) && String(soldToVal).length === 24) {
            const teamExists = allTeams.some(t => String(t._id) === String(soldToVal));
            if (teamExists) {
                alreadyObjectIdPlayers.push(player._id);
                continue;
            }
        }

        // SoldTo is a team name string! Find matching team by organizer + teamName
        const matchingTeam = allTeams.find(t => {
            const orgMatch = !player.organizer || String(t.organizer) === String(player.organizer);
            const nameMatch = t.teamName.trim().toLowerCase() === String(soldToVal).trim().toLowerCase();
            return orgMatch && nameMatch;
        });

        if (matchingTeam) {
            plannedPlayerUpdates.push({
                playerId: player._id,
                name: player.name,
                from: soldToVal,
                to: matchingTeam._id,
                teamName: matchingTeam.teamName,
                organizer: player.organizer,
                reason: `Sold to "${matchingTeam.teamName}" -> ${matchingTeam._id}`
            });
        } else {
            unmatchablePlayers.push({
                playerId: player._id,
                name: player.name,
                soldTo: soldToVal,
                organizer: player.organizer
            });
        }
    }

    console.log(`\n--- Player Analysis ---`);
    console.log(`  Already using ObjectId: ${alreadyObjectIdPlayers.length}`);
    console.log(`  Planned updates:        ${plannedPlayerUpdates.length}`);
    console.log(`  Unmatchable orphans:    ${unmatchablePlayers.length}`);

    plannedPlayerUpdates.forEach(u => {
        console.log(`  - [Player ${u.playerId}] "${u.name}": "${u.from}" -> ${u.to ? String(u.to) : 'null'} (${u.reason})`);
    });

    if (unmatchablePlayers.length > 0) {
        console.warn(`\n⚠️ WARNING: Found ${unmatchablePlayers.length} unmatchable players:`);
        unmatchablePlayers.forEach(p => console.warn(`  - [Player ${p.playerId}] "${p.name}", soldTo="${p.soldTo}"`));
    }

    // 4. Analyze tournaments
    const allTournaments = await tournamentsCol.find({}).toArray();
    const plannedTournamentUpdates = [];

    for (const tourney of allTournaments) {
        const squadTeam = tourney.liveScreenConfig?.selectedSquadTeam;
        if (!squadTeam) continue;

        // If already ObjectId, check if team exists
        if (mongoose.Types.ObjectId.isValid(squadTeam) && String(squadTeam).length === 24) {
            continue;
        }

        // String name: match by organizer + teamName
        const matchingTeam = allTeams.find(t => {
            const orgMatch = !tourney.organizer || String(t.organizer) === String(tourney.organizer);
            const nameMatch = t.teamName.trim().toLowerCase() === String(squadTeam).trim().toLowerCase();
            return orgMatch && nameMatch;
        });

        if (matchingTeam) {
            plannedTournamentUpdates.push({
                tournamentId: tourney._id,
                name: tourney.name,
                from: squadTeam,
                to: matchingTeam._id,
                teamName: matchingTeam.teamName
            });
        } else {
            plannedTournamentUpdates.push({
                tournamentId: tourney._id,
                name: tourney.name,
                from: squadTeam,
                to: null,
                teamName: '(unmatched, resetting to null)'
            });
        }
    }

    console.log(`\n--- Tournament Analysis ---`);
    console.log(`  Planned tournament updates: ${plannedTournamentUpdates.length}`);
    plannedTournamentUpdates.forEach(t => {
        console.log(`  - [Tournament ${t.tournamentId}] "${t.name}": "${t.from}" -> ${t.to ? String(t.to) : 'null'}`);
    });

    // 5. Execute if flag present
    if (isExecute) {
        console.log(`\n>>> EXECUTING MIGRATION...`);

        let playerSuccessCount = 0;
        for (const update of plannedPlayerUpdates) {
            await playersCol.updateOne(
                { _id: update.playerId },
                { $set: { soldTo: update.to } }
            );
            playerSuccessCount++;
        }
        console.log(`✅ Updated ${playerSuccessCount} players.`);

        let tourneySuccessCount = 0;
        for (const update of plannedTournamentUpdates) {
            await tournamentsCol.updateOne(
                { _id: update.tournamentId },
                { $set: { 'liveScreenConfig.selectedSquadTeam': update.to } }
            );
            tourneySuccessCount++;
        }
        console.log(`✅ Updated ${tourneySuccessCount} tournaments.`);

        console.log(`\n🎉 MIGRATION COMPLETED SUCCESSFULLY!`);
    } else {
        console.log(`\nℹ️ Dry run completed. No data was modified.`);
        console.log(`To apply changes, run with: --execute`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.\n');
}

runMigration().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
