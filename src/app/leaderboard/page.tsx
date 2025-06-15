
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { TopThreeItem, type TopThreeItemProps } from "@/components/leaderboard/TopThreeItem";
import { LeaderboardItem } from "@/components/leaderboard/LeaderboardItem";
import { Trophy, Coins, Users, BarChartBig, Loader2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import type { AppUser, LeaderboardEntry as GenericLeaderboardEntry } from "@/app/types"; // Assuming LeaderboardEntry might need AppUser details for avatars
import { useUser } from "@/contexts/UserContext";

interface LeaderboardData {
  top_gold: GenericLeaderboardEntry[];
  top_scores: GenericLeaderboardEntry[]; // Assuming score from Stake Builder
  top_referrals: Array<GenericLeaderboardEntry & { count?: number }>; // Referrals might have a 'count'
}

const rankNames: Record<number, string> = {
  1: "The King/Queen",
  2: "The Duke/Duchess",
  3: "The Baron/Baroness",
};


export default function LeaderboardPage() {
  const { currentUser } = useUser();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch leaderboard: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.data) {
          // Add rank to each list if not present, and ensure points are numbers
          const processEntries = (entries: any[], pointField: string = 'points') => 
            entries.map((entry, index) => ({
              ...entry,
              rank: index + 1,
              points: Number(entry[pointField] || 0),
              avatarUrl: `https://placehold.co/128x128.png?text=${entry.username?.substring(0,2).toUpperCase() || 'P'}`,
              dataAiHint: "avatar person",
            }));
          
          setLeaderboardData({
            top_gold: processEntries(data.data.top_gold || [], 'points'),
            top_scores: processEntries(data.data.top_scores || [], 'points'), // 'points' or 'score'
            top_referrals: processEntries(data.data.top_referrals || [], 'count'), // 'count' for referrals
          });
        } else {
          throw new Error(data.error || 'Leaderboard data format incorrect.');
        }
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching leaderboard:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const renderLeaderboardSection = (
    title: string,
    entries: GenericLeaderboardEntry[],
    pointSuffix: string,
    icon: React.ElementType
  ) => {
    if (!entries || entries.length === 0) {
      return <p className="text-center text-muted-foreground py-8">No data available for {title} yet.</p>;
    }
    const topThree = entries.slice(0, 3);
    const restOfTheList = entries.slice(3);
    const IconComponent = icon;

    return (
      <div className="space-y-8">
        <div className="text-center mb-6">
           <IconComponent className="mx-auto h-10 w-10 text-primary mb-2" />
           <h2 className="font-headline text-2xl font-semibold text-foreground">{title}</h2>
        </div>
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10 items-end px-2 md:px-0">
            {/* Order: 2nd, 1st, 3rd for podium effect */}
            {topThree.find(u => u.rank === 2) && <TopThreeItem {...topThree.find(u => u.rank === 2)!} currency={pointSuffix} rankNameOverride={rankNames[2]} />}
            {topThree.find(u => u.rank === 1) && <TopThreeItem {...topThree.find(u => u.rank === 1)!} currency={pointSuffix} rankNameOverride={rankNames[1]} />}
            {topThree.find(u => u.rank === 3) && <TopThreeItem {...topThree.find(u => u.rank === 3)!} currency={pointSuffix} rankNameOverride={rankNames[3]} />}
          </div>
        )}
        {restOfTheList.length > 0 && (
          <div>
            <h3 className="font-headline text-xl font-semibold text-foreground mb-4 text-center md:text-left">Top Contenders</h3>
            <div className="space-y-3">
              {restOfTheList.map((user) => (
                <LeaderboardItem key={`${title}-${user.rank}-${user.username}`} {...user} currency={pointSuffix} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppShell>
      <div className="container mx-auto px-2 sm:px-4 py-8">
        <div className="text-center mb-10">
          <Trophy className="mx-auto h-16 w-16 text-yellow-400 mb-4 animate-pulse-glow" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Hall of Hustlers</h1>
          <p className="text-lg text-muted-foreground">
            See who's dominating the HustleSoul universe!
          </p>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}
        {error && !isLoading && (
          <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-lg p-6">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
            <p className="text-destructive-foreground font-semibold text-lg">Failed to load leaderboard data.</p>
            <p className="text-destructive-foreground/80 text-sm">{error}</p>
          </div>
        )}
        {!isLoading && !error && leaderboardData && (
          <Tabs defaultValue="gold" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-card">
              <TabsTrigger value="gold" className="text-xs sm:text-sm"><Coins className="mr-1 sm:mr-2 h-4 w-4" />Top Gold</TabsTrigger>
              <TabsTrigger value="scores" className="text-xs sm:text-sm"><BarChartBig className="mr-1 sm:mr-2 h-4 w-4" />Top Scores</TabsTrigger>
              <TabsTrigger value="referrals" className="text-xs sm:text-sm"><Users className="mr-1 sm:mr-2 h-4 w-4" />Top Referrers</TabsTrigger>
            </TabsList>
            <TabsContent value="gold">
              {renderLeaderboardSection("Top Gold Earners", leaderboardData.top_gold, "GOLD", Coins)}
            </TabsContent>
            <TabsContent value="scores">
              {renderLeaderboardSection("Top Game Scores (Stake Builder)", leaderboardData.top_scores, "Points", BarChartBig)}
            </TabsContent>
            <TabsContent value="referrals">
              {renderLeaderboardSection("Top Referrers", leaderboardData.top_referrals, "Referrals", Users)}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
