import { AppShell } from "@/components/layout/AppShell";
import { TopThreeItem } from "@/components/leaderboard/TopThreeItem";
import { LeaderboardItem } from "@/components/leaderboard/LeaderboardItem";
import { Trophy } from "lucide-react";

// Mock data
const leaderboardData = [
  { rank: 1, name: "CryptoKing", score: 150500, avatarUrl: "https://placehold.co/128x128.png?text=CK" },
  { rank: 2, name: "SoulQueen", score: 120200, avatarUrl: "https://placehold.co/128x128.png?text=SQ" },
  { rank: 3, name: "HustlePro", score: 98750, avatarUrl: "https://placehold.co/128x128.png?text=HP" },
  { rank: 4, name: "AirdropHunter", score: 85000, avatarUrl: "https://placehold.co/128x128.png?text=AH" },
  { rank: 5, name: "TokenMaster", score: 76500, avatarUrl: "https://placehold.co/128x128.png?text=TM" },
  { rank: 6, name: "NFTCollector", score: 65230, avatarUrl: "https://placehold.co/128x128.png?text=NC" },
  { rank: 7, name: "User123", score: 54321, avatarUrl: "https://placehold.co/128x128.png?text=U1" },
  { rank: 8, name: "CoolDude", score: 45890, avatarUrl: "https://placehold.co/128x128.png?text=CD" },
  { rank: 9, name: "ShillMaster", score: 39000, avatarUrl: "https://placehold.co/128x128.png?text=SM" },
  { rank: 10, name: "DiamondHands", score: 32050, avatarUrl: "https://placehold.co/128x128.png?text=DH" },
];

const topThree = leaderboardData.slice(0, 3);
const restOfTheList = leaderboardData.slice(3);

export default function LeaderboardPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Trophy className="mx-auto h-16 w-16 text-yellow-400 mb-4 animate-pulse-glow" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Hall of Hustlers</h1>
          <p className="text-lg text-muted-foreground">
            See who's leading the charge in the HustleSoul community!
          </p>
        </div>

        {/* Top Three Podium */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-12 items-end">
            {topThree.find(u => u.rank === 2) && <TopThreeItem {...topThree.find(u => u.rank === 2)!} />}
            {topThree.find(u => u.rank === 1) && <TopThreeItem {...topThree.find(u => u.rank === 1)!} />}
            {topThree.find(u => u.rank === 3) && <TopThreeItem {...topThree.find(u => u.rank === 3)!} />}
          </div>
        )}
        
        {/* Rest of the Leaderboard */}
        {restOfTheList.length > 0 && (
          <div>
            <h2 className="font-headline text-2xl font-semibold text-foreground mb-6 text-center md:text-left">Top Hustlers</h2>
            <div className="space-y-4">
              {restOfTheList.map((user) => (
                <LeaderboardItem key={user.rank} {...user} />
              ))}
            </div>
          </div>
        )}

        {leaderboardData.length === 0 && (
           <p className="text-center text-muted-foreground text-lg mt-10">The leaderboard is currently empty. Be the first to make your mark!</p>
        )}
      </div>
    </AppShell>
  );
}
