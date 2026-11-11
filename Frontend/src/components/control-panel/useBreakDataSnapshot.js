import { useMemo } from 'react';

export function useBreakDataSnapshot({
  allPlayers,
  resolveTeam,
  normalizeCategory,
  teams,
}) {
  return useMemo(() => {
    const soldPlayers = allPlayers
      .filter((player) => ['sold', 'icon'].includes(String(player.auctionStatus || '').toLowerCase()))
      .map((player) => {
        const teamMatch = resolveTeam(player.soldTo);
        return {
          _id: player._id,
          name: player.name,
          photoUrl: player.photoUrl,
          role: player.role,
          category: normalizeCategory(player.category),
          isIcon: Boolean(player.isIcon),
          auctionStatus: player.auctionStatus,
          soldTo: teamMatch ? {
            _id: teamMatch._id,
            teamName: teamMatch.teamName,
            shortName: teamMatch.shortName,
            logoUrl: teamMatch.logoUrl || teamMatch.logo || ''
          } : player.soldTo,
          soldPrice: Number(player.soldPrice || 0)
        };
      });

    const squadsByTeam = {};
    for (const player of soldPlayers) {
      const team = resolveTeam(player.soldTo);
      const keys = [
        player.soldTo?._id ? String(player.soldTo._id) : null,
        player.soldTo ? String(player.soldTo) : null,
        team?._id ? String(team._id) : null,
        team?.teamName || null
      ].filter(Boolean);

      for (const k of new Set(keys)) {
        if (!squadsByTeam[k]) squadsByTeam[k] = [];
        squadsByTeam[k].push(player);
      }
    }

    const unsoldCount = allPlayers.filter((player) => String(player.auctionStatus || '').toLowerCase() === 'unsold').length;
    const readyCount = allPlayers.filter((player) => String(player.auctionStatus || '').toLowerCase() === 'readyforauction').length;

    const topBiddings = [...soldPlayers]
      .sort((a, b) => Number(b.soldPrice || 0) - Number(a.soldPrice || 0))
      .slice(0, 10);

    const totalSoldValue = soldPlayers.reduce((sum, player) => sum + Number(player.soldPrice || 0), 0);
    const totalLeaguePurse = teams.reduce((sum, team) => sum + Number(team.totalPurse || 0), 0);
    const totalRemainingPurse = teams.reduce((sum, team) => sum + Number(team.remainingPurse || 0), 0);
    const avgPlayerPrice = soldPlayers.length > 0 ? Math.round(totalSoldValue / soldPlayers.length) : 0;
    const highestBid = topBiddings.length > 0 ? topBiddings[0] : null;

    // Determine top spending team
    const spendingByTeam = teams.map((team) => {
      const teamSold = squadsByTeam[String(team._id)] || squadsByTeam[team.teamName] || [];
      const spent = teamSold.reduce((sum, p) => sum + Number(p.soldPrice || 0), 0);
      return {
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        spent,
        playersCount: teamSold.length
      };
    });
    spendingByTeam.sort((a, b) => b.spent - a.spent);
    const topSpendingTeam = spendingByTeam.length > 0 && spendingByTeam[0].spent > 0 ? spendingByTeam[0] : null;

    return {
      teams: teams.map((team) => ({
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        totalPurse: Number(team.totalPurse || 0),
        remainingPurse: Number(team.remainingPurse || 0),
        maxBid: Number(team.maxBid || 0),
        remainingRequiredPlayers: Number(team.remainingRequiredPlayers || 0),
        squadCount: (squadsByTeam[String(team._id)] || squadsByTeam[team.teamName] || []).length
      })),
      soldPlayers,
      squadsByTeam,
      summary: {
        totalTeams: teams.length,
        soldPlayers: soldPlayers.length,
        unsoldPlayers: unsoldCount,
        readyForAuction: readyCount,
        totalSoldValue,
        totalLeaguePurse,
        totalRemainingPurse,
        avgPlayerPrice,
        highestBid,
        topSpendingTeam
      },
      topBiddings
    };
  }, [teams, allPlayers, normalizeCategory, resolveTeam]);
}
