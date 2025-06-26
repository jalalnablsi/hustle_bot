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
  lastReplenish: string;
  
  // Actions
  setGameData: (data: Partial<GameStore>) => void;
  addScore: (points: number) => void;
  addGold: (amount: number) => void;
  addDiamonds: (amount: number) => void;
  useHeart: () => void;
  useContinue: () => void;
  resetGame: () => void;
  setLastReplenish: (time: string) => void;
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
      lastReplenish: new Date().toISOString(),
      
      // Actions
      setGameData: (data) => set((state) => ({ ...state, ...data })),
      addScore: (points) => set((state) => {
        const newScore = state.score + points;
        return {
          score: newScore,
          highScore: Math.max(state.highScore, newScore),
        };
      }),
      addGold: (amount) => set((state) => ({ gold: state.gold + amount })),
      addDiamonds: (amount) => set((state) => ({
        diamonds: parseFloat((state.diamonds + amount).toFixed(1))
      })),
      useHeart: () => set((state) => ({ hearts: Math.max(0, state.hearts - 1) })),
      useContinue: () => set((state) => ({ continuesUsed: state.continuesUsed + 1 })),
      resetGame: () => set({ score: 0, continuesUsed: 0 }),
      setLastReplenish: (time) => set({ lastReplenish: time })
    }),
    {
      name: 'game-storage',
      partialize: (state) => ({
        highScore: state.highScore,
        gold: state.gold,
        diamonds: state.diamonds,
        hearts: state.hearts,
        lastReplenish: state.lastReplenish
      }),
    }
  )
);
