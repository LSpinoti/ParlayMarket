"use client";

import { useState, useEffect } from "react";
import { getAllParlays, resolveParlay } from "@/lib/parlayService";
import ParlayCard from "./ParlayCard";

interface Parlay {
  id: string;
  title: string;
  description: string;
  stake: number;
  outcomes: string[];
  creator: string;
  status: "active" | "resolved";
  resolvedOutcome?: string;
  createdAt: Date;
}

interface ParlayListProps {
  account: string;
}

export default function ParlayList({ account }: ParlayListProps) {
  const [parlays, setParlays] = useState<Parlay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadParlays();
  }, []);

  const loadParlays = async () => {
    setIsLoading(true);
    try {
      const allParlays = await getAllParlays();
      setParlays(allParlays);
    } catch (error) {
      console.error("Failed to load parlays:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (parlayId: string, outcome: string) => {
    try {
      await resolveParlay(parlayId, outcome, account);
      alert("Parlay resolved successfully!");
      loadParlays();
    } catch (error) {
      console.error("Failed to resolve parlay:", error);
      alert("Failed to resolve parlay");
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-flare-primary mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading parlays...</p>
      </div>
    );
  }

  if (parlays.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No parlays available. Create one to get started!
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {parlays.map((parlay) => (
        <ParlayCard
          key={parlay.id}
          parlay={parlay}
          currentAccount={account}
          onResolve={handleResolve}
        />
      ))}
    </div>
  );
}
