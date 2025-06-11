'use server';

import { optimizeAirdropAmount, type OptimizeAirdropAmountInput, type OptimizeAirdropAmountOutput } from '@/ai/flows/optimize-airdrop-amount';

export async function getAirdropOptimization(
  input: OptimizeAirdropAmountInput
): Promise<OptimizeAirdropAmountOutput | { error: string }> {
  try {
    const result = await optimizeAirdropAmount(input);
    return result;
  } catch (error) {
    console.error("Error optimizing airdrop amount:", error);
    return { error: error instanceof Error ? error.message : "An unknown error occurred." };
  }
}
