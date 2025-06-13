
'use client';

import React from 'react';
import { useArenaStore } from './store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, ChevronLeft } from 'lucide-react';

const LeaderboardDisplay: React.FC = () => {
  const leaderboard = useArenaStore(state => state.leaderboard);
  const setGamePhase = useArenaStore(state => state.setGamePhase);

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card className="shadow-xl bg-card/80">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-yellow-400 mb-2" />
          <CardTitle className="font-headline text-3xl">Arena Champions</CardTitle>
          <CardDescription>Top players of Arena Clash.</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">Wins</TableHead>
                  <TableHead className="text-center">Losses</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow key={entry.rank} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-center">{entry.rank}</TableCell>
                    <TableCell>{entry.playerName}</TableCell>
                    <TableCell className="text-center text-green-500">{entry.wins}</TableCell>
                    <TableCell className="text-center text-red-500">{entry.losses}</TableCell>
                    <TableCell className="text-right font-semibold">{entry.rating}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">The leaderboard is currently empty.</p>
          )}
        </CardContent>
      </Card>
      <Button 
        onClick={() => setGamePhase('character-selection')} 
        variant="outline" 
        className="mt-6 w-full max-w-xs mx-auto flex items-center"
      >
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Game
      </Button>
    </div>
  );
};

export default LeaderboardDisplay;
