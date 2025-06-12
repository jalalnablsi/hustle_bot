
'use client';
import { Puzzle, Coins, Gem, MoveUp, MoveDown, MoveLeft, MoveRight, HelpCircle } from "lucide-react";
import { GameCardWrapper } from "./GameCardWrapper";
import { useState, useEffect, useCallback } from "react";
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
  if (emptyTiles.length === 0) return grid; // No space left
  const { r, c } = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
};

// Simplified 2048 move logic
const move = (grid: Grid, direction: 'up' | 'down' | 'left' | 'right'): { newGrid: Grid; moved: boolean; scoreAdded: number; newDoublings: number } => {
  let newGrid = JSON.parse(JSON.stringify(grid)) as Grid; // Deep copy
  let moved = false;
  let scoreAdded = 0;
  let newDoublings = 0;

  const rotateGrid = (g: Grid) => g[0].map((_, colIndex) => g.map(row => row[colIndex]).reverse());
  const slideAndMergeRow = (row: Tile[]): { newRow: Tile[]; score: number; doublings: number } => {
    let filteredRow = row.filter(tile => tile !== null);
    let mergedRow: Tile[] = [];
    let rowScore = 0;
    let rowDoublings = 0;
    for (let i = 0; i < filteredRow.length; i++) {
      if (filteredRow[i] !== null) {
        if (i + 1 < filteredRow.length && filteredRow[i] === filteredRow[i+1]) {
          const mergedValue = (filteredRow[i] as number) * 2;
          mergedRow.push(mergedValue);
          rowScore += mergedValue;
          rowDoublings++;
          i++; // Skip next tile
        } else {
          mergedRow.push(filteredRow[i]);
        }
      }
    }
    while (mergedRow.length < GRID_SIZE) mergedRow.push(null);
    return { newRow: mergedRow, score: rowScore, doublings: rowDoublings };
  };

  // Logic for 'left' move. Other directions are rotations of 'left'.
  if (direction === 'left') {
    for (let r = 0; r < GRID_SIZE; r++) {
      const { newRow, score, doublings } = slideAndMergeRow(newGrid[r]);
      if (JSON.stringify(newGrid[r]) !== JSON.stringify(newRow)) moved = true;
      newGrid[r] = newRow;
      scoreAdded += score;
      newDoublings += doublings;
    }
  } else if (direction === 'right') {
    for (let r = 0; r < GRID_SIZE; r++) {
      const { newRow, score, doublings } = slideAndMergeRow(newGrid[r].reverse());
      const finalRow = newRow.reverse();
      if (JSON.stringify(newGrid[r]) !== JSON.stringify(finalRow)) moved = true;
      newGrid[r] = finalRow;
      scoreAdded += score;
      newDoublings += doublings;
    }
  } else if (direction === 'up') {
    newGrid = rotateGrid(newGrid); // Rotate to treat as 'left'
    newGrid = rotateGrid(newGrid);
    newGrid = rotateGrid(newGrid);
    for (let r = 0; r < GRID_SIZE; r++) {
      const { newRow, score, doublings } = slideAndMergeRow(newGrid[r]);
      if (JSON.stringify(newGrid[r]) !== JSON.stringify(newRow)) moved = true;
      newGrid[r] = newRow;
      scoreAdded += score;
      newDoublings += doublings;
    }
    newGrid = rotateGrid(newGrid); // Rotate back
  } else if (direction === 'down') {
    newGrid = rotateGrid(newGrid); // Rotate to treat as 'left'
    for (let r = 0; r < GRID_SIZE; r++) {
      const { newRow, score, doublings } = slideAndMergeRow(newGrid[r]);
      if (JSON.stringify(newGrid[r]) !== JSON.stringify(newRow)) moved = true;
      newGrid[r] = newRow;
      scoreAdded += score;
      newDoublings += doublings;
    }
    newGrid = rotateGrid(newGrid); // Rotate back
    newGrid = rotateGrid(newGrid);
    newGrid = rotateGrid(newGrid);
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

  const initializeGame = useCallback(() => {
    let newGrid = initialGrid();
    newGrid = addRandomTile(newGrid);
    newGrid = addRandomTile(newGrid);
    setGrid(newGrid);
    setCurrentScore(0);
    setDoublingsCount(0);
  }, []);

  const handleStartGame = (mode: 'fun' | 'rewards') => {
    setGameActive(true);
    setGameMode(mode);
    initializeGame();
    // TODO: Backend Integration - If mode is 'rewards', ensure heart was consumed
    toast({ title: "2048 Challenge Started!", description: `Mode: ${mode}. Combine tiles to reach 2048!`});
  };
  
  const processMove = useCallback((newGridState: Grid, scoreFromMove: number, newDoublingsFromMove: number, wasMoved: boolean) => {
    if (wasMoved) {
        const gridWithNewTile = addRandomTile(newGridState);
        setGrid(gridWithNewTile);
        setCurrentScore(prev => prev + scoreFromMove);
        const updatedDoublings = doublingsCount + newDoublingsFromMove;
        setDoublingsCount(updatedDoublings);

        if (gameMode === 'rewards' && scoreFromMove > 0) {
            const goldEarned = Math.floor(scoreFromMove / 10); // Example: 1 GOLD per 10 points
            if (goldEarned > 0) {
                toast({ title: "Score Up!", description: `+${goldEarned} GOLD`, icon: <Coins className="h-5 w-5 text-yellow-500"/> });
                // TODO: Backend Integration - award GOLD
            }
        }
        if (gameMode === 'rewards' && newDoublingsFromMove > 0) {
            const prevDiamondMilestone = Math.floor(doublingsCount / 5);
            const currentDiamondMilestone = Math.floor(updatedDoublings / 5);
            if (currentDiamondMilestone > prevDiamondMilestone) {
                const diamondsToAward = (currentDiamondMilestone - prevDiamondMilestone) * 0.05;
                toast({ title: "Doubling Bonus!", description: `+${diamondsToAward.toFixed(2)} DIAMOND`, icon: <Gem className="h-5 w-5 text-sky-400"/> });
                // TODO: Backend Integration - award DIAMOND (ensure precise decimal handling)
            }
        }
        // TODO: Check for game over (no more moves possible)
    } else {
        toast({ title: "No Move Possible", description: "Try a different direction or game is over.", variant: "default", duration: 2000});
    }
  }, [doublingsCount, gameMode, toast]);


  const handleKeyPress = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (!gameActive) return;
    const { newGrid, moved, scoreAdded, newDoublings } = move(grid, direction);
    processMove(newGrid, scoreAdded, newDoublings, moved);
  }, [gameActive, grid, processMove]);

   useEffect(() => {
    if (!gameActive) return;
    const keyHandler = (e: KeyboardEvent) => {
      // Prevent page scroll with arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowUp') handleKeyPress('up');
      else if (e.key === 'ArrowDown') handleKeyPress('down');
      else if (e.key === 'ArrowLeft') handleKeyPress('left');
      else if (e.key === 'ArrowRight') handleKeyPress('right');
    };
    // Add event listener to the document to capture keys even if modal elements are not focused.
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [gameActive, handleKeyPress]); // grid dependency removed as handleKeyPress uses useCallback with grid


  const getTileStyle = (value: number | null) => {
    let bgColor = "bg-muted/30";
    let textColor = "text-foreground";
    let fontSize = "text-2xl md:text-3xl";

    if (value === 2) { bgColor = "bg-yellow-100"; textColor = "text-yellow-800"; }
    else if (value === 4) { bgColor = "bg-yellow-200"; textColor = "text-yellow-900"; }
    else if (value === 8) { bgColor = "bg-orange-300"; textColor = "text-white"; }
    else if (value === 16) { bgColor = "bg-orange-400"; textColor = "text-white"; }
    else if (value === 32) { bgColor = "bg-red-400"; textColor = "text-white"; }
    else if (value === 64) { bgColor = "bg-red-500"; textColor = "text-white"; }
    else if (value === 128) { bgColor = "bg-yellow-400"; textColor = "text-white"; fontSize = "text-xl md:text-2xl"; }
    else if (value === 256) { bgColor = "bg-yellow-500"; textColor = "text-white"; fontSize = "text-xl md:text-2xl"; }
    else if (value === 512) { bgColor = "bg-yellow-600"; textColor = "text-white"; fontSize = "text-xl md:text-2xl"; }
    else if (value === 1024) { bgColor = "bg-purple-500"; textColor = "text-white"; fontSize = "text-lg md:text-xl"; }
    else if (value === 2048) { bgColor = "bg-purple-700"; textColor = "text-white"; fontSize = "text-lg md:text-xl"; }
    else if (value && value > 2048) { bgColor = "bg-black"; textColor = "text-white"; fontSize = "text-md md:text-lg"; }
    
    return cn(
        "flex items-center justify-center rounded-md font-bold aspect-square select-none shadow-md transition-all duration-100",
        bgColor,
        textColor,
        fontSize,
        value ? "transform scale-105" : "transform scale-100" // Simple animation for new tiles
    );
  };


  return (
    <GameCardWrapper
      gameKey="game2048"
      title="2048 Challenge"
      description="Combine tiles by swiping (or using arrow keys/buttons). Reach 2048! Earn GOLD for merges, DIAMONDS for doubling streaks."
      Icon={Puzzle}
      placeholderImageSrc="https://placehold.co/600x400.png?text=2048+Game"
      imageAlt="2048 Game Placeholder"
      imageAiHint="number puzzle game grid"
      onStartGame={handleStartGame}
      gameActive={gameActive}
      setGameActive={setGameActive}
      currentScore={currentScore}
    >
        <div className="flex flex-col items-center p-2 md:p-4">
            <div className="mb-4 text-center">
                <p className="text-2xl font-bold text-foreground">Score: {currentScore}</p>
                {gameMode === 'rewards' && <p className="text-md text-muted-foreground">Doublings: {doublingsCount}</p>}
            </div>
            <div className="grid grid-cols-4 gap-2 p-3 bg-card/50 rounded-lg shadow-inner w-full max-w-xs sm:max-w-sm aspect-square mb-4">
                {grid.map((row, rIndex) =>
                row.map((tile, cIndex) => (
                    <div
                    key={`${rIndex}-${cIndex}`}
                    className={getTileStyle(tile)}
                    >
                    {tile}
                    </div>
                ))
                )}
            </div>
            <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mb-2">
                <div></div> {/* Spacer */}
                <Button onClick={() => handleKeyPress('up')} disabled={!gameActive} variant="outline" size="lg" aria-label="Move Up"><MoveUp /></Button>
                <div></div> {/* Spacer */}
                <Button onClick={() => handleKeyPress('left')} disabled={!gameActive} variant="outline" size="lg" aria-label="Move Left"><MoveLeft /></Button>
                <Button onClick={() => handleKeyPress('down')} disabled={!gameActive} variant="outline" size="lg" aria-label="Move Down"><MoveDown /></Button>
                <Button onClick={() => handleKeyPress('right')} disabled={!gameActive} variant="outline" size="lg" aria-label="Move Right"><MoveRight /></Button>
            </div>
             <p className="text-xs text-muted-foreground mt-4 text-center px-4 flex items-center justify-center gap-1">
                <HelpCircle size={14}/> Use arrow keys, on-screen buttons, or swipe gestures (on actual game) to move tiles.
            </p>
        </div>
    </GameCardWrapper>
  );
}
