
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Image from 'next/image';
import { Swords } from "lucide-react";

export default function GamesPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Swords className="mx-auto h-16 w-16 text-primary mb-4 animate-pulse-glow" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Arena Clash</h1>
          <p className="text-lg text-muted-foreground">
            Enter the arena, choose your champion, and battle for glory!
          </p>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-md shadow-xl hover:shadow-primary/40 transition-shadow duration-300">
            <CardHeader className="text-center">
              <CardTitle className="font-headline text-2xl text-primary">Join the Battle!</CardTitle>
              <CardDescription>
                A turn-based multiplayer arena awaits.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              <div className="w-full aspect-video bg-muted rounded-md mb-4 overflow-hidden relative">
                <Image 
                  src="https://placehold.co/600x400.png?text=Arena+Clash" 
                  alt="Arena Clash Game" 
                  layout="fill" 
                  objectFit="cover" 
                  data-ai-hint="fantasy battle arena" 
                />
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Featuring 4 unique classes, strategic combat, and character progression.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/games/arena-clash" passHref className="w-full">
                <Button size="lg" className="w-full font-headline text-lg py-3">
                  Play Arena Clash
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
        
      </div>
    </AppShell>
  );
}
