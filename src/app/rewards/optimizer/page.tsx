'use client';

import { useState } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { RewardOptimizerForm } from "@/components/rewards/RewardOptimizerForm";
import { RewardOptimizerResults } from "@/components/rewards/RewardOptimizerResults";
import { getAirdropOptimization } from './actions';
import type { OptimizeAirdropAmountInput, OptimizeAirdropAmountOutput } from '@/ai/flows/optimize-airdrop-amount';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RewardOptimizerPage() {
  const [results, setResults] = useState<OptimizeAirdropAmountOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: OptimizeAirdropAmountInput) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    const response = await getAirdropOptimization(data);
    if ('error' in response) {
      setError(response.error);
    } else {
      setResults(response);
    }
    setIsLoading(false);
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <RewardOptimizerForm onSubmit={handleSubmit} isLoading={isLoading} />
        {isLoading && (
          <div className="w-full max-w-2xl mx-auto mt-8 space-y-4">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-8 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="w-full max-w-2xl mx-auto mt-8">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Optimization Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {results && !isLoading && <RewardOptimizerResults results={results} />}
      </div>
    </AppShell>
  );
}
