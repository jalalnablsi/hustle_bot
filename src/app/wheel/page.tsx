import { AppShell } from "@/components/layout/AppShell";
import { FortuneWheelClient } from "@/components/wheel/FortuneWheelClient";
import { Zap } from "lucide-react";

export default function WheelPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 flex flex-col items-center">
        <div className="text-center mb-10">
          <Zap className="mx-auto h-16 w-16 text-yellow-400 mb-4 animate-pulse-glow" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Wheel of Fortune</h1>
          <p className="text-lg text-muted-foreground">
            Spin the wheel daily for a chance to win awesome SOUL prizes!
          </p>
        </div>
        
        <FortuneWheelClient />
      </div>
    </AppShell>
  );
}
