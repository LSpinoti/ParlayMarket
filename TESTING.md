# Testing Guide for ParlayMarket

This guide will help you test all features of ParlayMarket on Coston2 testnet.

## Prerequisites

1. ✅ Contracts deployed to Coston2
2. ✅ Contract addresses updated in `lib/contracts.ts`
3. ✅ MetaMask installed with Coston2 network added
4. ✅ Test FLR from [faucet](https://faucet.flare.network/coston2)

## Test Scenarios

### Scenario 1: Basic Parlay Creation and Fill

**Objective:** Create a simple 2-leg parlay and have another user fill it.

#### Steps:

1. **Create Parlay (Account A)**
   - Connect wallet with Account A
   - Navigate to "Create Parlay"
   - Add 2 market legs:
     - UMA ID 1: `0x1111111111111111111111111111111111111111111111111111111111111111`
     - Required Outcome: YES
     - UMA ID 2: `0x2222222222222222222222222222222222222222222222222222222222222222`
     - Required Outcome: YES
   - Set stakes:
     - Your Stake: 10 FLR
     - Taker Stake: 10 FLR
   - Choose position: YES
   - Set expiry: 7 days
   - Click "Create Parlay"
   - Confirm transaction in MetaMask

2. **Verify Creation**
   - Go to "Browse Parlays"
   - Confirm new parlay appears with status "Created"
   - Go to "My Parlays"
   - Confirm parlay appears in your list

3. **Fill Parlay (Account B)**
   - Switch to Account B in MetaMask
   - Refresh the page
   - Go to "Browse Parlays"
   - Click on the newly created parlay
   - Click "Fill Parlay"
   - Confirm transaction (10 FLR)

4. **Verify Fill**
   - Confirm status changes to "Filled"
   - Note the YES and NO token IDs
   - Both Account A and Account B should see it in "My Parlays"

5. **Set Oracle Outcomes (Admin)**
   - Open browser console
   - Run this script:
   ```javascript
   const oracle = new ethers.Contract(
     'ORACLE_ADDRESS',
     ['function setOutcomes(bytes32[] calldata umaIds, uint8[] calldata outcomes) external'],
     await provider.getSigner()
   );
   
   const umaIds = [
     '0x1111111111111111111111111111111111111111111111111111111111111111',
     '0x2222222222222222222222222222222222222222222222222222222222222222'
   ];
   const outcomes = [1, 1]; // Both YES
   
   await oracle.setOutcomes(umaIds, outcomes);
   ```

6. **Resolve Parlay**
   - Either account can click "Resolve Parlay"
   - Confirm transaction
   - Winner (Account A with YES) receives 20 FLR

**Expected Results:**
- ✅ Parlay created successfully
- ✅ Parlay filled by second account
- ✅ Tokens minted to both parties
- ✅ Parlay resolved correctly
- ✅ Winner receives full pot
- ✅ Tokens burned after resolution

---

### Scenario 2: Parlay with Failed Leg

**Objective:** Test that parlay resolves to NO when one leg fails.

#### Steps:

1. Create parlay with 3 legs (all required outcome: YES)
2. Fill the parlay
3. Set oracle outcomes: [YES, NO, YES]
4. Resolve parlay
5. Verify NO side wins

**Expected Results:**
- ✅ NO token holder receives payout
- ✅ YES token holder receives nothing

---

### Scenario 3: Parlay Cancellation

**Objective:** Test cancellation of unfilled parlay.

#### Steps:

1. Create parlay with expiry = 1 day in future
2. Wait for expiry (or modify contract for testing)
3. As maker, click "Cancel Parlay"
4. Verify maker receives stake back
5. Verify status changes to "Cancelled"

**Expected Results:**
- ✅ Maker receives full stake refund
- ✅ Parlay status = Cancelled
- ✅ Cannot be filled after cancellation

---

### Scenario 4: Invalid Market Handling

**Objective:** Test refund mechanism when underlying market is invalid.

#### Steps:

1. Create and fill parlay
2. Set one oracle outcome to INVALID (2)
3. Resolve parlay
4. Verify both parties receive their stakes back proportionally

**Expected Results:**
- ✅ Both accounts receive refunds
- ✅ Status changes to Invalid
- ✅ Tokens burned

---

### Scenario 5: Token Transfer

**Objective:** Test that position tokens are tradable.

#### Steps:

1. Create and fill parlay (Account A = YES, Account B = NO)
2. From Account B, transfer NO token to Account C:
   ```javascript
   const token = new ethers.Contract(
     'TOKEN_ADDRESS',
     ['function transferFrom(address from, address to, uint256 tokenId) external'],
     signer
   );
   await token.transferFrom(accountB, accountC, noTokenId);
   ```
3. Resolve parlay with NO winning
4. Verify Account C (new NO token holder) receives payout

**Expected Results:**
- ✅ Token transferred successfully
- ✅ New owner receives payout
- ✅ Original owner receives nothing

---

## Quick Test Script

Use this script in browser console for rapid testing:

```javascript
// Connect to contracts
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const parlayMarket = new ethers.Contract(
  'PARLAY_MARKET_ADDRESS',
  PARLAY_MARKET_ABI,
  signer
);

const oracle = new ethers.Contract(
  'ORACLE_ADDRESS',
  ORACLE_ABI,
  signer
);

// 1. Create test parlay
const umaIds = [
  ethers.zeroPadValue(ethers.toBeHex(1), 32),
  ethers.zeroPadValue(ethers.toBeHex(2), 32)
];
const requiredOutcomes = [1, 1]; // Both YES
const takerStake = ethers.parseEther('5');
const expiry = Math.floor(Date.now() / 1000) + 86400; // 1 day
const makerIsYes = true;

const tx = await parlayMarket.createParlay(
  umaIds,
  requiredOutcomes,
  takerStake,
  expiry,
  makerIsYes,
  { value: ethers.parseEther('5') }
);

await tx.wait();
console.log('Parlay created!');

// 2. Get parlay ID
const totalParlays = await parlayMarket.getTotalParlays();
const parlayId = totalParlays - 1n;
console.log('Parlay ID:', parlayId.toString());

// 3. Fill parlay (switch account in MetaMask first!)
const fillTx = await parlayMarket.fillParlay(parlayId, {
  value: takerStake
});
await fillTx.wait();
console.log('Parlay filled!');

// 4. Set oracle outcomes
const outcomeTx = await oracle.setOutcomes(umaIds, [1, 1]);
await outcomeTx.wait();
console.log('Outcomes set!');

// 5. Resolve parlay
const resolveTx = await parlayMarket.resolveParlay(parlayId);
await resolveTx.wait();
console.log('Parlay resolved!');
```

## Automated Testing (Future)

For comprehensive automated testing, we recommend:

### Unit Tests (Hardhat)

```javascript
// test/ParlayMarket.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ParlayMarket", function () {
  it("Should create parlay", async function () {
    // Test implementation
  });
  
  it("Should fill parlay", async function () {
    // Test implementation
  });
  
  it("Should resolve parlay correctly", async function () {
    // Test implementation
  });
});
```

Run with: `npx hardhat test`

### Integration Tests (Playwright/Cypress)

```javascript
// e2e/parlay.spec.ts
test('Create and fill parlay end-to-end', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Connect Wallet');
  // ... rest of test
});
```

## Troubleshooting

### Issue: Transaction Fails

**Solution:**
- Check gas limits
- Verify account has enough FLR
- Check contract addresses are correct
- Verify network is Coston2 (chain ID 114)

### Issue: Parlay Not Appearing

**Solution:**
- Wait a few seconds for blockchain confirmation
- Click refresh button
- Check browser console for errors
- Verify you're on correct network

### Issue: Cannot Resolve

**Solution:**
- Ensure all markets have oracle outcomes set
- Check that status is "Filled"
- Verify you're calling from an account with gas

### Issue: Wrong Payout

**Solution:**
- Check token ownership (may have been transferred)
- Verify oracle outcomes are correct
- Check parlay required outcomes match

## Test Checklist

Use this checklist to verify all functionality:

- [ ] Wallet connects successfully
- [ ] Network switches to Coston2
- [ ] Create parlay with 1 leg
- [ ] Create parlay with multiple legs
- [ ] Fill parlay from different account
- [ ] Cancel unfilled parlay
- [ ] Resolve parlay (YES wins)
- [ ] Resolve parlay (NO wins)
- [ ] Handle invalid market
- [ ] Transfer position token
- [ ] View parlay details
- [ ] Filter parlays by status
- [ ] View "My Parlays"
- [ ] Proper error messages display
- [ ] Success messages display
- [ ] Loading states work
- [ ] Mobile responsive (test on phone)

## Reporting Issues

If you encounter bugs during testing:

1. Note the exact steps to reproduce
2. Check browser console for errors
3. Note transaction hashes
4. Include account addresses (can be masked)
5. Open GitHub issue with details

## Next Steps

After successful testing:

1. Consider mainnet deployment (after audit!)
2. Implement additional features from FEATURES.md
3. Add comprehensive test suite
4. Improve error handling
5. Optimize gas usage

---

Happy Testing! 🎯

