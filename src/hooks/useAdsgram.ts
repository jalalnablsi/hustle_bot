
'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { AdController, ShowPromiseResult, AdsgramInitOptions } from '@/types/adsgram';
import { useToast } from './use-toast';

export interface UseAdsgramParams {
  blockId: string;
  onReward?: () => void;
  onError?: (result: ShowPromiseResult) => void;
  onClose?: () => void; 
}

export function useAdsgram({ blockId, onReward, onError, onClose }: UseAdsgramParams): () => Promise<void> {
  const { toast } = useToast();
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const showAd = useCallback(async () => {
    if (!isMountedRef.current) {
      console.warn("useAdsgram: show ad attempted before component is fully mounted or after unmount.");
      return;
    }

    if (typeof window !== 'undefined' && window.Adsgram && blockId) {
      try {
        console.log(`useAdsgram Hook: Initializing for blockId: ${blockId} just before showing.`);
        const adController = window.Adsgram.init({ blockId });

        if (!adController) {
          throw new Error(`window.Adsgram.init returned undefined for blockId: ${blockId}.`);
        }

        console.log(`useAdsgram: Attempting to show ad using controller for blockId: ${blockId}`);
        await adController.show();
        console.log(`useAdsgram: Ad shown and closed (reward condition potentially met) for blockId: ${blockId}`);
        if (isMountedRef.current) {
          onReward?.();
        }
      } catch (caughtError: any) {
        let errorResult: ShowPromiseResult;
        let safeDescription: string;

        if (caughtError && typeof caughtError.error === 'boolean' && typeof caughtError.done === 'boolean') {
          errorResult = caughtError as ShowPromiseResult;
          safeDescription = errorResult.description || "An unknown ad error occurred.";
        } else if (caughtError && typeof caughtError.message === 'string') {
          safeDescription = caughtError.message;
          errorResult = { error: true, done: false, state: 'show', description: safeDescription };
        } else {
          safeDescription = caughtError ? String(caughtError) : "An unexpected and undefined ad error occurred.";
          errorResult = { error: true, done: false, state: 'show', description: safeDescription };
        }
        
        console.warn(`useAdsgram: Ad error or closed early for blockId: ${blockId}`, errorResult);
        if (isMountedRef.current) {
          onError?.(errorResult);
        }

        if (safeDescription.includes("too_many_shows")) {
            toast({ title: "Ad Limit", description: "Too many ads shown, please try again later.", variant: "default"});
        } else if (safeDescription.includes("no_ad_available")) {
            toast({ title: "No Ad Available", description: "Please try again in a moment.", variant: "default"});
        }
      } finally {
        if (isMountedRef.current) {
          console.log(`useAdsgram: Ad flow finished (onClose) for blockId: ${blockId}`);
          onClose?.();
        }
      }
    } else {
      const notReadyMsg = 'Adsgram is not ready. Please try again in a moment.';
      console.warn(notReadyMsg, `Attempted to show ad for blockId: ${blockId} but Adsgram SDK or blockId not available.`);
      const notLoadedError: ShowPromiseResult = { error: true, done: false, state: 'load', description: notReadyMsg };
      if (isMountedRef.current) {
        onError?.(notLoadedError);
        toast({ title: "Ads Not Ready", description: notReadyMsg, variant: "default" });
        onClose?.(); 
      }
    }
  }, [blockId, onReward, onError, onClose, toast]);

  return showAd;
}
