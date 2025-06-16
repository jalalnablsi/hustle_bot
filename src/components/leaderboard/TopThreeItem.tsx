
import Image from 'next/image';
import { Card } from "@/components/ui/card";
import { CrownIcon } from "@/components/icons/CrownIcon";
import { cn } from "@/lib/utils";

export interface TopThreeItemProps {
  rank: 1 | 2 | 3;
  username: string;
  points: number;
  avatarUrl: string;
  dataAiHint?: string;
  currency?: string;
  rankNameOverride?: string;
}

const rankStyles = {
  1: {
    borderColor: "border-yellow-400",
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-300",
    crownColor: "text-yellow-400 fill-yellow-500/30",
    size: "w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32",
    textSize: "text-md sm:text-lg md:text-xl",
    scoreSize: "text-sm sm:text-md md:text-lg",
    order: "sm:order-2", 
    scale: "sm:scale-110", 
    translateY: "sm:-translate-y-4 md:-translate-y-6",
  },
  2: {
    borderColor: "border-slate-400",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-300",
    crownColor: "text-slate-400 fill-slate-500/30",
    size: "w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28",
    textSize: "text-sm sm:text-md md:text-lg",
    scoreSize: "text-xs sm:text-sm md:text-md",
    order: "sm:order-1",
    scale: "sm:scale-100",
    translateY: "sm:mt-4 md:mt-6",
  },
  3: {
    borderColor: "border-orange-500",
    bgColor: "bg-orange-600/10",
    textColor: "text-orange-400",
    crownColor: "text-orange-500 fill-orange-600/30",
    size: "w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28",
    textSize: "text-sm sm:text-md md:text-lg",
    scoreSize: "text-xs sm:text-sm md:text-md",
    order: "sm:order-3",
    scale: "sm:scale-100",
    translateY: "sm:mt-4 md:mt-6",
  },
};

export function TopThreeItem({ rank, username, points, avatarUrl, dataAiHint = "avatar person", currency = "Points", rankNameOverride }: TopThreeItemProps) {
  const styles = rankStyles[rank];
  const displayPoints = points || 0;

  return (
    <Card className={cn(
      "relative flex flex-col items-center p-2 sm:p-3 md:p-4 text-center shadow-xl transition-all duration-300 transform hover:scale-105",
      styles.borderColor,
      styles.bgColor,
      styles.order,
      styles.scale,
      rank === 1 ? styles.translateY + " z-10" : styles.translateY
    )}>
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 sm:-top-3.5 md:-top-4">
        <CrownIcon className={cn("w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9", styles.crownColor)} />
      </div>
      <div className={cn("relative rounded-full overflow-hidden border-2 sm:border-4 shadow-md", styles.borderColor, styles.size, "mb-1 sm:mb-2 md:mb-3")}>
        <Image 
            src={avatarUrl || `https://placehold.co/128x128.png?text=${username ? username.substring(0,1).toUpperCase() : 'P'}`} 
            alt={username || 'Player'} 
            layout="fill" 
            objectFit="cover" 
            data-ai-hint={dataAiHint}
            priority={rank <=3} // Prioritize loading images for top 3
        />
      </div>
      <h3 className={cn("font-headline font-bold", styles.textColor, styles.textSize, "truncate w-full px-0.5 sm:px-1")}>{username || 'Anonymous'}</h3>
      <p className={cn("font-semibold", styles.textColor, styles.scoreSize)}>{displayPoints.toLocaleString()} {currency}</p>
      {rankNameOverride && <p className={cn("text-xs font-medium mt-0.5", styles.textColor, "opacity-80")}>{rankNameOverride}</p>}
      
      <div className={cn(
        "absolute -bottom-2 -right-2 sm:-bottom-2.5 sm:-right-2.5 rounded-full bg-card text-card-foreground font-bold w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center shadow-lg border-2",
        styles.borderColor, styles.textColor, "text-xs sm:text-sm md:text-base"
      )}>
        {rank}
      </div>
    </Card>
  );
}

    