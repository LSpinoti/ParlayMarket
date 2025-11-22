"use client";

import { useState } from "react";
import { createParlay } from "@/lib/parlayService";

interface CreateParlayFormProps {
  account: string;
  onParlayCreated: () => void;
}

export default function CreateParlayForm({ account, onParlayCreated }: CreateParlayFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !description || !stake || !outcomes) {
      alert("Please fill in all fields");
      return;
    }

    setIsCreating(true);
    try {
      const outcomeList = outcomes.split(",").map(o => o.trim()).filter(o => o);
      await createParlay({
        title,
        description,
        stake: parseFloat(stake),
        outcomes: outcomeList,
        creator: account,
      });
      
      alert("Parlay created successfully!");
      setTitle("");
      setDescription("");
      setStake("");
      setOutcomes("");
      onParlayCreated();
    } catch (error) {
      console.error("Failed to create parlay:", error);
      alert("Failed to create parlay");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 bg-flare-dark border border-gray-600 rounded focus:outline-none focus:border-flare-secondary"
          placeholder="e.g., NFL Week 10 Parlay"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2 bg-flare-dark border border-gray-600 rounded focus:outline-none focus:border-flare-secondary"
          rows={3}
          placeholder="Describe your parlay"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Stake (FLR)</label>
        <input
          type="number"
          step="0.01"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="w-full px-4 py-2 bg-flare-dark border border-gray-600 rounded focus:outline-none focus:border-flare-secondary"
          placeholder="e.g., 100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Possible Outcomes (comma-separated)
        </label>
        <input
          type="text"
          value={outcomes}
          onChange={(e) => setOutcomes(e.target.value)}
          className="w-full px-4 py-2 bg-flare-dark border border-gray-600 rounded focus:outline-none focus:border-flare-secondary"
          placeholder="e.g., Win, Loss, Push"
        />
      </div>

      <button
        type="submit"
        disabled={isCreating}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCreating ? "Creating..." : "Create Parlay"}
      </button>
    </form>
  );
}
