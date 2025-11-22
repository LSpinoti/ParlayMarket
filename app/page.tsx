"use client";

import { useState, useEffect } from "react";
import ParlayList from "@/components/ParlayList";
import CreateParlayForm from "@/components/CreateParlayForm";
import WalletConnect from "@/components/WalletConnect";

export default function Home() {
  const [account, setAccount] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleWalletConnect = (address: string) => {
    setAccount(address);
  };

  const handleParlayCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-flare-primary to-flare-secondary bg-clip-text text-transparent">
          Parlay Market
        </h1>
        <p className="text-xl text-gray-300">
          Trade and Resolve Parlays on Flare Network
        </p>
      </div>

      <WalletConnect onConnect={handleWalletConnect} />

      {account && (
        <>
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Create New Parlay</h2>
            <CreateParlayForm 
              account={account} 
              onParlayCreated={handleParlayCreated}
            />
          </div>

          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Active Parlays</h2>
            <ParlayList account={account} key={refreshKey} />
          </div>
        </>
      )}
    </div>
  );
}
