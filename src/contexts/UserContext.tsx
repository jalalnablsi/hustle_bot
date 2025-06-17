
'use client';

import React from 'react';
import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { retrieveLaunchParams } from '@telegram-apps/sdk';
import { useMiniApp } from '@telegram-apps/sdk-react';

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  updateUserSession: (updatedUserData: Partial<AppUser>) => void;
  loadingUser: boolean;
  fetchUserData: (isInitialAuth?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
  const [loadingUserInternal, setLoadingUserInternal] = React.useState(true);
  const [telegramAuthError, setTelegramAuthError] = React.useState<string | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);
  const [initDataRawState, setInitDataRawState] = React.useState<string | undefined>(undefined);

  const miniApp = useMiniApp();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (isMounted) {
      // console.log("UserContext: Component mounted. Attempting to retrieve launch params.");
      try {
        const launchParams = retrieveLaunchParams();
        // console.log("UserContext: retrieveLaunchParams result:", launchParams);
        if (launchParams.initDataRaw) {
          // console.log("UserContext: initDataRaw found:", launchParams.initDataRaw.substring(0, 50) + "...");
          setInitDataRawState(launchParams.initDataRaw);
        } else {
          // console.error("UserContext: initDataRaw is NOT available from retrieveLaunchParams.");
          setTelegramAuthError(
            'Telegram launch parameters (initData) were not found. Please ensure the app is launched correctly through Telegram.'
          );
          setCurrentUser(null);
          setLoadingUserInternal(false); // Critical: stop loading if initData is definitely missing
        }
      } catch (e: any) {
        // console.error("UserContext: Error in retrieveLaunchParams:", e);
        setTelegramAuthError(
          `Error retrieving launch parameters: ${e.message}. Relaunch from Telegram.`
        );
        setCurrentUser(null);
        setLoadingUserInternal(false); // Critical: stop loading on error
      }
    }
  }, [isMounted]);


  const initializeTelegramSession = React.useCallback(async (retrievedInitDataRaw: string) => {
    setTelegramAuthError(null);
    // setLoadingUserInternal(true) is already true or handled by the caller useEffect
    
    try {
      if (miniApp && typeof miniApp.ready === 'function') {
        miniApp.ready();
        // console.log("UserContext: miniApp.ready() called.");
      } else {
        // console.warn("UserContext: miniApp or miniApp.ready not available at init. This might be okay if using only initDataRaw.");
      }
      if (miniApp && typeof miniApp.expand === 'function') {
         miniApp.expand();
        //  console.log("UserContext: miniApp.expand() called.");
      }


      // console.log("UserContext: Calling /api/login with initDataRaw:", retrievedInitDataRaw.substring(0,50) + "...");
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: retrievedInitDataRaw }),
      });

      const loginData = await loginResponse.json();
      // console.log("UserContext: /api/login response:", loginData);

      if (!loginResponse.ok || !loginData.success) {
        throw new Error(loginData.error || `Login failed (status: ${loginResponse.status}). Please relaunch.`);
      }
      
      // Login successful, now fetch user data.
      // fetchUserData will set currentUser and clear errors on success.
      const user = await fetchUserData(true); // true indicates this is part of the initial auth sequence
      if (!user) {
        // If fetchUserData returned null, it should have set an error.
        // If not, set a generic one. This might be redundant.
        if (!telegramAuthError) {
          setTelegramAuthError("Failed to retrieve user details after login. Please relaunch.");
        }
      } else {
        // console.log("UserContext: User successfully fetched after login:", user.id);
      }

    } catch (error: any) {
      // console.error('UserContext: Error during initializeTelegramSession:', error);
      setTelegramAuthError(error.message || 'An unexpected error occurred during session initialization. Please relaunch from Telegram.');
      setCurrentUser(null);
    } finally {
      // console.log("UserContext: initializeTelegramSession finally block. Setting loadingUserInternal to false.");
      setLoadingUserInternal(false); // CRITICAL: Ensure loading stops.
    }
  }, [miniApp, telegramAuthError]); // Removed fetchUserData from here, it's called internally


  React.useEffect(() => {
    if (isMounted && initDataRawState) {
      // console.log("UserContext: isMounted and initDataRawState are set. Scheduling initializeTelegramSession.");
      // Short delay to allow Telegram environment to fully settle.
      const timerId = setTimeout(() => {
        // console.log("UserContext: Timeout finished. Calling initializeTelegramSession.");
        initializeTelegramSession(initDataRawState);
      }, 200); // 200ms delay

      return () => clearTimeout(timerId);
    } else if (isMounted && initDataRawState === undefined && !loadingUserInternal && !telegramAuthError) {
        // This case means retrieveLaunchParams was tried but initDataRawState is still undefined (not null, not a string)
        // and we are not already in a loading or error state from retrieveLaunchParams itself.
        // This might indicate SDK is still initializing.
        // console.log("UserContext: Mounted, initDataRawState is undefined, not loading, no error yet. Waiting for initDataRaw.");
    }
  }, [isMounted, initDataRawState, initializeTelegramSession, loadingUserInternal, telegramAuthError]);


  const fetchUserData = React.useCallback(async (
    isInitialAuthCall = false
  ): Promise<AppUser | null> => {
    if (!isInitialAuthCall) {
      setLoadingUserInternal(true);
      setTelegramAuthError(null);
    }
    try {
      // console.log("UserContext: fetchUserData called. isInitialAuthCall:", isInitialAuthCall);
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      // console.log("UserContext: /api/auth/me response:", data);

      if (response.ok && data.success && data.user) {
        const validatedUser: AppUser = {
            ...data.user,
            id: data.user.id?.toString() || `tg-${data.user.telegram_id}`,
            telegram_id: data.user.telegram_id.toString(),
            first_name: data.user.first_name || '',
            username: data.user.username || null,
            last_name: data.user.last_name || null,
            gold_points: Number(data.user.gold_points) || 0,
            diamond_points: Number(data.user.diamond_points) || 0,
            purple_gem_points: Number(data.user.purple_gem_points) || 0,
            blue_gem_points: Number(data.user.blue_gem_points) || 0,
            referral_link: data.user.referral_link || `https://t.me/YOUR_BOT_USERNAME?start=${data.user.telegram_id}`, // Replace YOUR_BOT_USERNAME
            referrals_made: Number(data.user.referrals_made) || 0,
            referral_gold_earned: Number(data.user.referral_gold_earned) || 0,
            referral_diamond_earned: Number(data.user.referral_diamond_earned) || 0,
            initial_free_spin_used: Boolean(data.user.initial_free_spin_used),
            ad_spins_used_today_count: Number(data.user.ad_spins_used_today_count) || 0,
            ad_views_today_count: Number(data.user.ad_views_today_count) || 0,
            bonus_spins_available: Number(data.user.bonus_spins_available) || 0,
            daily_reward_streak: Number(data.user.daily_reward_streak) || 0,
            last_daily_reward_claim_at: data.user.last_daily_reward_claim_at || null,
            daily_ad_views_limit: Number(data.user.daily_ad_views_limit) || 50, // Default
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: data.user.last_login || new Date().toISOString(),
            game_hearts: typeof data.user.game_hearts === 'object' && data.user.game_hearts !== null ? data.user.game_hearts : {},
            stake_builder_high_score: Number(data.user.stake_builder_high_score) || 0,
            last_heart_replenished: data.user.last_heart_replenished || null,
          };
        setCurrentUser(validatedUser);
        setTelegramAuthError(null); // Clear any previous auth errors on successful fetch
        return validatedUser;
      } else {
        setCurrentUser(null);
        const errorMsg = data.error || 'Failed to authenticate user session via /api/auth/me.';
        setTelegramAuthError(errorMsg);
      }
    } catch (error: any) {
      // console.error("UserContext: Network error in fetchUserData:", error);
      setTelegramAuthError('Network error while fetching user data. Please check your connection.');
      setCurrentUser(null);
    } finally {
      if (!isInitialAuthCall) {
        // console.log("UserContext: fetchUserData (standalone) finally block. Setting loadingUserInternal to false.");
        setLoadingUserInternal(false);
      }
    }
    return null;
  }, []);

  const updateUserSession = React.useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) {
        return null;
      }
      const newUser = { ...prevUser };
      for (const key in updatedUserData) {
        if (Object.prototype.hasOwnProperty.call(updatedUserData, key)) {
          const K = key as keyof AppUser;
          const value = updatedUserData[K];
          if (['gold_points', 'diamond_points', 'purple_gem_points', 'blue_gem_points', 'referrals_made', 'referral_gold_earned', 'referral_diamond_earned', 'ad_spins_used_today_count', 'ad_views_today_count', 'bonus_spins_available', 'daily_reward_streak', 'daily_ad_views_limit', 'stake_builder_high_score'].includes(K)) {
            (newUser[K] as any) = Number(value) || 0;
          } else if (K === 'initial_free_spin_used') {
            (newUser[K] as any) = Boolean(value);
          } else if (K === 'game_hearts') {
             (newUser[K] as any) = typeof value === 'object' && value !== null ? value : {};
          } else {
            (newUser[K] as any) = value;
          }
        }
      }
      return newUser;
    });
  }, []);
  
  const finalLoadingState = !isMounted || loadingUserInternal;

  const providerValue = React.useMemo(() => ({
    currentUser,
    setCurrentUser,
    updateUserSession,
    loadingUser: finalLoadingState,
    fetchUserData,
    telegramAuthError
  }), [currentUser, updateUserSession, finalLoadingState, fetchUserData, telegramAuthError]);

  return (
    <UserContext.Provider value={providerValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
