

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
      } catch (error) {
        console.error("Adsgram SDK initialization error:", error);
        // Optionally, inform the user via toast or a state update
        // onError?.({ error: true, done: false, state: 'load', description: 'Adsgram SDK failed to initialize.' });
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
        // For rewarded ads, this usually means it was watched to completion.
        // For interstitial, it means it was closed (either watched or skipped).
        await AdControllerRef.current.show();
        // This client-side onReward is for immediate UI feedback.
        // The actual reward should be granted by your backend via Adsgram's server-to-server callback.
        onReward?.();
      } catch (result: any) { // Catching 'any' as ShowPromiseResult might not be the only error type
        let errorResult: ShowPromiseResult;
        if (result && typeof result.error === 'boolean' && typeof result.done === 'boolean') {
          errorResult = result as ShowPromiseResult;
        } else {
          // Construct a ShowPromiseResult for unexpected errors
          errorResult = {
            error: true,
            done: false,
            state: 'show', // Assuming error happened during show attempt
            description: result?.message || 'An unexpected error occurred with the ad.',
          };
        }
        
        console.warn('Adsgram ad error/closed early:', errorResult);
        onError?.(errorResult);

        // Provide user feedback for common scenarios
        if (errorResult.description?.includes("too_many_shows")) {
            toast({ title: "Ad Limit", description: "Too many ads shown, please try again later.", variant: "default"});
        } else if (errorResult.description?.includes("no_ad_available")) {
            toast({ title: "No Ad Available", description: "Please try again in a moment.", variant: "default"});
        } else if (errorResult.error && errorResult.description !== 'Adsgram script not loaded' && errorResult.description !== 'Adsgram SDK failed to initialize.') {
            // General error if ad fails to play
            // toast({ title: "Ad Playback Error", description: "Could not play ad. " + (errorResult.description || ""), variant: "destructive"});
        }
        // The onClose callback is useful if you want to react to the ad dialog closing,
        // regardless of whether it was a reward, skip, or error.
        onClose?.();
      }
    } else {
      console.warn('Adsgram AdController not available. Script might not be loaded or init failed.');
      const notLoadedError: ShowPromiseResult = {
        error: true,
        done: false,
        state: 'load',
        description: 'Adsgram is not ready. Please try again in a moment.',
      };
      onError?.(notLoadedError);
      toast({ title: "Ads Not Ready", description: notLoadedError.description, variant: "default" });
      onClose?.(); // Also call onClose if ad system isn't ready
    }
  }, [onError, onReward, onClose, toast]);
}
