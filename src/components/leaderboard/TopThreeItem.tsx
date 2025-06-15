
import Image from 'next/image';
import { Card } from "@/components/ui/card"; // CardContent not needed for this layout
import { CrownIcon } from "@/components/icons/CrownIcon";
import { cn } from "@/lib/utils";

export interface TopThreeItemProps {
  rank: 1 | 2 | 3;
  username: string;
  points: number;
  avatarUrl: string;
  dataAiHint?: string;
  currency?: string;
  rankNameOverride?: string; // e.g., "The King"
}

const rankStyles = {
  1: {
    borderColor: "border-yellow-400",
    bgColor: "bg-yellow-500/10", // More vibrant gold
    textColor: "text-yellow-300", // Brighter yellow
    crownColor: "text-yellow-400 fill-yellow-500/30",
    size: "w-24 h-24 md:w-32 md:h-32",
    textSize: "text-lg md:text-xl",
    scoreSize: "text-md md:text-lg",
    order: "md:order-2", // Center item for podium
    scale: "md:scale-110", // Make 1st place slightly larger
  },
  2: {
    borderColor: "border-slate-400",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-300",
    crownColor: "text-slate-400 fill-slate-500/30",
    size: "w-20 h-20 md:w-28 md:h-28",
    textSize: "text-md md:text-lg",
    scoreSize: "text-sm md:text-md",
    order: "md:order-1",
    scale: "md:scale-100",
  },
  3: {
    borderColor: "border-orange-500", // Bronze/Orange
    bgColor: "bg-orange-600/10",
    textColor: "text-orange-400",
    crownColor: "text-orange-500 fill-orange-600/30",
    size: "w-20 h-20 md:w-28 md:h-28", // Same as 2nd for symmetry
    textSize: "text-md md:text-lg",
    scoreSize: "text-sm md:text-md",
    order: "md:order-3",
    scale: "md:scale-100",
  },
};

export function TopThreeItem({ rank, username, points, avatarUrl, dataAiHint = "avatar person", currency = "Points", rankNameOverride }: TopThreeItemProps) {
  const styles = rankStyles[rank];

  return (
    <Card className={cn(
      "relative flex flex-col items-center p-3 md:p-4 text-center shadow-xl transition-all duration-300 transform hover:scale-105",
      styles.borderColor,
      styles.bgColor,
      styles.order,
      styles.scale,
      rank === 1 ? "md:-translate-y-6 z-10" : "md:mt-6" // Elevate 1st place
    )}>
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 md:-top-4">
        <CrownIcon className={cn("w-7 h-7 md:w-9 md:h-9", styles.crownColor)} />
      </div>
      <div className={cn("relative rounded-full overflow-hidden border-4 shadow-md", styles.borderColor, styles.size, "mb-2 md:mb-3")}>
        <Image src={avatarUrl} alt={username} layout="fill" objectFit="cover" data-ai-hint={dataAiHint} />
      </div>
      <h3 className={cn("font-headline font-bold", styles.textColor, styles.textSize, "truncate w-full px-1")}>{username}</h3>
      <p className={cn("font-semibold", styles.textColor, styles.scoreSize)}>{points.toLocaleString()} {currency}</p>
      {rankNameOverride && <p className={cn("text-xs font-medium mt-0.5", styles.textColor, "opacity-80")}>{rankNameOverride}</p>}
      
      <div className={cn(
        "absolute -bottom-2.5 -right-2.5 rounded-full bg-card text-card-foreground font-bold w-8 h-8 md:w-9 md:h-9 flex items-center justify-center shadow-lg border-2",
        styles.borderColor, styles.textSize, styles.textColor, "text-sm md:text-base"
      )}>
        {rank}
      </div>
    </Card>
  );
}
