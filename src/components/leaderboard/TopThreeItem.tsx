import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { CrownIcon } from "@/components/icons/CrownIcon";
import { cn } from "@/lib/utils";

interface TopThreeItemProps {
  rank: 1 | 2 | 3;
  name: string;
  score: number;
  avatarUrl: string;
}

const rankStyles = {
  1: {
    borderColor: "border-yellow-400",
    bgColor: "bg-yellow-400/10",
    textColor: "text-yellow-400",
    crownColor: "text-yellow-400",
    size: "w-24 h-24 md:w-32 md:h-32",
    textSize: "text-xl md:text-2xl",
    scoreSize: "text-lg md:text-xl",
  },
  2: {
    borderColor: "border-slate-400",
    bgColor: "bg-slate-400/10",
    textColor: "text-slate-300",
    crownColor: "text-slate-400",
    size: "w-20 h-20 md:w-28 md:h-28",
    textSize: "text-lg md:text-xl",
    scoreSize: "text-md md:text-lg",
  },
  3: {
    borderColor: "border-orange-400",
    bgColor: "bg-orange-400/10",
    textColor: "text-orange-300",
    crownColor: "text-orange-400",
    size: "w-16 h-16 md:w-24 md:h-24",
    textSize: "text-md md:text-lg",
    scoreSize: "text-sm md:text-md",
  },
};

export function TopThreeItem({ rank, name, score, avatarUrl }: TopThreeItemProps) {
  const styles = rankStyles[rank];

  return (
    <Card className={cn(
      "relative flex flex-col items-center p-4 md:p-6 text-center shadow-2xl transition-all duration-300 transform hover:scale-105",
      styles.borderColor,
      styles.bgColor,
      rank === 1 ? "md:-translate-y-8" : "md:mt-4" // Elevate 1st place more on md+
    )}>
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <CrownIcon className={cn("w-8 h-8 md:w-10 md:h-10", styles.crownColor)} />
      </div>
      <div className={cn("relative rounded-full overflow-hidden border-4", styles.borderColor, styles.size, "mb-3 md:mb-4")}>
        <Image src={avatarUrl} alt={name} layout="fill" objectFit="cover" data-ai-hint="avatar person" />
      </div>
      <h3 className={cn("font-headline font-bold", styles.textColor, styles.textSize)}>{name}</h3>
      <p className={cn("font-semibold", styles.textColor, styles.scoreSize)}>{score.toLocaleString()} SOUL</p>
      <div className={cn("absolute -bottom-3 -right-3 rounded-full bg-primary text-primary-foreground font-bold text-lg w-10 h-10 flex items-center justify-center shadow-lg", styles.textSize, styles.crownColor)}>
        {rank}
      </div>
    </Card>
  );
}
