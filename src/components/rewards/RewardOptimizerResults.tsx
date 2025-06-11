
import type { OptimizeAirdropAmountOutput } from '@/ai/flows/optimize-airdrop-amount';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, TrendingUp, Users, ListChecks } from 'lucide-react';

interface RewardOptimizerResultsProps {
  results: OptimizeAirdropAmountOutput;
}

export function RewardOptimizerResults({ results }: RewardOptimizerResultsProps) {
  const { suggestedDailyRewardAmount, suggestedReferralRewardAmount, suggestedSocialTaskRewardAmount, analysis } = results;

  const resultItems = [
    { label: "Daily Reward", value: suggestedDailyRewardAmount, icon: TrendingUp },
    { label: "Referral Reward", value: suggestedReferralRewardAmount, icon: Users },
    { label: "Social Task Reward", value: suggestedSocialTaskRewardAmount, icon: ListChecks },
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8 shadow-xl animate-in fade-in zoom-in-95">
      <CardHeader>
        <CardTitle className="font-headline text-2xl text-foreground flex items-center gap-2">
          <CheckCircle className="h-7 w-7 text-green-500" /> Optimization Results
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          AI-powered suggestions for your HustleSoul airdrop strategy. (Amounts in GOLD)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resultItems.map(item => (
            <Card key={item.label} className="bg-card-foreground/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <item.icon className="h-5 w-5 text-primary" />
                <h4 className="text-sm font-semibold text-muted-foreground">{item.label}</h4>
              </div>
              <p className="font-headline text-2xl font-bold text-foreground">{item.value.toLocaleString()} GOLD</p>
            </Card>
          ))}
        </div>
        
        <div>
          <h4 className="font-semibold text-lg text-foreground mb-2">Analysis:</h4>
          <div className="prose prose-sm prose-invert max-w-none p-4 bg-muted/50 rounded-md text-foreground/90">
            {analysis.split('\\n').map((paragraph, index) => ( // Handle escaped newlines if Genkit returns them
              paragraph.split('\n').map((subParagraph, subIndex) => ( // Also handle regular newlines
                <p key={`${index}-${subIndex}`}>{subParagraph}</p>
              ))
            )).flat()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
