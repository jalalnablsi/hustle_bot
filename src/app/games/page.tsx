
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Layers, Zap, ArrowUpCircle, Puzzle } from "lucide-react";
import { TowerBuilderGamePlaceholder } from "@/components/games/TowerBuilderGamePlaceholder";
import { QuickTapGamePlaceholder } from "@/components/games/QuickTapGamePlaceholder";
import { BallJumpGamePlaceholder } from "@/components/games/BallJumpGamePlaceholder";
import { Game2048Placeholder } from "@/components/games/Game2048Placeholder";

export default function GamesPage() {
  const externalGameUrl = "https://html5games.com/Game/Bloxorz/e13337d1-f808-4178-9a3e-10f56f916848";

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

        {/* Game Hub Section */}
        <section>
          <h2 className="font-headline text-2xl md:text-3xl font-semibold text-center text-accent mb-8">Game Hub</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <Card className="shadow-xl hover:shadow-accent/30 transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-xl text-foreground">Bloxorz</CardTitle>
                <CardDescription className="text-muted-foreground">A classic puzzle game. Navigate the block to the hole.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full rounded-lg overflow-hidden border-2 border-primary/30">
                  <iframe
                    src={externalGameUrl}
                    title="External Game - Bloxorz"
                    className="w-full h-full"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  ></iframe>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Note: Games are provided by third parties. HustleSoul is not responsible for their content or functionality.
                </p>
              </CardContent>
            </Card>
            {/* Add more external games here if needed */}
             <Card className="shadow-xl hover:shadow-accent/30 transition-shadow duration-300 flex flex-col items-center justify-center min-h-[300px] bg-card">
                <CardHeader className="text-center">
                    <Gamepad2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <CardTitle className="font-headline text-xl text-foreground">More Games Coming Soon!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Stay tuned for new additions to the Game Hub.</p>
                </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
