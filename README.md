# ParlayMarket

Flare-based Marketplace and Resolver for Parlays

A decentralized application (dapp) built with Next.js that enables users to create, trade, and resolve parlays on the Flare Network.

## Features

- 🔥 **Built on Flare Network** - Leverages Flare's fast and low-cost blockchain infrastructure
- 💼 **MetaMask Integration** - Seamless wallet connection with automatic network switching
- 📝 **Create Custom Parlays** - Define parlays with multiple outcomes and stake FLR tokens
- 📊 **View Active Parlays** - Browse all active parlays on the network
- ✅ **Resolve Parlays** - Creators can resolve parlays by selecting the winning outcome
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- ⚡ **TypeScript** - Type-safe development with full TypeScript support

## Technology Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS v4** - Utility-first CSS framework
- **ethers.js** - Ethereum library for Web3 interactions
- **Flare Network** - Layer 1 blockchain (Coston2 Testnet)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension

### Installation

1. Clone the repository:
```bash
git clone https://github.com/LSpinoti/ParlayMarket.git
cd ParlayMarket
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## How to Use

1. **Connect Wallet**: Click "Connect Wallet" and approve the MetaMask connection. The app automatically switches to Flare Testnet (Coston2).

2. **Create a Parlay**: Fill in the form with:
   - Title (e.g., "NFL Week 10 Parlay")
   - Description
   - Stake amount in FLR
   - Possible outcomes (comma-separated, e.g., "Win, Loss, Push")

3. **View Parlays**: Browse all active parlays created by users on the network

4. **Resolve Parlays**: If you created a parlay, select the winning outcome to resolve it

## Network Configuration

The application is configured to use Flare's Coston2 Testnet:
- **Chain ID**: 114 (0x72)
- **RPC URL**: https://coston2-api.flare.network/ext/C/rpc
- **Explorer**: https://coston2-explorer.flare.network/

## Project Structure

```
ParlayMarket/
├── app/                    # Next.js app directory
│   ├── about/             # About page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── CreateParlayForm.tsx
│   ├── Header.tsx
│   ├── ParlayCard.tsx
│   ├── ParlayList.tsx
│   └── WalletConnect.tsx
├── lib/                   # Utilities and services
│   ├── parlayService.ts   # Parlay business logic
│   └── web3.ts            # Web3 wallet integration
└── public/                # Static assets
```

## Future Enhancements

- Smart contract integration for on-chain parlay storage
- Trading functionality between users
- Advanced filtering and search
- Historical parlay data and statistics
- Mobile app version
- Integration with Flare Time Series Oracle (FTSO) for automated resolution

## About Flare Network

Flare is a blockchain for building applications that use data from other chains and the internet. Learn more at [flare.network](https://flare.network).

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

