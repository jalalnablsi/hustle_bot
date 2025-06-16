
      
import Image from 'next/image';
import { Card } from "@/components/ui/card";
import { CrownIcon } from "@/components/icons/CrownIcon";
import { cn } from "@/lib/utils";

export interface TopThreeItemProps {
  rank: 1 | 2 | 3;
  username: string;
  points: number;
  avatarUrl?: string;
  dataAiHint?: string;
  currency?: string;
  rankNameOverride?: string;
}

const rankStyles = {
  1: { // Sovereign (Gold)
    borderColor: "border-yellow-400",
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-300",
    crownColor: "text-yellow-400 fill-yellow-500/30",
    avatarSize: "w-20 h-20 xs:w-24 xs:h-24", // Adjusted for mobile first
    usernameSize: "text-base xs:text-lg",
    pointsSize: "text-sm xs:text-base",
    scale: "sm:scale-110", // Scale up on larger screens
    shadow: "shadow-xl shadow-yellow-500/40",
    zIndex: "z-10",
    glowClass: "animate-pulse-glow-yellow"
  },
  2: { // High Lord/Lady (Silver)
    borderColor: "border-slate-400",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-300",
    crownColor: "text-slate-400 fill-slate-500/30", // Not used for rank 2
    avatarSize: "w-16 h-16 xs:w-20 xs:h-20",
    usernameSize: "text-sm xs:text-base",
    pointsSize: "text-xs xs:text-sm",
    scale: "sm:scale-105",
    shadow: "shadow-lg shadow-slate-500/20",
    zIndex: "z-0",
    glowClass: "animate-pulse-glow-slate"
  },
  3: { // Vanguard (Bronze)
    borderColor: "border-orange-500",
    bgColor: "bg-orange-600/10",
    textColor: "text-orange-400",
    crownColor: "text-orange-500 fill-orange-600/30", // Not used for rank 3
    avatarSize: "w-16 h-16 xs:w-20 xs:h-20",
    usernameSize: "text-sm xs:text-base",
    pointsSize: "text-xs xs:text-sm",
    scale: "sm:scale-105",
    shadow: "shadow-lg shadow-orange-600/20",
    zIndex: "z-0",
    glowClass: "animate-pulse-glow-orange"
  },
};

export function TopThreeItem({ rank, username, points, avatarUrl, dataAiHint = "avatar person", currency = "Points", rankNameOverride }: TopThreeItemProps) {
  const styles = rankStyles[rank];
  const displayPoints = Number(points) || 0;
  const defaultAvatar = `https://placehold.co/128x128/${rank === 1 ? 'FFD700/000000' : rank === 2 ? 'C0C0C0/000000' : 'CD7F32/000000'}.png?text=${username ? username.substring(0, 2).toUpperCase() : 'P'}&font=montserrat`;

  return (
    <Card className={cn(
      "relative flex flex-col items-center p-2 xs:p-3 text-center transition-all duration-300 transform hover:scale-105 w-full max-w-[150px] xs:max-w-[180px] sm:max-w-xs mx-auto", // Max width for mobile, centered
      styles.borderColor,
      styles.bgColor,
      styles.shadow,
      styles.scale,
      styles.zIndex,
       "border-2" // Ensure border is visible
    )}>
      {rank === 1 && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 xs:-top-3.5 z-20">
          <CrownIcon className={cn("w-6 h-6 xs:w-8 xs:h-8", styles.crownColor)} />
        </div>
      )}
      <div className={cn(
          "relative rounded-full overflow-hidden border-2 sm:border-3 shadow-md",
          styles.borderColor,
          styles.avatarSize,
          "mb-1 xs:mb-1.5 mt-3 xs:mt-4" // Adjust margin for crown
      )}>
        <Image
            src={avatarUrl || defaultAvatar}
            alt={username || 'Player'}
            layout="fill"
            objectFit="cover"
            data-ai-hint={dataAiHint}
            priority={rank <=3}
        />
      </div>
      <h3 className={cn("font-headline font-bold", styles.textColor, styles.usernameSize, "truncate w-full px-0.5")}>{username || 'Anonymous'}</h3>
      <p className={cn("font-semibold", styles.textColor, styles.pointsSize)}>{displayPoints.toLocaleString()} {currency}</p>
      {rankNameOverride && <p className={cn("text-[0.6rem] xs:text-xs font-medium mt-0.5", styles.textColor, "opacity-80")}>{rankNameOverride}</p>}

      <div className={cn(
        "absolute -bottom-1 -right-1 xs:-bottom-1.5 xs:-right-1.5 rounded-full bg-card text-card-foreground font-bold w-5 h-5 xs:w-6 xs:h-6 flex items-center justify-center shadow-lg border text-xs",
        styles.borderColor, styles.textColor
      )}>
        {rank}
      </div>
    </Card>
  );
}

    