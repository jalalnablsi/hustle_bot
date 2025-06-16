
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from '@/lib/utils';

interface LeaderboardItemProps {
  rank: number;
  username: string; // Changed from name to username to match API
  points: number; // Changed from score to points
  avatarUrl?: string; // Kept optional
  dataAiHint?: string;
  currency?: string;
}

export function LeaderboardItem({ rank, username, points, avatarUrl = "https://placehold.co/128x128.png?text=P", dataAiHint = "avatar person", currency = "Points" }: LeaderboardItemProps) {
  const displayPoints = Number(points) || 0; // Ensure points is a number, default to 0

  return (
    <Card className={cn("hover:bg-primary/10 transition-colors duration-200", rank <=3 ? "border-primary/30" : "")}>
      <CardContent className="p-3 sm:p-4 flex items-center justify-between space-x-3 sm:space-x-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <span className="text-base sm:text-lg font-semibold text-muted-foreground w-5 sm:w-6 text-center">{rank}</span>
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-primary/50">
            <Image 
              src={avatarUrl || `https://placehold.co/128x128.png?text=${username ? username.substring(0, 2).toUpperCase() : 'P'}`} 
              alt={username || 'Player'} 
              layout="fill" 
              objectFit="cover" 
              data-ai-hint={dataAiHint} />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm sm:text-md truncate max-w-[150px] sm:max-w-[200px]">{username || 'Anonymous Player'}</p>
            <p className="text-xs sm:text-sm text-primary">{displayPoints.toLocaleString()} {currency}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
