'use client';

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { OptimizeAirdropAmountInput, OptimizeAirdropAmountOutput } from '@/ai/flows/optimize-airdrop-amount';
import { Wand2 } from 'lucide-react';

const formSchema = z.object({
  totalCurrencySupply: z.coerce.number().positive().optional(),
  activeUserCount: z.coerce.number().int().positive().optional(),
  dailyRewardBudget: z.coerce.number().positive().optional(),
  referralRewardBudget: z.coerce.number().positive().optional(),
  socialTaskRewardBudget: z.coerce.number().positive().optional(),
  averageTaskCompletionRate: z.coerce.number().min(0).max(1),
  averageReferralsPerUser: z.coerce.number().min(0),
});

type RewardOptimizerFormValues = z.infer<typeof formSchema>;

interface RewardOptimizerFormProps {
  onSubmit: (data: OptimizeAirdropAmountInput) => Promise<void>;
  isLoading: boolean;
}

export function RewardOptimizerForm({ onSubmit, isLoading }: RewardOptimizerFormProps) {
  const form = useForm<RewardOptimizerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      averageTaskCompletionRate: 0.5,
      averageReferralsPerUser: 1.5,
    },
  });

  const handleFormSubmit: SubmitHandler<RewardOptimizerFormValues> = async (data) => {
    // Filter out undefined optional values before submitting
    const submitData: OptimizeAirdropAmountInput = {
        averageTaskCompletionRate: data.averageTaskCompletionRate,
        averageReferralsPerUser: data.averageReferralsPerUser,
    };
    if (data.totalCurrencySupply !== undefined) submitData.totalCurrencySupply = data.totalCurrencySupply;
    if (data.activeUserCount !== undefined) submitData.activeUserCount = data.activeUserCount;
    if (data.dailyRewardBudget !== undefined) submitData.dailyRewardBudget = data.dailyRewardBudget;
    if (data.referralRewardBudget !== undefined) submitData.referralRewardBudget = data.referralRewardBudget;
    if (data.socialTaskRewardBudget !== undefined) submitData.socialTaskRewardBudget = data.socialTaskRewardBudget;
    
    await onSubmit(submitData);
  };

  const formFields = [
    { name: "totalCurrencySupply", label: "Total Currency Supply", description: "Total supply of HustleSoul (Optional, uses defaults if empty)." },
    { name: "activeUserCount", label: "Active User Count", description: "Number of active users (Optional)." },
    { name: "dailyRewardBudget", label: "Daily Reward Budget", description: "Total budget for daily rewards (Optional)." },
    { name: "referralRewardBudget", label: "Referral Reward Budget", description: "Total budget for referral rewards (Optional)." },
    { name: "socialTaskRewardBudget", label: "Social Task Reward Budget", description: "Total budget for social tasks (Optional)." },
    { name: "averageTaskCompletionRate", label: "Avg. Task Completion Rate (0-1)", description: "E.g., 0.6 for 60%." },
    { name: "averageReferralsPerUser", label: "Avg. Referrals Per User", description: "E.g., 2.5." },
  ] as const;


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl text-foreground flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" /> Airdrop Reward Optimizer
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Input current metrics to get AI-powered suggestions for optimal airdrop amounts. 
          Optional fields will use default values from our system if left blank.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formFields.map(fieldInfo => (
                <FormField
                  key={fieldInfo.name}
                  control={form.control}
                  name={fieldInfo.name}
                  render={({ field }) => (
                    <FormItem className={fieldInfo.name === 'averageTaskCompletionRate' || fieldInfo.name === 'averageReferralsPerUser' ? 'md:col-span-1' : 'md:col-span-1'}>
                      <FormLabel className="text-foreground">{fieldInfo.label}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder={fieldInfo.name.includes("Rate") ? "e.g., 0.5" : fieldInfo.name.includes("User") ? "e.g., 1000" : "e.g., 100000"} {...field} step="any" />
                      </FormControl>
                      <FormDescription>{fieldInfo.description}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full" size="lg">
              {isLoading ? 'Optimizing...' : 'Get Suggestions'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
