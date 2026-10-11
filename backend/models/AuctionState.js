const mongoose = require('mongoose');

const auctionStateSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, unique: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  activePlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  currentBid: { type: Number, default: 0 },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  status: { type: String, enum: ['idle', 'bidding', 'sold', 'unsold'], default: 'idle' },
  version: { type: Number, default: 0 }
}, { timestamps: true });

auctionStateSchema.index({ organizer: 1, tournament: 1 }, { unique: true });

module.exports = mongoose.model('AuctionState', auctionStateSchema);
