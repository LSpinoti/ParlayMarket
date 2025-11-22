"use client";

import { useState, useEffect } from "react";
import { connectWallet, getAccount } from "@/lib/web3";

interface WalletConnectProps {
  onConnect: (address: string) => void;
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  const [account, setAccount] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const address = await getAccount();
      if (address) {
        setAccount(address);
        onConnect(address);
      }
    } catch (error) {
      console.error("Error checking connection:", error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const address = await connectWallet();
      setAccount(address);
      onConnect(address);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert("Failed to connect wallet. Please make sure MetaMask is installed.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (account) {
    return (
      <div className="card text-center">
        <p className="text-sm text-gray-400">Connected Wallet</p>
        <p className="text-lg font-mono text-flare-secondary">
          {account.slice(0, 6)}...{account.slice(-4)}
        </p>
      </div>
    );
  }

  return (
    <div className="card text-center">
      <p className="mb-4 text-gray-300">
        Connect your wallet to start trading parlays
      </p>
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    </div>
  );
}
