export default function About() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-flare-primary">About Parlay Market</h1>
      
      <div className="space-y-6 text-gray-300">
        <section className="card">
          <h2 className="text-2xl font-semibold mb-4 text-flare-secondary">What is Parlay Market?</h2>
          <p className="mb-4">
            Parlay Market is a decentralized application built on the Flare Network that enables users 
            to create, trade, and resolve parlays. A parlay is a combination bet that links together 
            multiple individual wagers and depends on all of those wagers winning together.
          </p>
        </section>

        <section className="card">
          <h2 className="text-2xl font-semibold mb-4 text-flare-secondary">Features</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Create custom parlays with multiple outcomes</li>
            <li>Stake FLR tokens on your parlays</li>
            <li>Resolve parlays when outcomes are determined</li>
            <li>View all active parlays on the network</li>
            <li>Connect with MetaMask wallet</li>
            <li>Built on Flare Network for fast and low-cost transactions</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-2xl font-semibold mb-4 text-flare-secondary">How to Use</h2>
          <ol className="list-decimal list-inside space-y-3">
            <li>
              <strong>Connect Your Wallet:</strong> Click the "Connect Wallet" button and 
              approve the connection in MetaMask. The app will automatically switch to the 
              Flare Testnet (Coston2) network.
            </li>
            <li>
              <strong>Create a Parlay:</strong> Fill in the parlay details including title, 
              description, stake amount, and possible outcomes (comma-separated).
            </li>
            <li>
              <strong>View Parlays:</strong> Browse all active parlays created by users on 
              the network.
            </li>
            <li>
              <strong>Resolve Parlays:</strong> If you created a parlay, you can resolve it 
              by selecting the winning outcome.
            </li>
          </ol>
        </section>

        <section className="card">
          <h2 className="text-2xl font-semibold mb-4 text-flare-secondary">About Flare Network</h2>
          <p className="mb-4">
            Flare is a blockchain for building applications that use data from other chains 
            and the internet. It provides developers with decentralized access to high-integrity 
            data from other chains and the internet, enabling new use cases and monetization models.
          </p>
          <p>
            Learn more at{" "}
            <a 
              href="https://flare.network" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-flare-secondary hover:text-flare-primary transition-colors"
            >
              flare.network
            </a>
          </p>
        </section>

        <section className="card">
          <h2 className="text-2xl font-semibold mb-4 text-flare-secondary">Technology Stack</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Next.js 16 - React framework for production</li>
            <li>TypeScript - Type-safe JavaScript</li>
            <li>Tailwind CSS - Utility-first CSS framework</li>
            <li>ethers.js - Ethereum library for blockchain interactions</li>
            <li>Flare Network - Layer 1 blockchain</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
