
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";

interface LeaderboardItemProps {
  rank: number;
  name: string;
  score: number;
  avatarUrl: string;
  dataAiHint?: string;
  currency?: string;
}

export function LeaderboardItem({ rank, name, score, avatarUrl, dataAiHint = "avatar person", currency = "GOLD" }: LeaderboardItemProps) {
  return (
    <Card className="hover:bg-primary/10 transition-colors duration-200">
      <CardContent className="p-4 flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4">
          <span className="text-lg font-semibold text-muted-foreground w-6 text-center">{rank}</span>
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-primary/50">
            <Image src={avatarUrl} alt={name} layout="fill" objectFit="cover" data-ai-hint={dataAiHint} />
          </div>
          <div>
            <p className="font-semibold text-foreground text-md">{name}</p>
            <p className="text-sm text-primary">{score.toLocaleString()} {currency}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
