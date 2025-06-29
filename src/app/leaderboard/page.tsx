
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { TopThreeItem } from "@/components/leaderboard/TopThreeItem";
import { LeaderboardItem } from "@/components/leaderboard/LeaderboardItem";
import { Trophy, Coins, Users, Star, Loader2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import type { LeaderboardEntry as GenericLeaderboardEntry } from "@/app/types";

interface ApiLeaderboardData {
  top_scores: GenericLeaderboardEntry[];
  top_gold: GenericLeaderboardEntry[];
  top_referrals: GenericLeaderboardEntry[];
}

const rankTitles: Record<number, string> = {
  1: "The Sovereign",
  2: "The High Lord/Lady",
  3: "The Vanguard",
};

export default function LeaderboardPage() {
  const [leaderboardData, setLeaderboardData] = useState<ApiLeaderboardData | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const processEntries = useCallback((entries: any[] = [], pointField: string = 'points'): GenericLeaderboardEntry[] => {
    return entries.map((entry, index) => ({
      ...entry,
      rank: entry.rank || index + 1,
      points: Number(entry[pointField] || entry.points || entry.score || entry.count || 0),
      username: entry.username || `User ${entry.id?.slice(-4) || (Math.random() * 1000).toFixed(0)}`,
      avatarUrl: entry.avatarUrl || `https://placehold.co/128x128.png?text=${(entry.username || 'P').substring(0, 2).toUpperCase()}`,
      dataAiHint: "avatar person",
    }));
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoadingApi(true);
    setApiError(null);
    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Failed to parse error from server" }));
        throw new Error(errData.error || `Failed to fetch leaderboard: ${response.status}`);
      }
      const apiResult = await response.json();
      if (apiResult.success && apiResult.data) {
        setLeaderboardData({
          top_gold: processEntries(apiResult.data.top_gold, 'points'),
          top_scores: processEntries(apiResult.data.top_scores, 'points'),
          top_referrals: processEntries(apiResult.data.top_referrals, 'points'),
        });
      } else {
        throw new Error(apiResult.error || 'Leaderboard data format incorrect.');
      }
    } catch (err: any) {
      setApiError(err.message);
      console.error("Error fetching leaderboard:", err);
    } finally {
      setIsLoadingApi(false);
    }
  }, [processEntries]); 

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);
  
  const renderLeaderboardSection = (
    title: string,
    entries: GenericLeaderboardEntry[],
    pointSuffix: string,
    icon: React.ElementType,
  ) => {
    if (isLoadingApi && !leaderboardData) {
        return (
          <div className="flex justify-center items-center py-10 sm:py-20">
            <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading {title}...</p>
          </div>
        );
    }
    
    if (apiError && (!leaderboardData || entries.length === 0)) {
         return (
            <div className="text-center py-6 sm:py-8 bg-destructive/5 border border-destructive/20 rounded-lg">
              <AlertTriangle className="mx-auto h-8 w-8 text-destructive mb-2" />
              <p className="text-destructive/90 mb-1">Could not load {title} data.</p>
              <p className="text-xs text-destructive/70">{apiError}</p>
              <Button onClick={fetchLeaderboard} variant="outline" className="mt-3">Try Again</Button>
            </div>
        );
    }
    if (!isLoadingApi && (!entries || entries.length === 0)) {
      return (
        <div className="text-center py-6 sm:py-8">
          <p className="text-muted-foreground mb-2 sm:mb-3">No data available for {title} yet.</p>
        </div>
      );
    }
    
    const topThree = entries.slice(0, 3);
    const restOfTheList = entries.slice(3, 100);
    const IconComponent = icon;

    const rank1User = topThree.find(u => u.rank === 1);
    const rank2User = topThree.find(u => u.rank === 2);
    const rank3User = topThree.find(u => u.rank === 3);

    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="text-center mb-4 sm:mb-6">
           <IconComponent className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-primary mb-1 sm:mb-2" />
           <h2 className="font-headline text-xl sm:text-2xl font-semibold text-foreground">{title}</h2>
        </div>

        {topThree.length > 0 && (
          <div className="grid grid-cols-3 gap-2 xs:gap-3 sm:gap-4 md:gap-5 mb-6 sm:mb-10 items-end px-1 sm:px-0 relative">
            <div className="col-start-1 flex justify-center order-2 sm:order-1">
              {rank2User && <TopThreeItem {...rank2User} currency={pointSuffix} rankNameOverride={rankTitles[2]} />}
            </div>
            <div className="col-start-2 flex justify-center order-1 sm:order-2 relative z-10">
              {rank1User && <TopThreeItem {...rank1User} currency={pointSuffix} rankNameOverride={rankTitles[1]} />}
            </div>
            <div className="col-start-3 flex justify-center order-3 sm:order-3">
              {rank3User && <TopThreeItem {...rank3User} currency={pointSuffix} rankNameOverride={rankTitles[3]} />}
            </div>
          </div>
        )}

        {restOfTheList.length > 0 && (
          <div>
            <h3 className="font-headline text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4 text-center md:text-left">Top Contenders (4-100)</h3>
            <div className="space-y-2 sm:space-y-3 bg-card p-2 sm:p-3 rounded-lg shadow-md max-h-[500px] sm:max-h-[600px] overflow-y-auto">
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
      <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8">
        <div className="text-center mb-6 sm:mb-10">
          <Trophy className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-yellow-400 mb-3 sm:mb-4 animate-pulse [animation-duration:1.5s] filter drop-shadow-[0_2px_10px_hsl(var(--primary)/0.5)]" />
          <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2">Hall of Hustlers</h1>
          <p className="text-md sm:text-lg text-muted-foreground">
            See who's on top.
          </p>
        </div>

        {isLoadingApi ? (
          <div className="flex justify-center items-center py-10 sm:py-20">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary" />
          </div>
        ) : apiError ? ( 
          <div className="text-center py-8 sm:py-10 bg-destructive/10 border border-destructive rounded-lg p-4 sm:p-6">
            <AlertTriangle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-destructive mb-2 sm:mb-3" />
            <p className="text-destructive-foreground font-semibold text-md sm:text-lg">Failed to load leaderboard data.</p>
            <p className="text-destructive-foreground/80 text-sm">{apiError}</p>
            <Button onClick={fetchLeaderboard} variant="outline" className="mt-4">Try Again</Button>
          </div>
        ) : leaderboardData ? (
          <Tabs defaultValue="gold" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6 bg-card shadow-inner">
              <TabsTrigger value="gold" className="text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 data-[state=active]:text-yellow-400 py-1.5 sm:py-2"><Coins className="h-3 w-3 sm:h-4 sm:w-4" />Richest</TabsTrigger>
              <TabsTrigger value="scores" className="text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 data-[state=active]:text-green-400 py-1.5 sm:py-2"><Star className="h-3 w-3 sm:h-4 sm:w-4" />High Scores</TabsTrigger>
              <TabsTrigger value="referrals" className="text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 data-[state=active]:text-sky-400 py-1.5 sm:py-2"><Users className="h-3 w-3 sm:h-4 sm:w-4" />Top Referrers</TabsTrigger>
            </TabsList>
            <TabsContent value="gold">
              {renderLeaderboardSection("Top Gold Earners", leaderboardData.top_gold, "GOLD", Coins)}
            </TabsContent>
            <TabsContent value="scores">
              {renderLeaderboardSection("Stake Builder Scores", leaderboardData.top_scores, "Points", Star)}
            </TabsContent>
            <TabsContent value="referrals">
              {renderLeaderboardSection("Top Referrers", leaderboardData.top_referrals, "Referrals", Users)}
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </AppShell>
  );
}

    
