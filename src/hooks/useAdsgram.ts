
'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { AdController, ShowPromiseResult, AdsgramInitOptions } from '@/types/adsgram';
import { useToast } from './use-toast';

export interface UseAdsgramParams {
  blockId: string;
  onReward?: () => void;
  onError?: (result: ShowPromiseResult) => void;
  onClose?: () => void; // Called when ad overlay is dismissed, regardless of outcome
}

export function useAdsgram({ blockId, onReward, onError, onClose }: UseAdsgramParams): () => Promise<void> {
  const AdControllerRef = useRef<AdController | undefined>(undefined);
  const { toast } = useToast();
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Adsgram) {
      try {
        const initOptions: AdsgramInitOptions = {
          blockId,
          // debug: process.env.NODE_ENV === 'development', // Enable for local testing
        };
        console.log(`Adsgram: Initializing with blockId: ${blockId}`);
        AdControllerRef.current = window.Adsgram.init(initOptions);
        if (!AdControllerRef.current) {
          console.warn(`Adsgram: Init returned undefined for blockId: ${blockId}.`);
        } else {
          console.log(`Adsgram: Successfully initialized for blockId: ${blockId}`);
        }
      } catch (error: any) {
        console.error("Adsgram SDK initialization error:", error, "for blockId:", blockId);
        // Do not call onError here as it's for .show() errors
      }
    } else if (typeof window !== 'undefined' && !window.Adsgram) {
        console.warn("Adsgram SDK (window.Adsgram) not found. Ensure the script is loaded.");
    }
  }, [blockId]);

  return useCallback(async () => {
    if (!isMountedRef.current) {
      console.warn("useAdsgram: show attempted before component is fully mounted or after unmount.");
      return;
    }

    if (AdControllerRef.current) {
      console.log(`Adsgram: Attempting to show ad for blockId: ${blockId}`);
      try {
        // .show() promise resolves when the ad is successfully shown and *then closed by the user*.
        // For rewarded ads, this means the user watched it to the end.
        await AdControllerRef.current.show();
        console.log(`Adsgram: Ad shown and closed successfully (reward condition met) for blockId: ${blockId}`);
        if (isMountedRef.current) {
          onReward?.();
        }
      } catch (caughtError: any) {
        let errorResult: ShowPromiseResult;
        let safeDescription: string;

        if (caughtError && typeof caughtError.error === 'boolean' && typeof caughtError.done === 'boolean' && typeof caughtError.state === 'string') {
          errorResult = caughtError as ShowPromiseResult;
          safeDescription = errorResult.description || "An unknown ad error occurred.";
        } else if (caughtError && typeof caughtError.message === 'string') {
          safeDescription = caughtError.message;
          errorResult = { error: true, done: false, state: 'show', description: safeDescription };
        } else {
          safeDescription = caughtError ? String(caughtError) : "An unexpected and undefined ad error occurred.";
          errorResult = { error: true, done: false, state: 'show', description: safeDescription };
        }
        
        console.warn(`Adsgram: Ad error or closed early for blockId: ${blockId}`, errorResult);
        if (isMountedRef.current) {
          onError?.(errorResult);
        }

        // User feedback for common scenarios
        if (safeDescription.includes("too_many_shows")) {
            toast({ title: "Ad Limit", description: "Too many ads shown, please try again later.", variant: "default"});
        } else if (safeDescription.includes("no_ad_available")) {
            toast({ title: "No Ad Available", description: "Please try again in a moment.", variant: "default"});
        } else if (errorResult.error && !safeDescription.includes('Adsgram script not loaded') && !safeDescription.includes('Adsgram SDK failed to initialize.')) {
            // Generic error toast only if it's not an SDK load issue
            // toast({ title: "Ad Playback Issue", description: safeDescription, variant: "destructive"});
        }
      } finally {
        // This block executes regardless of whether the promise resolved or rejected.
        // It's a good place to call onClose, as the ad UI is now gone.
        if (isMountedRef.current) {
          console.log(`Adsgram: Ad flow finished (onClose) for blockId: ${blockId}`);
          onClose?.();
        }
      }
    } else {
      const notReadyMsg = 'Adsgram is not ready. Please try again in a moment.';
      console.warn(notReadyMsg, `Attempted to show ad for blockId: ${blockId} but AdController not available.`);
      const notLoadedError: ShowPromiseResult = { error: true, done: false, state: 'load', description: notReadyMsg };
      if (isMountedRef.current) {
        onError?.(notLoadedError);
        toast({ title: "Ads Not Ready", description: notReadyMsg, variant: "default" });
        onClose?.(); // Also call onClose if ad system isn't ready
      }
    }
  }, [blockId, onReward, onError, onClose, toast]);
}
