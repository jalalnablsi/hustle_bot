
'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { AdController, ShowPromiseResult, AdsgramInitOptions } from '@/types/adsgram';
import { useToast } from './use-toast'; // Assuming useToast is available for user feedback

export interface UseAdsgramParams {
  blockId: string;
  onReward?: () => void; // Called when ad is considered watched by Adsgram client SDK
  onError?: (result: ShowPromiseResult) => void;
  onClose?: () => void; // Optional: if you want to handle ad close event regardless of reward
}

export function useAdsgram({ blockId, onReward, onError, onClose }: UseAdsgramParams): () => Promise<void> {
  const AdControllerRef = useRef<AdController | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Adsgram) {
      try {
        const initOptions: AdsgramInitOptions = {
          blockId,
          // Enable debug mode for testing if needed, remove for production
          // debug: process.env.NODE_ENV === 'development',
          // debugBannerType: 'FullscreenMedia'
        };
        AdControllerRef.current = window.Adsgram.init(initOptions);
        if (!AdControllerRef.current) {
          console.warn(`Adsgram init failed for blockId: ${blockId}. Adsgram.init returned undefined.`);
        }
      } catch (error: any) {
        console.error("Adsgram SDK initialization error:", error);
        const description = error?.message || 'Adsgram SDK failed to initialize.';
        // It's better to let the show() attempt handle onError for consistency
        // onError?.({ error: true, done: false, state: 'load', description });
      }
    } else if (typeof window !== 'undefined' && !window.Adsgram) {
        console.warn("Adsgram SDK (window.Adsgram) not found. Ensure the script is loaded.");
        // onError?.({ error: true, done: false, state: 'load', description: 'Adsgram SDK script not loaded yet.' });
    }
  }, [blockId]); // Rerun if blockId changes

  return useCallback(async () => {
    if (AdControllerRef.current) {
      try {
        // The .show() promise resolves when the ad is successfully shown and then closed.
        await AdControllerRef.current.show();
        onReward?.();
      } catch (caughtError: any) { // Catching 'any' as ShowPromiseResult might not be the only error type
        let errorResult: ShowPromiseResult;
        let safeDescription: string;

        if (caughtError && typeof caughtError.error === 'boolean' && typeof caughtError.done === 'boolean' && typeof caughtError.state === 'string') {
          // It looks like a ShowPromiseResult
          errorResult = caughtError as ShowPromiseResult;
          safeDescription = errorResult.description || "An unknown ad error occurred.";
        } else if (caughtError && typeof caughtError.message === 'string') {
          // It looks like a standard Error object
          safeDescription = caughtError.message;
          errorResult = {
            error: true,
            done: false,
            state: 'show', // Assuming error happened during show attempt
            description: safeDescription,
          };
        } else {
          // Fallback for other unexpected error structures
          safeDescription = caughtError ? String(caughtError) : "An unexpected and undefined ad error occurred.";
          errorResult = {
            error: true,
            done: false,
            state: 'show',
            description: safeDescription,
          };
        }
        
        console.warn('Adsgram ad error/closed early:', errorResult);
        onError?.(errorResult); // Pass the structured or reconstructed errorResult

        // Provide user feedback for common scenarios based on the safeDescription
        if (safeDescription.includes("too_many_shows")) {
            toast({ title: "Ad Limit", description: "Too many ads shown, please try again later.", variant: "default"});
        } else if (safeDescription.includes("no_ad_available")) {
            toast({ title: "No Ad Available", description: "Please try again in a moment.", variant: "default"});
        } else if (errorResult.error && !safeDescription.includes('Adsgram script not loaded') && !safeDescription.includes('Adsgram SDK failed to initialize.')) {
            // Avoid toasting for SDK load issues here as they are handled below or by initial setup.
            // General error toast if an ad fails to play, using the safeDescription.
            // Commented out to avoid double toasting if pages also toast.
            // toast({ title: "Ad Playback Error", description: safeDescription, variant: "destructive"});
        }
        
        onClose?.();
      }
    } else {
      const safeDescription = 'Adsgram is not ready. Please try again in a moment.';
      console.warn(safeDescription, 'AdController not available. Script might not be loaded or init failed.');
      const notLoadedError: ShowPromiseResult = {
        error: true,
        done: false,
        state: 'load',
        description: safeDescription,
      };
      onError?.(notLoadedError);
      toast({ title: "Ads Not Ready", description: safeDescription, variant: "default" });
      onClose?.(); // Also call onClose if ad system isn't ready
    }
  }, [onError, onReward, onClose, toast]);
}
