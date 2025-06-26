// lib/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type GameStore = {
  // Game state
  score: number;
  highScore: number;
  gold: number;
  diamonds: number;
  hearts: number;
  continuesUsed: number;
  replenishTime: string;
  isGameActive: boolean;
  
  // Actions
  setGameData: (data: Partial<GameStore>) => void;
  addScore: (points: number) => void;
  addGold: (amount: number) => void;
  addDiamonds: (amount: number) => void;
  useHeart: () => void;
  useContinue: () => void;
  resetGame: () => void;
};

export const useStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      score: 0,
      highScore: 0,
      gold: 0,
      diamonds: 0,
      hearts: 0,
      continuesUsed: 0,
      replenishTime: '',
      isGameActive: false,
      
      // Action to set multiple game data at once
      setGameData: (data) => set((state) => ({ ...state, ...data })),
      
      // Add to score and update high score if needed
      addScore: (points) => set((state) => {
        const newScore = state.score + points;
        return {
          score: newScore,
          highScore: Math.max(state.highScore, newScore),
        };
      }),
      
      // Add gold
      addGold: (amount) => set((state) => ({ gold: state.gold + amount })),
      
      // Add diamonds (with 1 decimal place)
      addDiamonds: (amount) => set((state) => ({
        diamonds: parseFloat((state.diamonds + amount).toFixed(1))
      })),
      
      // Use a heart (minimum 0)
      useHeart: () => set((state) => ({ hearts: Math.max(0, state.hearts - 1) })),
      
      // Use a continue
      useContinue: () => set((state) => ({ continuesUsed: state.continuesUsed + 1 })),
      
      // Reset game state (keep high score and resources)
      resetGame: () => set({
        score: 0,
        continuesUsed: 0,
        isGameActive: false
      }),
    }),
    {
      name: 'game-storage', // LocalStorage key
      partialize: (state) => ({
        highScore: state.highScore,
        gold: state.gold,
        diamonds: state.diamonds,
        hearts: state.hearts,
        replenishTime: state.replenishTime
      }), // Only persist these values
    }
  )
);
