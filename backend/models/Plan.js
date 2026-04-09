const mongoose = require('mongoose');

const PLAN_NAMES = ['Free', 'Basic', 'Pro'];

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: PLAN_NAMES
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    subtitle: {
      type: String,
      trim: true,
      default: ''
    },
    // -1 means unlimited teams
    teamLimit: {
      type: Number,
      required: true,
      default: 3
    },
    canPublicRegistration: {
      type: Boolean,
      required: true,
      default: false
    },
    canViewTeams: {
      type: Boolean,
      required: true,
      default: false
    },
    features: {
      type: [String],
      default: []
    },
    isPopular: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);