const express = require('express');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const fetchTournamentScope = require('../middleware/fetchTournamentScope');
const auctionService = require('../services/auctionService');

const router = express.Router();
router.use(fetchOrganizer, fetchTournamentScope);

const sendAuctionError = (res, error) => res.status(error.statusCode || 500).json({ message: error.publicMessage || 'Auction operation failed.', code: error.message });

router.get('/state', async (req, res) => {
  try { res.json(await auctionService.getStatePayload({ organizerId: req.user.id, tournamentScope: req.tournamentScope })); }
  catch (error) { sendAuctionError(res, error); }
});

router.post('/start', async (req, res) => {
  try { res.json(await auctionService.startAuction({ organizerId: req.user.id, tournamentScope: req.tournamentScope, playerId: req.body.playerId })); }
  catch (error) { sendAuctionError(res, error); }
});

router.post('/bid', async (req, res) => {
  try {
    res.json(await auctionService.placeBid({
      organizerId: req.user.id,
      tournamentScope: req.tournamentScope,
      teamId: req.body.teamId,
      playerId: req.body.playerId,
      amount: req.body.amount,
      bidType: req.body.bidType || 'increment',
      expectedVersion: req.body.expectedVersion,
      allowCustomBid: true
    }));
  } catch (error) { sendAuctionError(res, error); }
});

router.post('/reset-bid', async (req, res) => {
  try { res.json(await auctionService.resetAuctionBid({ organizerId: req.user.id, tournamentScope: req.tournamentScope, playerId: req.body.playerId, expectedVersion: req.body.expectedVersion })); }
  catch (error) { sendAuctionError(res, error); }
});

module.exports = router;
