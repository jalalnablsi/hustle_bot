// Based on the provided useAdsgram hook example
// This file defines the types for the Adsgram SDK integration.

export interface ShowPromiseResult {
  error: boolean;
  done: boolean; // true if ad was watched till end (rewarded) or closed (interstitial)
  state: 'load' | 'show' | 'close'; 
  description?: string; // Error description or status
}

export interface AdController {
  show: () => Promise<void | ShowPromiseResult>; // The promise resolves if ad is successfully shown and closed/rewarded. It rejects if an error occurs.
  // Adsgram documentation implies .show() might resolve with void on success, and reject with ShowPromiseResult on error.
  // Or, it might always resolve with ShowPromiseResult. The hook handles this by expecting a catch block.
}

export interface AdsgramInitOptions {
  blockId: string;
  debug?: boolean; // Optional: true for testing, false or undefined for production
  debugBannerType?: 'FullscreenMedia' | 'BottomBanner' | 'Video'; // Optional: for debug mode
  // Any other initialization options specified by Adsgram SDK
  // For example, if callbacks are set here, though often they are handled via .on methods or server-to-server.
}

declare global {
  interface Window {
    Adsgram?: {
      init: (options: AdsgramInitOptions) => AdController | undefined;
      // Define other Adsgram global methods if you use them, e.g., Adsgram.on('event', callback)
    };
  }
}
