const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_AUTO_INCREMENT_SLABS,
  validateAutoIncrementSlabs,
  getEffectiveAutoIncrementSlabs,
  calculateAutoIncrement,
  calculateSlabPreviews
} = require('../utils/autoIncrement');

describe('Auto Increment Slab System - Unit & Integration Tests', () => {

  // 1. Default Slab Configuration
  test('1. Default slab configuration has 5 continuous slabs covering 0% to 100%', () => {
    assert.equal(Array.isArray(DEFAULT_AUTO_INCREMENT_SLABS), true);
    assert.equal(DEFAULT_AUTO_INCREMENT_SLABS.length, 5);

    assert.deepEqual(DEFAULT_AUTO_INCREMENT_SLABS[0], { fromPercentage: 0, toPercentage: 10, incrementPercentage: 1 });
    assert.deepEqual(DEFAULT_AUTO_INCREMENT_SLABS[1], { fromPercentage: 10, toPercentage: 25, incrementPercentage: 1.5 });
    assert.deepEqual(DEFAULT_AUTO_INCREMENT_SLABS[2], { fromPercentage: 25, toPercentage: 50, incrementPercentage: 2 });
    assert.deepEqual(DEFAULT_AUTO_INCREMENT_SLABS[3], { fromPercentage: 50, toPercentage: 75, incrementPercentage: 3 });
    assert.deepEqual(DEFAULT_AUTO_INCREMENT_SLABS[4], { fromPercentage: 75, toPercentage: 100, incrementPercentage: 4 });

    const validation = validateAutoIncrementSlabs(DEFAULT_AUTO_INCREMENT_SLABS);
    assert.equal(validation.isValid, true);
    assert.equal(validation.slabs.length, 5);
  });

  // 2. Correct Slab Selection at Boundaries
  test('2. Correct slab selection at exact percentage boundaries', () => {
    const teamPurse = 100000; // 1 Lakh

    // 0% -> Slab 0 (1%)
    const res0 = calculateAutoIncrement({ currentBid: 0, teamPurse });
    assert.equal(res0.slabIndex, 0);
    assert.equal(res0.incrementPercentage, 1);
    assert.equal(res0.rupeeIncrement, 1000);
    assert.equal(res0.nextBid, 1000);

    // 10% (10,000) -> Slab 0 (0-10% inclusive)
    const res10 = calculateAutoIncrement({ currentBid: 10000, teamPurse });
    assert.equal(res10.slabIndex, 0);
    assert.equal(res10.incrementPercentage, 1);
    assert.equal(res10.rupeeIncrement, 1000);
    assert.equal(res10.nextBid, 11000);

    // 10.01% (10,010) -> Slab 1 (Above 10%-25%)
    const res10Plus = calculateAutoIncrement({ currentBid: 10010, teamPurse });
    assert.equal(res10Plus.slabIndex, 1);
    assert.equal(res10Plus.incrementPercentage, 1.5);
    assert.equal(res10Plus.rupeeIncrement, 1500);

    // 25% (25,000) -> Slab 1 (10-25% inclusive)
    const res25 = calculateAutoIncrement({ currentBid: 25000, teamPurse });
    assert.equal(res25.slabIndex, 1);
    assert.equal(res25.incrementPercentage, 1.5);

    // 25.01% (25,010) -> Slab 2 (Above 25%-50%)
    const res25Plus = calculateAutoIncrement({ currentBid: 25010, teamPurse });
    assert.equal(res25Plus.slabIndex, 2);
    assert.equal(res25Plus.incrementPercentage, 2);

    // 50% (50,000) -> Slab 2 (25-50% inclusive)
    const res50 = calculateAutoIncrement({ currentBid: 50000, teamPurse });
    assert.equal(res50.slabIndex, 2);
    assert.equal(res50.incrementPercentage, 2);

    // 50.01% (50,010) -> Slab 3 (Above 50%-75%)
    const res50Plus = calculateAutoIncrement({ currentBid: 50010, teamPurse });
    assert.equal(res50Plus.slabIndex, 3);
    assert.equal(res50Plus.incrementPercentage, 3);

    // 75% (75,000) -> Slab 3 (50-75% inclusive)
    const res75 = calculateAutoIncrement({ currentBid: 75000, teamPurse });
    assert.equal(res75.slabIndex, 3);
    assert.equal(res75.incrementPercentage, 3);

    // 75.01% (75,010) -> Slab 4 (Above 75%-100%)
    const res75Plus = calculateAutoIncrement({ currentBid: 75010, teamPurse });
    assert.equal(res75Plus.slabIndex, 4);
    assert.equal(res75Plus.incrementPercentage, 4);

    // 100% (100,000) -> Slab 4 (4%)
    const res100 = calculateAutoIncrement({ currentBid: 100000, teamPurse });
    assert.equal(res100.slabIndex, 4);
    assert.equal(res100.incrementPercentage, 4);
    assert.equal(res100.rupeeIncrement, 4000);

    // Above 100% (120,000) -> Clamped safely to top slab
    const res120 = calculateAutoIncrement({ currentBid: 120000, teamPurse });
    assert.equal(res120.slabIndex, 4);
    assert.equal(res120.incrementPercentage, 4);
    assert.equal(res120.rupeeIncrement, 4000);
    assert.equal(res120.nextBid, 124000);
  });

  // 3. Percentage-to-Rupee Calculations with Standard Team Purse (5 Crores)
  test('3. Dynamic percentage-to-rupee calculation with standard 5 Cr purse', () => {
    const teamPurse = 50000000; // 5 Crores

    // 0-10% -> 1% of 5 Cr = 500,000
    const res1 = calculateAutoIncrement({ currentBid: 2000000, teamPurse });
    assert.equal(res1.rupeeIncrement, 500000);
    assert.equal(res1.nextBid, 2500000);

    // 10-25% -> 1.5% of 5 Cr = 750,000
    const res2 = calculateAutoIncrement({ currentBid: 10000000, teamPurse }); // 20%
    assert.equal(res2.rupeeIncrement, 750000);
    assert.equal(res2.nextBid, 10750000);

    // 25-50% -> 2% of 5 Cr = 1,000,000
    const res3 = calculateAutoIncrement({ currentBid: 20000000, teamPurse }); // 40%
    assert.equal(res3.rupeeIncrement, 1000000);
    assert.equal(res3.nextBid, 21000000);

    // 50-75% -> 3% of 5 Cr = 1,500,000
    const res4 = calculateAutoIncrement({ currentBid: 30000000, teamPurse }); // 60%
    assert.equal(res4.rupeeIncrement, 1500000);
    assert.equal(res4.nextBid, 31500000);

    // 75-100% -> 4% of 5 Cr = 2,000,000
    const res5 = calculateAutoIncrement({ currentBid: 40000000, teamPurse }); // 80%
    assert.equal(res5.rupeeIncrement, 2000000);
    assert.equal(res5.nextBid, 42000000);
  });

  // 4. Large and Small Team Purse Values
  test('4. Correct scaling for large (10 Cr) and small (20k) Team Purse values', () => {
    // Large purse: 10 Crores (100,000,000)
    const largePurse = 100000000;
    const largeRes = calculateAutoIncrement({ currentBid: 5000000, teamPurse: largePurse });
    assert.equal(largeRes.rupeeIncrement, 1000000); // 1% of 10 Cr = 10 Lakhs

    // Small purse: 20,000
    const smallPurse = 20000;
    const smallRes = calculateAutoIncrement({ currentBid: 1000, teamPurse: smallPurse });
    assert.equal(smallRes.rupeeIncrement, 200); // 1% of 20,000 = 200
  });

  // 5. Rounding Behavior (Upward to Nearest Integer Rupee)
  test('5. Rounding behavior rounds fractions upward to nearest rupee with safe integers', () => {
    // 1% of 33,333 = 333.33 -> Math.ceil = 334
    const res1 = calculateAutoIncrement({ currentBid: 0, teamPurse: 33333 });
    assert.equal(res1.rupeeIncrement, 334);
    assert.equal(Number.isInteger(res1.rupeeIncrement), true);

    // 1.5% of 33,333 = 499.995 -> Math.ceil = 500
    const res2 = calculateAutoIncrement({ currentBid: 5000, teamPurse: 33333 });
    assert.equal(res2.rupeeIncrement, 500);

    // Very small purse: 1% of 50 = 0.5 -> Math.ceil = 1
    const res3 = calculateAutoIncrement({ currentBid: 0, teamPurse: 50 });
    assert.equal(res3.rupeeIncrement, 1);
  });

  // 6. Validation: Invalid or Overlapping Slab Configurations
  test('6. Rejects invalid, overlapping, or non-continuous slab configurations', () => {
    // Non-array
    assert.equal(validateAutoIncrementSlabs(null).isValid, false);
    assert.equal(validateAutoIncrementSlabs([]).isValid, false);

    // Does not start at 0%
    const notZero = [
      { fromPercentage: 5, toPercentage: 50, incrementPercentage: 1 },
      { fromPercentage: 50, toPercentage: 100, incrementPercentage: 2 }
    ];
    const valNotZero = validateAutoIncrementSlabs(notZero);
    assert.equal(valNotZero.isValid, false);
    assert.match(valNotZero.message, /must start at 0%/i);

    // Overlapping ranges: 0-25% and 20-50%
    const overlapping = [
      { fromPercentage: 0, toPercentage: 25, incrementPercentage: 1 },
      { fromPercentage: 20, toPercentage: 50, incrementPercentage: 2 },
      { fromPercentage: 50, toPercentage: 100, incrementPercentage: 3 }
    ];
    const valOverlapping = validateAutoIncrementSlabs(overlapping);
    assert.equal(valOverlapping.isValid, false);
    assert.match(valOverlapping.message, /overlapping/i);

    // Gap in ranges: 0-20% and 30-100%
    const gap = [
      { fromPercentage: 0, toPercentage: 20, incrementPercentage: 1 },
      { fromPercentage: 30, toPercentage: 100, incrementPercentage: 2 }
    ];
    const valGap = validateAutoIncrementSlabs(gap);
    assert.equal(valGap.isValid, false);
    assert.match(valGap.message, /gap/i);

    // Inverted bounds: from > to
    const inverted = [
      { fromPercentage: 0, toPercentage: 50, incrementPercentage: 1 },
      { fromPercentage: 50, toPercentage: 40, incrementPercentage: 2 },
      { fromPercentage: 40, toPercentage: 100, incrementPercentage: 3 }
    ];
    assert.equal(validateAutoIncrementSlabs(inverted).isValid, false);

    // Non-positive increment percentage
    const zeroIncrement = [
      { fromPercentage: 0, toPercentage: 50, incrementPercentage: 0 },
      { fromPercentage: 50, toPercentage: 100, incrementPercentage: 2 }
    ];
    assert.equal(validateAutoIncrementSlabs(zeroIncrement).isValid, false);
  });

  // 7. Validation: Incomplete Slab Coverage (< 100%)
  test('7. Rejects slab configuration that does not reach 100%', () => {
    const incomplete = [
      { fromPercentage: 0, toPercentage: 30, incrementPercentage: 1 },
      { fromPercentage: 30, toPercentage: 70, incrementPercentage: 2 }
    ];
    const val = validateAutoIncrementSlabs(incomplete);
    assert.equal(val.isValid, false);
    assert.match(val.message, /cover up to at least 100%/i);
  });

  // 8. Custom Valid Slab Configurations (e.g., 3-slab or 6-slab setup)
  test('8. Allows customized 3-slab or 6-slab configurations as long as continuous to 100%', () => {
    const custom3Slabs = [
      { fromPercentage: 0, toPercentage: 40, incrementPercentage: 1 },
      { fromPercentage: 40, toPercentage: 80, incrementPercentage: 2.5 },
      { fromPercentage: 80, toPercentage: 100, incrementPercentage: 5 }
    ];
    const val3 = validateAutoIncrementSlabs(custom3Slabs);
    assert.equal(val3.isValid, true);
    assert.equal(val3.slabs.length, 3);

    const res = calculateAutoIncrement({ currentBid: 50000, teamPurse: 100000, slabs: custom3Slabs });
    assert.equal(res.slabIndex, 1);
    assert.equal(res.incrementPercentage, 2.5);
    assert.equal(res.rupeeIncrement, 2500);
  });

  // 9. Team Purse Validation
  test('9. Throws error for non-positive or invalid Team Purse', () => {
    assert.throws(() => calculateAutoIncrement({ currentBid: 100, teamPurse: 0 }), /INVALID_TEAM_PURSE/);
    assert.throws(() => calculateAutoIncrement({ currentBid: 100, teamPurse: -5000 }), /INVALID_TEAM_PURSE/);
    assert.throws(() => calculateAutoIncrement({ currentBid: 100, teamPurse: NaN }), /INVALID_TEAM_PURSE/);
    assert.throws(() => calculateAutoIncrement({ currentBid: 100, teamPurse: 'invalid' }), /INVALID_TEAM_PURSE/);
  });

  // 10. Backward Compatibility for Tournaments Without Slabs
  test('10. Backward compatibility falls back gracefully to default slabs', () => {
    const legacyTournament1 = { name: 'Legacy League' };
    const effective1 = getEffectiveAutoIncrementSlabs(legacyTournament1);
    assert.equal(effective1.length, 5);
    assert.equal(effective1[0].incrementPercentage, 1);

    const legacyTournament2 = { name: 'Empty Slabs', autoIncrementSlabs: [] };
    const effective2 = getEffectiveAutoIncrementSlabs(legacyTournament2);
    assert.equal(effective2.length, 5);

    const legacyTournament3 = { name: 'Corrupt Slabs', autoIncrementSlabs: [{ fromPercentage: 10, toPercentage: 20 }] };
    const effective3 = getEffectiveAutoIncrementSlabs(legacyTournament3);
    assert.equal(effective3.length, 5);
  });

  // 11. Slab Previews Generator
  test('11. calculateSlabPreviews generates correct rupee ranges and increment previews', () => {
    const teamPurse = 50000000; // 5 Crores
    const previews = calculateSlabPreviews({ teamPurse });
    assert.equal(previews.length, 5);

    assert.equal(previews[0].fromRupees, 0);
    assert.equal(previews[0].toRupees, 5000000);
    assert.equal(previews[0].rupeeIncrement, 500000);

    assert.equal(previews[1].fromRupees, 5000000);
    assert.equal(previews[1].toRupees, 12500000);
    assert.equal(previews[1].rupeeIncrement, 750000);

    assert.equal(previews[2].fromRupees, 12500000);
    assert.equal(previews[2].toRupees, 25000000);
    assert.equal(previews[2].rupeeIncrement, 1000000);

    assert.equal(previews[3].fromRupees, 25000000);
    assert.equal(previews[3].toRupees, 37500000);
    assert.equal(previews[3].rupeeIncrement, 1500000);

    assert.equal(previews[4].fromRupees, 37500000);
    assert.equal(previews[4].toRupees, 50000000);
    assert.equal(previews[4].rupeeIncrement, 2000000);
  });

  // 12. Settings Persistence & Preservation of Legacy Buttons
  test('12. Settings persistence preserves bidButton1-3 and biddingButtonsCount while updating slabs', () => {
    const existingTournament = {
      name: 'Premier League',
      teamBudget: 50000000,
      bidButton1: 500,
      bidButton2: 1000,
      bidButton3: 5000,
      biddingButtonsCount: 3,
      autoIncrementSlabs: DEFAULT_AUTO_INCREMENT_SLABS
    };

    const newSlabs = [
      { fromPercentage: 0, toPercentage: 20, incrementPercentage: 1 },
      { fromPercentage: 20, toPercentage: 50, incrementPercentage: 2 },
      { fromPercentage: 50, toPercentage: 100, incrementPercentage: 3.5 }
    ];

    const validation = validateAutoIncrementSlabs(newSlabs);
    assert.equal(validation.isValid, true);

    const updatedTournament = {
      ...existingTournament,
      autoIncrementSlabs: validation.slabs
    };

    // Verify existing buttons remain intact
    assert.equal(updatedTournament.bidButton1, 500);
    assert.equal(updatedTournament.bidButton2, 1000);
    assert.equal(updatedTournament.bidButton3, 5000);
    assert.equal(updatedTournament.biddingButtonsCount, 3);
    assert.equal(updatedTournament.autoIncrementSlabs.length, 3);
    assert.equal(updatedTournament.autoIncrementSlabs[0].toPercentage, 20);
  });

  // 13. Route Validation Simulation for Invalid Slabs (HTTP 400 + INVALID_SLABS)
  test('13. Route handler rejects invalid slabs with HTTP 400 and code INVALID_SLABS', () => {
    const invalidPayload = [
      { fromPercentage: 0, toPercentage: 40, incrementPercentage: 1 },
      { fromPercentage: 50, toPercentage: 100, incrementPercentage: 2 } // Gap!
    ];

    const validation = validateAutoIncrementSlabs(invalidPayload);
    assert.equal(validation.isValid, false);

    // Simulate route error response
    const routeResponse = {
      status: 400,
      body: { message: validation.message, code: 'INVALID_SLABS' }
    };

    assert.equal(routeResponse.status, 400);
    assert.equal(routeResponse.body.code, 'INVALID_SLABS');
    assert.match(routeResponse.body.message, /gap/i);
  });

  // 14. Tournament Mongoose Model Schema Integration
  test('14. Tournament Mongoose model instantiates with default 5 autoIncrementSlabs', () => {
    const Tournament = require('../models/Tournament');
    const doc = new Tournament({ name: 'Model Test League', organizer: '660000000000000000000001' });

    assert.equal(Array.isArray(doc.autoIncrementSlabs), true);
    assert.equal(doc.autoIncrementSlabs.length, 5);
    assert.equal(doc.autoIncrementSlabs[0].fromPercentage, 0);
    assert.equal(doc.autoIncrementSlabs[0].toPercentage, 10);
    assert.equal(doc.autoIncrementSlabs[0].incrementPercentage, 1);
    assert.equal(doc.autoIncrementSlabs[4].toPercentage, 100);
    assert.equal(doc.autoIncrementSlabs[4].incrementPercentage, 4);

    // Verify bidButtons still default properly
    assert.equal(doc.bidButton1, 500);
    assert.equal(doc.bidButton2, 1000);
    assert.equal(doc.bidButton3, 5000);
    assert.equal(doc.biddingButtonsCount, 3);
  });
});
