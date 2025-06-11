
import { AppShell } from "@/components/layout/AppShell";
import { UserBalanceCard } from "@/components/dashboard/UserBalanceCard";
import { DailyRewardCard } from "@/components/dashboard/DailyRewardCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="font-headline text-4xl font-bold text-foreground mb-2">
            Welcome to HustleSoul!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your hub for earning GOLD & DIAMOND tokens. Complete tasks, refer friends, and engage daily.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UserBalanceCard />
          </div>
          <div>
            <DailyRewardCard />
          </div>
        </div>
        
        <div>
          <h2 className="font-headline text-2xl font-semibold text-foreground mb-4 mt-8">Quick Actions</h2>
          <QuickActionGrid />
        </div>

        <Card className="mt-8 bg-card/50">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Announcements</CardTitle>
            <CardDescription>Latest updates from the HustleSoul team.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No new announcements right now. Stay tuned!</p>
            {/* Example of an announcement item */}
            {/* <div className="mt-4 p-3 bg-primary/10 rounded-md border border-primary/20">
              <h3 className="font-semibold text-primary">New Game Added!</h3>
              <p className="text-sm text-foreground/80">Check out "Crypto Runner" in the Games section and earn bonus GOLD!</p>
            </div> */}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
