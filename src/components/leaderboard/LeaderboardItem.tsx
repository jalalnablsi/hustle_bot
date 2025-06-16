
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from '@/lib/utils';

interface LeaderboardItemProps {
  rank: number;
  username: string; 
  points: number; 
  avatarUrl?: string; 
  dataAiHint?: string;
  currency?: string;
}

export function LeaderboardItem({ rank, username, points, avatarUrl, dataAiHint = "avatar person", currency = "Points" }: LeaderboardItemProps) {
  const displayPoints = Number(points) || 0; 

  return (
    <Card className={cn("hover:bg-primary/10 transition-colors duration-200 border-border/50", rank <=3 ? "border-primary/30" : "")}>
      <CardContent className="p-2.5 sm:p-3 flex items-center justify-between space-x-2 sm:space-x-3">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="text-sm sm:text-base font-semibold text-muted-foreground w-4 sm:w-6 text-center">{rank}</span>
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-primary/30">
            <Image 
              src={avatarUrl || `https://placehold.co/96x96.png?text=${username ? username.substring(0, 2).toUpperCase() : 'P'}`} 
              alt={username || 'Player'} 
              layout="fill" 
              objectFit="cover" 
              data-ai-hint={dataAiHint} />
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs sm:text-sm md:text-md truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[180px] md:max-w-xs">{username || 'Anonymous Player'}</p>
            <p className="text-xs sm:text-sm text-primary">{displayPoints.toLocaleString()} {currency}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

    