
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { TopThreeItem } from "@/components/leaderboard/TopThreeItem";
import { LeaderboardItem } from "@/components/leaderboard/LeaderboardItem";
import { Trophy, Coins, Users, Star, Loader2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEffect, useState } from "react";
import type { LeaderboardEntry as GenericLeaderboardEntry } from "@/app/types";
import { useUser } from "@/contexts/UserContext";

interface ApiLeaderboardData {
  top_scores: GenericLeaderboardEntry[];
  top_gold: GenericLeaderboardEntry[];
  top_referrals: GenericLeaderboardEntry[];
  user_rank: {
    gold: number;
    referrals: number;
    scores: number;
    scoreValue?: number;
  };
}

const rankNames: Record<number, string> = {
  1: "The Sovereign",
  2: "The High Lord/Lady",
  3: "The Vanguard",
};

function formatUserRank(rank: number | undefined | null): string {
  if (rank === undefined || rank === null || rank <= 0) return "N/A";
  if (rank > 100) return "100+";
  return rank.toString();
}

export default function LeaderboardPage() {
  const { currentUser } = useUser();
  const [leaderboardData, setLeaderboardData] = useState<ApiLeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Failed to parse error from server" }));
          throw new Error(errData.error || `Failed to fetch leaderboard: ${response.status}`);
        }
        const apiResult = await response.json();
        if (apiResult.success && apiResult.data) {
          const processEntries = (entries: any[], pointField: string = 'points') =>
            (entries || []).map((entry, index) => ({
              ...entry,
              rank: entry.rank || index + 1, // Use provided rank or calculate
              points: Number(entry[pointField] || entry.points || entry.score || entry.count || 0),
              username: entry.username || entry.users?.username || `User ${entry.user_id?.slice(-4) || (Math.random() * 1000).toFixed(0)}`,
              avatarUrl: `https://placehold.co/128x128.png?text=${(entry.username || entry.users?.username || 'P').substring(0, 2).toUpperCase()}`,
              dataAiHint: "avatar person",
            }));
          
          setLeaderboardData({
            top_gold: processEntries(apiResult.data.top_gold, 'points'), // API returns points as string for gold, Number() handles it
            top_scores: processEntries(apiResult.data.top_scores, 'points'),
            top_referrals: processEntries(apiResult.data.top_referrals, 'points'), // API uses 'points' for referral count
            user_rank: apiResult.data.user_rank || { gold: 0, referrals: 0, scores: 0, scoreValue: 0 },
          });

        } else {
          throw new Error(apiResult.error || 'Leaderboard data format incorrect.');
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

  const UserRankDisplay = ({ category, rank, score }: { category: string; rank: number | null | undefined; score?: number | null | undefined}) => (
    <Card className="bg-primary/10 border-primary/30 shadow-md my-4">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold text-primary/90">Your Rank in {category}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <p className="text-2xl font-bold text-foreground">{formatUserRank(rank)}</p>
        {(score !== undefined && score !== null && score > 0) && <p className="text-xs text-muted-foreground">Value: {score.toLocaleString()}</p>}
      </CardContent>
    </Card>
  );

  const renderLeaderboardSection = (
    title: string,
    entries: GenericLeaderboardEntry[],
    pointSuffix: string,
    icon: React.ElementType,
    userRankValue?: number | null,
    userScoreValue?: number | null
  ) => {
    if (isLoading) {
        return (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        );
    }
    if (!entries || entries.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-3">No data available for {title} yet.</p>
          {currentUser && userRankValue !== undefined && <UserRankDisplay category={title} rank={userRankValue} score={userScoreValue} />}
        </div>
      );
    }
    const topThree = entries.slice(0, 3);
    const restOfTheList = entries.slice(3, 100); // Limit to top 100 display
    const IconComponent = icon;

    return (
      <div className="space-y-8">
        <div className="text-center mb-6">
           <IconComponent className="mx-auto h-10 w-10 text-primary mb-2" />
           <h2 className="font-headline text-2xl font-semibold text-foreground">{title}</h2>
        </div>

        {currentUser && userRankValue !== undefined && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
             <UserRankDisplay category={title} rank={userRankValue} score={userScoreValue} />
          </div>
        )}

        {topThree.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10 items-end px-2 md:px-0">
            {topThree.find(u => u.rank === 2) && <TopThreeItem {...topThree.find(u => u.rank === 2)!} currency={pointSuffix} rankNameOverride={rankNames[2]} />}
            {topThree.find(u => u.rank === 1) && <TopThreeItem {...topThree.find(u => u.rank === 1)!} currency={pointSuffix} rankNameOverride={rankNames[1]} />}
            {topThree.find(u => u.rank === 3) && <TopThreeItem {...topThree.find(u => u.rank === 3)!} currency={pointSuffix} rankNameOverride={rankNames[3]} />}
          </div>
        )}

        {restOfTheList.length > 0 && (
          <div>
            <h3 className="font-headline text-xl font-semibold text-foreground mb-4 text-center md:text-left">Top Contenders (4-100)</h3>
            <div className="space-y-3 bg-card p-2 sm:p-4 rounded-lg shadow-md max-h-[600px] overflow-y-auto">
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
          <Trophy className="mx-auto h-16 w-16 text-yellow-400 mb-4 animate-pulse [animation-duration:1.5s] filter drop-shadow-[0_2px_10px_hsl(var(--primary)/0.5)]" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Hall of Hustlers</h1>
          <p className="text-lg text-muted-foreground">
            See where you stand among the elite.
          </p>
        </div>

        {isLoading && !leaderboardData && (
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
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-card shadow-inner">
              <TabsTrigger value="gold" className="text-xs sm:text-sm flex items-center gap-1.5 data-[state=active]:text-yellow-400"><Coins className="h-4 w-4" />Richest</TabsTrigger>
              <TabsTrigger value="scores" className="text-xs sm:text-sm flex items-center gap-1.5 data-[state=active]:text-green-400"><Star className="h-4 w-4" />High Scores</TabsTrigger>
              <TabsTrigger value="referrals" className="text-xs sm:text-sm flex items-center gap-1.5 data-[state=active]:text-sky-400"><Users className="h-4 w-4" />Top Referrers</TabsTrigger>
            </TabsList>
            <TabsContent value="gold">
              {renderLeaderboardSection("Top Gold Earners", leaderboardData.top_gold, "GOLD", Coins, leaderboardData.user_rank.gold, Number(currentUser?.gold_points))}
            </TabsContent>
            <TabsContent value="scores">
              {renderLeaderboardSection("Stake Builder Scores", leaderboardData.top_scores, "Points", Star, leaderboardData.user_rank.scores, leaderboardData.user_rank.scoreValue)}
            </TabsContent>
            <TabsContent value="referrals">
              {renderLeaderboardSection("Top Referrers", leaderboardData.top_referrals, "Referrals", Users, leaderboardData.user_rank.referrals, currentUser?.referrals_made)}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
