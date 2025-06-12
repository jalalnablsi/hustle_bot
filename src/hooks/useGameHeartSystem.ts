
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GameKey } from '@/app/types'; // Assuming GameKey is 'towerBuilder' | 'quickTap' etc.
import { useToast } from './use-toast';

const MAX_HEARTS = 3;
const HEART_REGENERATION_TIME_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

interface HeartState {
  count: number;
  lastReplenishedTimestamp: number | null; // Store timestamp for client-side calculation
}

export function useGameHeartSystem(gameKey: GameKey) {
  const { toast } = useToast();
  const [hearts, setHearts] = useState<number>(MAX_HEARTS);
  const [lastReplenished, setLastReplenished] = useState<number | null>(null);
  const [nextHeartIn, setNextHeartIn] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const getStorageKey = useCallback(() => `gameHearts_${gameKey}`, [gameKey]);

  // Load initial state from localStorage
  useEffect(() => {
    const storedStateRaw = localStorage.getItem(getStorageKey());
    if (storedStateRaw) {
      try {
        const storedState: HeartState = JSON.parse(storedStateRaw);
        setHearts(storedState.count);
        setLastReplenished(storedState.lastReplenished);
      } catch (e) {
        console.error("Failed to parse heart state from localStorage", e);
        // Initialize with defaults if parsing fails
        setHearts(MAX_HEARTS);
        setLastReplenished(Date.now());
        localStorage.setItem(getStorageKey(), JSON.stringify({ count: MAX_HEARTS, lastReplenishedTimestamp: Date.now() }));
      }
    } else {
      // Initialize if no stored state
      setHearts(MAX_HEARTS);
      setLastReplenished(Date.now());
      localStorage.setItem(getStorageKey(), JSON.stringify({ count: MAX_HEARTS, lastReplenishedTimestamp: Date.now() }));
    }
    setIsInitialized(true);
  }, [gameKey, getStorageKey]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(getStorageKey(), JSON.stringify({ count: hearts, lastReplenishedTimestamp: lastReplenished }));
      // TODO: Backend Integration: Sync this state with the backend (e.g., users.game_hearts)
      // fetch('/api/games/hearts/update', { method: 'POST', body: JSON.stringify({ gameKey, hearts, lastReplenished }) });
    }
  }, [hearts, lastReplenished, gameKey, getStorageKey, isInitialized]);

  // Heart regeneration logic
  useEffect(() => {
    if (!isInitialized || hearts >= MAX_HEARTS) {
      setNextHeartIn(null);
      return;
    }

    let intervalId: NodeJS.Timeout;

    const updateTimer = () => {
      const now = Date.now();
      let newHearts = hearts;
      let newLastReplenished = lastReplenished || now;

      // Check how many hearts should have regenerated since last replenishment
      if (lastReplenished) {
          const timePassed = now - lastReplenished;
          const heartsToRegenerate = Math.floor(timePassed / HEART_REGENERATION_TIME_MS);
          if (heartsToRegenerate > 0) {
              newHearts = Math.min(MAX_HEARTS, hearts + heartsToRegenerate);
              newLastReplenished = lastReplenished + (heartsToRegenerate * HEART_REGENERATION_TIME_MS);
          }
      } else { // Should not happen if initialized correctly
          newLastReplenished = now;
      }
      
      setHearts(newHearts);
      setLastReplenished(newLastReplenished);

      if (newHearts >= MAX_HEARTS) {
        setNextHeartIn(null);
        if (intervalId) clearInterval(intervalId);
        return;
      }

      // Calculate time for the *next* heart
      const timeSinceLastEffectiveReplenish = now - newLastReplenished;
      const timeRemainingForNextHeart = HEART_REGENERATION_TIME_MS - (timeSinceLastEffectiveReplenish % HEART_REGENERATION_TIME_MS);
      
      if (timeRemainingForNextHeart > 0) {
        const hours = Math.floor(timeRemainingForNextHeart / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemainingForNextHeart % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemainingForNextHeart % (1000 * 60)) / 1000);
        setNextHeartIn(`${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`);
      } else {
         // Should have regenerated, re-run logic
         // This case handles if timer somehow gets desynced, forces re-evaluation on next tick
      }
    };
    
    updateTimer(); // Initial call
    intervalId = setInterval(updateTimer, 1000); // Update timer every second

    return () => clearInterval(intervalId);
  }, [hearts, lastReplenished, isInitialized]);

  const consumeHeart = useCallback(() => {
    if (hearts > 0) {
      const newHeartCount = hearts - 1;
      setHearts(newHeartCount);
      if (newHeartCount < MAX_HEARTS && hearts === MAX_HEARTS) { // If it was full and now it's not
        setLastReplenished(Date.now()); // Start regeneration timer from now
      }
      // TODO: Backend Integration: Notify backend about heart consumption
      // fetch('/api/games/hearts/use', { method: 'POST', body: JSON.stringify({ gameKey }) });
      return true;
    }
    toast({ title: "No Hearts Left!", description: "Wait for hearts to regenerate or watch an ad.", variant: "destructive" });
    return false;
  }, [hearts, toast]);

  const addHeartFromAd = useCallback(() => {
    if (hearts < MAX_HEARTS) {
      setHearts(prev => Math.min(MAX_HEARTS, prev + 1));
      toast({ title: "Heart Added!", description: "You received an extra heart.", variant: "default" });
      // TODO: Backend Integration: Notify backend about ad reward
      // fetch('/api/games/hearts/ad-reward', { method: 'POST', body: JSON.stringify({ gameKey }) });
    } else {
      toast({ title: "Hearts Full!", description: "You already have the maximum number of hearts.", variant: "default" });
    }
  }, [hearts, toast]);

  return { hearts, consumeHeart, addHeartFromAd, nextHeartIn, isInitialized };
}
