"use client";

import { useState } from "react";

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

interface ParlayCardProps {
  parlay: Parlay;
  currentAccount: string;
  onResolve: (parlayId: string, outcome: string) => void;
}

export default function ParlayCard({ parlay, currentAccount, onResolve }: ParlayCardProps) {
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);

  const isCreator = parlay.creator.toLowerCase() === currentAccount.toLowerCase();

  const handleResolve = () => {
    if (!selectedOutcome) {
      alert("Please select an outcome");
      return;
    }
    onResolve(parlay.id, selectedOutcome);
    setShowResolveForm(false);
    setSelectedOutcome("");
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-flare-light hover:border-flare-secondary transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold text-flare-primary">{parlay.title}</h3>
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            parlay.status === "active"
              ? "bg-green-900 text-green-300"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {parlay.status}
        </span>
      </div>

      <p className="text-gray-300 text-sm mb-4">{parlay.description}</p>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Stake:</span>
          <span className="text-flare-secondary font-semibold">{parlay.stake} FLR</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Creator:</span>
          <span className="font-mono text-xs">
            {parlay.creator.slice(0, 6)}...{parlay.creator.slice(-4)}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-400 mb-2">Possible Outcomes:</p>
        <div className="flex flex-wrap gap-2">
          {parlay.outcomes.map((outcome) => (
            <span
              key={outcome}
              className="px-2 py-1 bg-flare-dark rounded text-xs border border-gray-600"
            >
              {outcome}
            </span>
          ))}
        </div>
      </div>

      {parlay.status === "resolved" && parlay.resolvedOutcome && (
        <div className="mt-4 p-2 bg-flare-dark rounded border border-flare-secondary">
          <p className="text-sm">
            <span className="text-gray-400">Resolved:</span>{" "}
            <span className="text-flare-secondary font-semibold">
              {parlay.resolvedOutcome}
            </span>
          </p>
        </div>
      )}

      {parlay.status === "active" && isCreator && (
        <div className="mt-4">
          {!showResolveForm ? (
            <button
              onClick={() => setShowResolveForm(true)}
              className="btn-secondary w-full text-sm"
            >
              Resolve Parlay
            </button>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedOutcome}
                onChange={(e) => setSelectedOutcome(e.target.value)}
                className="w-full px-3 py-2 bg-flare-dark border border-gray-600 rounded text-sm focus:outline-none focus:border-flare-secondary"
              >
                <option value="">Select outcome</option>
                {parlay.outcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleResolve}
                  className="btn-primary flex-1 text-sm"
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setShowResolveForm(false);
                    setSelectedOutcome("");
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors flex-1 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
