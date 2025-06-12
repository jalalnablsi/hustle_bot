
import { AppShell } from "@/components/layout/AppShell";
import { Gamepad2, Layers } from "lucide-react"; // Added Layers for SkyHighStacker
import { QuickTapGamePlaceholder } from "@/components/games/QuickTapGamePlaceholder";
import { BallJumpGamePlaceholder } from "@/components/games/BallJumpGamePlaceholder";
import { Game2048Placeholder } from "@/components/games/Game2048Placeholder";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Image from 'next/image';


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
            {/* Sky High Stacker Card - Links to new page */}
            <Card className="shadow-lg hover:shadow-primary/40 transition-shadow duration-300 flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Layers className="h-8 w-8 text-primary flex-shrink-0" />
                  <CardTitle className="font-headline text-xl text-foreground">Sky High Stacker</CardTitle>
                </div>
                <CardDescription className="text-sm text-muted-foreground h-12 overflow-hidden">
                  Stack blocks precisely! Tap to drop the moving block. Perfect stacks earn GOLD, streaks earn DIAMONDS.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col items-center justify-center">
                <div className="w-full aspect-video bg-muted rounded-md mb-4 overflow-hidden relative">
                  <Image 
                    src="https://placehold.co/600x400.png?text=Sky+High+Stacker" 
                    alt="Sky High Stacker Game" 
                    layout="fill" 
                    objectFit="cover" 
                    data-ai-hint="stacking blocks tower game" 
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/games/sky-high-stacker" passHref className="w-full">
                  <Button asChild size="lg" className="w-full">
                    <a>Play Game</a>
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <QuickTapGamePlaceholder />
            <BallJumpGamePlaceholder />
            <Game2048Placeholder />
          </div>
        </section>

      </div>
    </AppShell>
  );
}
