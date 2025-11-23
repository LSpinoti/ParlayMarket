# ParlayMarket

A Flare-based, trust-minimized onramp/offramp and decentralized marketplace for multi-leg parlays using a state channels hub-and-spoke model.

---

## Overview

ParlayMarket allows users to create and settle parlays on blockchain-based outcome markets with instant, low-cost collateralization. It leverages a hybrid smart contract and state channel design for rapid, off-chain interaction and final on-chain settlement.

---

## Features

- Multi-leg parlays with ERC-721 tokens representing each position (YES/NO)
- Trust-minimized oracle resolution (UMA, Flare Data Connector)
- Maker determines odds and stake ratios
- Fast and cancellable orders before filling
- Fully non-custodial
- Modular smart contract design
- Comprehensive test scenarios and step-by-step deployment guides

---

## Tech Stack

- **Smart Contracts:** Solidity (0.8.x), deployed on Flare Networks
- **Frontend:** Next.js (React, TypeScript), Tailwind CSS, Ethers.js v6
- **State Channels:** Hub-and-spoke architecture (for off-chain operations)
- **Wallet:** MetaMask integration

---

## Getting Started

### Prerequisites

- Node.js >= 18
- MetaMask
- Flare Coston2 testnet tokens ([faucet link](https://faucet.flare.network/coston2))

### Installation

```bash
git clone <your-repo-url>
git checkout dev2
npm install    # or pnpm install
npm run dev
```
Visit `http://localhost:3000`.

---

## Deployment

- See `/scripts/deploy.md` or `DEPLOYMENT.md` for contract deployment instructions using Hardhat.
- Set deployed contract addresses in `lib/contracts.ts`.
- Quick deploy:
  ```bash
  npx hardhat run scripts/deploy.ts --network coston2
  ```

---

## Project Structure

```
parlaymarket/
├── app/              # Next.js pages (create, browse, details)
├── components/       # UI Components
├── contracts/        # Smart contracts (.sol), interfaces
├── hooks/            # Web3 and data hooks
├── lib/              # ABI/contracts, utilities
├── scripts/          # Deployment, helper scripts
└── ...               # Other configs
```

---

## Usage

1. **Connect your wallet** and switch to the Flare Coston2 network when prompted.
2. **Create a parlay** with custom markets and stakes.
3. **Fill a parlay** (as a taker).
4. **Settle** when the oracle resolves the referenced events.
5. Position tokens are fully tradable until settlement.

---

## Status

- **Branch:** dev2
- **Network:** Flare Coston2 Testnet
- **Production Ready:** In development and testing.
- **See [FEATURES.md] and [TESTING.md] for roadmap and QA scenarios.**
