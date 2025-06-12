
import { AppShell } from "@/components/layout/AppShell";
import { Gamepad2 } from "lucide-react";
import { TowerBuilderGamePlaceholder } from "@/components/games/TowerBuilderGamePlaceholder";
import { QuickTapGamePlaceholder } from "@/components/games/QuickTapGamePlaceholder";
import { BallJumpGamePlaceholder } from "@/components/games/BallJumpGamePlaceholder";
import { Game2048Placeholder } from "@/components/games/Game2048Placeholder";

export default function GamesPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Gamepad2 className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Game Arena</h1>
          <p className="text-lg text-muted-foreground">
            Play exciting games, challenge yourself, and earn rewards!
          </p>
        </div>

        {/* Our Games Section */}
        <section className="mb-12">
          <h2 className="font-headline text-2xl md:text-3xl font-semibold text-center text-primary mb-8">Our Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <TowerBuilderGamePlaceholder />
            <QuickTapGamePlaceholder />
            <BallJumpGamePlaceholder />
            <Game2048Placeholder />
          </div>
        </section>

        {/* Game Hub has been removed from here as per your request. 
            Please let me know where you'd like to place the Game Hub (e.g., as a side button or in different navigation)
            and I can help implement that.
        */}
      </div>
    </AppShell>
  );
}
