import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "lucide-react";

export function UserBalanceCard() {
  // Mock data
  const balance = 1250;
  const currencySymbol = "SOUL";

  return (
    <Card className="shadow-lg hover:shadow-primary/50 transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Your Balance</CardTitle>
        <Coins className="h-6 w-6 text-yellow-400" />
      </CardHeader>
      <CardContent>
        <div className="font-headline text-4xl font-bold text-foreground">
          {balance.toLocaleString()} <span className="text-2xl text-primary">{currencySymbol}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Keep hustling to earn more!
        </p>
      </CardContent>
    </Card>
  );
}
