// In-memory storage for parlays (in production, this would be on-chain or in a database)
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

let parlays: Parlay[] = [];

export async function createParlay(data: {
  title: string;
  description: string;
  stake: number;
  outcomes: string[];
  creator: string;
}): Promise<Parlay> {
  const newParlay: Parlay = {
    id: Date.now().toString(),
    ...data,
    status: "active",
    createdAt: new Date(),
  };

  parlays.push(newParlay);
  
  // Simulate blockchain transaction delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  return newParlay;
}

export async function getAllParlays(): Promise<Parlay[]> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return [...parlays].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getParlayById(id: string): Promise<Parlay | null> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  return parlays.find((p) => p.id === id) || null;
}

export async function resolveParlay(
  id: string,
  outcome: string,
  resolver: string
): Promise<Parlay> {
  const parlay = parlays.find((p) => p.id === id);
  
  if (!parlay) {
    throw new Error("Parlay not found");
  }
  
  if (parlay.status !== "active") {
    throw new Error("Parlay is already resolved");
  }
  
  if (parlay.creator.toLowerCase() !== resolver.toLowerCase()) {
    throw new Error("Only the creator can resolve this parlay");
  }
  
  if (!parlay.outcomes.includes(outcome)) {
    throw new Error("Invalid outcome");
  }
  
  // Simulate blockchain transaction delay
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  parlay.status = "resolved";
  parlay.resolvedOutcome = outcome;
  
  return parlay;
}

export async function getParlaysByCreator(creator: string): Promise<Parlay[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  return parlays.filter(
    (p) => p.creator.toLowerCase() === creator.toLowerCase()
  );
}
