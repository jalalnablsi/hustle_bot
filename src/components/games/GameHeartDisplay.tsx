
'use client';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameHeartDisplayProps {
  currentHearts: number;
  maxHearts?: number;
  onWatchAd?: () => void;
  canWatchAd?: boolean;
  nextHeartIn?: string | null; // e.g., "5m 30s" or null if full
  isPlayForFunMode: boolean;
}

export function GameHeartDisplay({
  currentHearts,
  maxHearts = 3,
  onWatchAd,
  canWatchAd = true,
  nextHeartIn,
  isPlayForFunMode,
}: GameHeartDisplayProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-center space-x-1 mb-2">
        {Array.from({ length: maxHearts }).map((_, i) => (
          <Heart
            key={i}
            className={cn(
              "h-6 w-6 transition-all duration-300",
              i < currentHearts ? "text-red-500 fill-red-500 animate-pulse-glow" : "text-muted-foreground/50",
              isPlayForFunMode && "opacity-50"
            )}
          />
        ))}
      </div>
      {isPlayForFunMode ? (
         <p className="text-xs text-center text-muted-foreground">Playing for fun! Hearts are not used.</p>
      ) : currentHearts < maxHearts && nextHeartIn ? (
        <p className="text-xs text-center text-muted-foreground">
          Next heart in: <span className="font-semibold text-primary">{nextHeartIn}</span>
        </p>
      ) : currentHearts === maxHearts ? (
         <p className="text-xs text-center text-green-500">Hearts are full!</p>
      ) : null}
      
      {!isPlayForFunMode && currentHearts < maxHearts && onWatchAd && (
        <button
          onClick={onWatchAd}
          disabled={!canWatchAd}
          className="text-xs text-center w-full mt-2 text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          Watch Ad for an extra Heart
        </button>
      )}
    </div>
  );
}
