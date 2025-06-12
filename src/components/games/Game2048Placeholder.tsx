
'use client';
import { Puzzle, Coins, Gem } from "lucide-react";
import { GameCardWrapper } from "./GameCardWrapper";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const GRID_SIZE = 4;

type Tile = number | null;
type Grid = Tile[][];

const initialGrid = (): Grid => Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

const addRandomTile = (grid: Grid): Grid => {
  let emptyTiles: { r: number; c: number }[] = [];
  grid.forEach((row, r) => row.forEach((tile, c) => {
    if (tile === null) emptyTiles.push({ r, c });
  }));
  if (emptyTiles.length === 0) return grid;
  const { r, c } = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
};

// Basic 2048 move logic (highly simplified for placeholder)
const moveTiles = (grid: Grid, direction: 'left' | 'right' | 'up' | 'down'): { newGrid: Grid; moved: boolean; scoreAdded: number; newDoublings: number } => {
  // This is a very simplified version. Real 2048 logic is more complex.
  let newGrid = grid.map(row => [...row]);
  let moved = false;
  let scoreAdded = 0;
  let newDoublings = 0;

  // Simulate a move: just shift non-null tiles and merge if adjacent are same
  // For 'left' direction example:
  if (direction === 'left') {
    for (let r = 0; r < GRID_SIZE; r++) {
      let currentRow = newGrid[r].filter(tile => tile !== null);
      let mergedRow: Tile[] = [];
      for (let i = 0; i < currentRow.length; i++) {
        if (i + 1 < currentRow.length && currentRow[i] === currentRow[i+1]) {
          const mergedValue = (currentRow[i] as number) * 2;
          mergedRow.push(mergedValue);
          scoreAdded += mergedValue; // Basic score addition
          newDoublings++;
          moved = true;
          i++; // Skip next tile as it's merged
        } else {
          mergedRow.push(currentRow[i]);
        }
      }
      while (mergedRow.length < GRID_SIZE) mergedRow.push(null);
      if (newGrid[r].some((val, idx) => val !== mergedRow[idx])) moved = true;
      newGrid[r] = mergedRow;
    }
  }
  // TODO: Implement actual move logic for all directions (up, down, right) for a real game.
  // For this placeholder, we'll assume any key press causes a "move" and adds a tile if 'moved' is true.
  
  // If no actual merge/shift happened but a key was pressed, we might still add a tile.
  // This simplistic placeholder doesn't check for valid moves, only if grid changed.
  if (JSON.stringify(grid) !== JSON.stringify(newGrid)) {
      moved = true;
  }

  return { newGrid, moved, scoreAdded, newDoublings };
};


export function Game2048Placeholder() {
  const [gameActive, setGameActive] = useState(false);
  const [grid, setGrid] = useState<Grid>(initialGrid());
  const [currentScore, setCurrentScore] = useState(0); // This is game score, not user points
  const [doublingsCount, setDoublingsCount] = useState(0);
  const [gameMode, setGameMode] = useState<'fun' | 'rewards'>('fun');
  const { toast } = useToast();

  const initializeGame = () => {
    let newGrid = initialGrid();
    newGrid = addRandomTile(newGrid);
    newGrid = addRandomTile(newGrid);
    setGrid(newGrid);
    setCurrentScore(0);
    setDoublingsCount(0);
  };

  const handleStartGame = (mode: 'fun' | 'rewards') => {
    setGameActive(true);
    setGameMode(mode);
    initializeGame();
    // TODO: Backend Integration - If mode is 'rewards', ensure heart was consumed
    toast({ title: "2048 Started!", description: `Mode: ${mode}. Combine tiles to reach 2048!`});
  };
  
  const processMove = (newGrid: Grid, scoreFromMove: number, newDoublings: number, moved: boolean) => {
    if (moved) {
        newGrid = addRandomTile(newGrid);
        setGrid(newGrid);
        setCurrentScore(prev => prev + scoreFromMove);
        const updatedDoublings = doublingsCount + newDoublings;
        setDoublingsCount(updatedDoublings);

        if (gameMode === 'rewards' && scoreFromMove > 0) {
            // Award GOLD for points scored (e.g. 1 GOLD per 10 points in game)
            const goldEarned = Math.floor(scoreFromMove / 10);
            if (goldEarned > 0) {
                toast({ title: "Score Up!", description: `+${goldEarned} GOLD`, icon: <Coins className="h-5 w-5 text-yellow-500"/> });
                // TODO: Backend Integration - award GOLD
                // console.log(`Award ${goldEarned} GOLD`);
            }
        }
        if (gameMode === 'rewards' && newDoublings > 0) {
            // Check for diamond reward every 5 doublings
            const prevDiamondMilestone = Math.floor(doublingsCount / 5);
            const currentDiamondMilestone = Math.floor(updatedDoublings / 5);
            if (currentDiamondMilestone > prevDiamondMilestone) {
                const diamondsToAward = (currentDiamondMilestone - prevDiamondMilestone) * 0.05;
                toast({ title: "Doubling Bonus!", description: `+${diamondsToAward.toFixed(2)} DIAMOND`, icon: <Gem className="h-5 w-5 text-sky-400"/> });
                // TODO: Backend Integration - award DIAMOND
                // console.log(`Award ${diamondsToAward} DIAMOND`);
            }
        }
        // Check for game over (no more moves possible)
        // For placeholder, we'll just let it continue until user ends game
    } else {
        toast({ title: "No Move Possible", description: "Try a different direction.", variant: "default"});
    }
  };


  const handleKeyPress = (direction: 'left' | 'right' | 'up' | 'down') => {
    if (!gameActive) return;
    const { newGrid, moved, scoreAdded, newDoublings } = moveTiles(grid, direction); // Simplified for now
    processMove(newGrid, scoreAdded, newDoublings, moved);
  };

  // Basic keyboard controls for 2048 - will only work if modal is focused
   useEffect(() => {
    if (!gameActive) return;
    const keyHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'ArrowUp') handleKeyPress('up');
      else if (e.key === 'ArrowDown') handleKeyPress('down');
      else if (e.key === 'ArrowLeft') handleKeyPress('left');
      else if (e.key === 'ArrowRight') handleKeyPress('right');
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameActive, grid]); // IMPORTANT: Add grid to dependency array for key handler to get latest grid state

  const getTileColor = (value: number | null) => {
    if (value === null) return "bg-muted/50";
    if (value === 2) return "bg-yellow-200 text-gray-700";
    if (value === 4) return "bg-yellow-300 text-gray-700";
    if (value === 8) return "bg-orange-400 text-white";
    if (value === 16) return "bg-orange-500 text-white";
    if (value === 32) return "bg-red-500 text-white";
    if (value === 64) return "bg-red-600 text-white";
    if (value === 128) return "bg-yellow-500 text-white";
    // Add more colors
    return "bg-primary text-primary-foreground";
  };


  return (
    <GameCardWrapper
      gameKey="game2048"
      title="2048 Challenge"
      description="Combine tiles to reach the 2048 tile! Earn GOLD for merges and DIAMONDS for doubling streaks."
      Icon={Puzzle}
      placeholderImageSrc="https://placehold.co/600x400.png?text=2048+Game"
      imageAlt="2048 Game Placeholder"
      imageAiHint="number puzzle game"
      onStartGame={handleStartGame}
      gameActive={gameActive}
      setGameActive={setGameActive}
      currentScore={currentScore}
    >
        {/* Game content for modal */}
        <div className="flex flex-col items-center p-2 md:p-4">
            <div className="mb-4 text-center">
                <p className="text-xl font-bold text-foreground">Score: {currentScore}</p>
                {gameMode === 'rewards' && <p className="text-sm text-muted-foreground">Doublings: {doublingsCount}</p>}
            </div>
            <div className="grid grid-cols-4 gap-2 p-2 bg-card rounded-lg shadow-inner w-full max-w-[300px] aspect-square">
                {grid.map((row, rIndex) =>
                row.map((tile, cIndex) => (
                    <div
                    key={`${rIndex}-${cIndex}`}
                    className={cn(
                        "flex items-center justify-center rounded text-xl md:text-2xl font-bold aspect-square",
                        getTileColor(tile)
                    )}
                    >
                    {tile}
                    </div>
                ))
                )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 w-full max-w-[200px]">
                <div></div> {/* Spacer */}
                <Button onClick={() => handleKeyPress('up')} disabled={!gameActive}>Up</Button>
                <div></div> {/* Spacer */}
                <Button onClick={() => handleKeyPress('left')} disabled={!gameActive}>Left</Button>
                <Button onClick={() => handleKeyPress('down')} disabled={!gameActive}>Down</Button>
                <Button onClick={() => handleKeyPress('right')} disabled={!gameActive}>Right</Button>
            </div>
             <p className="text-xs text-muted-foreground mt-4 text-center">
                Use arrow keys (if modal focused) or on-screen buttons to move tiles.
                Combine identical tiles to score. Reach 2048!
            </p>
        </div>
    </GameCardWrapper>
  );
}

