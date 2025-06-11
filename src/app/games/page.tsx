import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2 } from "lucide-react";

export default function GamesPage() {
  // Placeholder game URL, replace with actual embeddable game links
  const gameUrl = "https://html5games.com/Game/Bloxorz/e13337d1-f808-4178-9a3e-10f56f916848";

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Gamepad2 className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Game Oasis</h1>
          <p className="text-lg text-muted-foreground">
            Play fun games and potentially earn SOUL tokens! More games coming soon.
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground">Bloxorz</CardTitle>
            <CardDescription className="text-muted-foreground">A classic puzzle game. Navigate the block to the hole.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full rounded-lg overflow-hidden border-2 border-primary/30">
              <iframe
                src={gameUrl}
                title="External Game - Bloxorz"
                className="w-full h-full"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups" // Adjust sandbox attributes as needed for the game
              ></iframe>
            </div>
             <p className="text-xs text-muted-foreground text-center mt-4">
              Note: Games are provided by third parties. HustleSoul is not responsible for their content or functionality.
            </p>
          </CardContent>
        </Card>
        
        {/* Placeholder for more games */}
        {/* <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
                <CardHeader><CardTitle>Another Game</CardTitle></CardHeader>
                <CardContent><p>Coming Soon!</p></CardContent>
            </Card>
        </div> */}
      </div>
    </AppShell>
  );
}
