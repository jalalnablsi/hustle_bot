
'use client';

import React from 'react';
import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { useMiniApp, useInitData, type LaunchParams } from '@telegram-apps/sdk-react';

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

  const initDataResult = useInitData(); // Provides LaunchParams | undefined | null
  const miniApp = useMiniApp();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchUserData = React.useCallback(async (isInitialAuthCall = false): Promise<AppUser | null> => {
    if (!isInitialAuthCall) { // Only manage loading for standalone fetches
      setLoadingUserInternal(true);
      setTelegramAuthError(null);
    }
    
    try {
      const response = await fetch('/api/auth/me'); 
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
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
            referral_link: data.user.referral_link || `https://t.me/HustleSoulBot?start=${data.user.telegram_id}`,
            referrals_made: Number(data.user.referrals_made) || 0,
            referral_gold_earned: Number(data.user.referral_gold_earned) || 0,
            referral_diamond_earned: Number(data.user.referral_diamond_earned) || 0,
            initial_free_spin_used: Boolean(data.user.initial_free_spin_used),
            ad_spins_used_today_count: Number(data.user.ad_spins_used_today_count) || 0,
            ad_views_today_count: Number(data.user.ad_views_today_count) || 0,
            bonus_spins_available: Number(data.user.bonus_spins_available) || 0,
            daily_reward_streak: Number(data.user.daily_reward_streak) || 0,
            last_daily_reward_claim_at: data.user.last_daily_reward_claim_at || null,
            daily_ad_views_limit: Number(data.user.daily_ad_views_limit) || 50,
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: data.user.last_login || new Date().toISOString(),
            game_hearts: typeof data.user.game_hearts === 'object' && data.user.game_hearts !== null ? data.user.game_hearts : {},
            stake_builder_high_score: Number(data.user.stake_builder_high_score) || 0,
            last_heart_replenished: data.user.last_heart_replenished || null,
          };
          setCurrentUser(validatedUser);
          if (!isInitialAuthCall) setTelegramAuthError(null); // Clear general error on successful standalone fetch
          return validatedUser;
        } else {
          setCurrentUser(null);
          const errorMsg = data.error || 'Failed to authenticate user session via /api/auth/me.';
          // Only set error if it's part of initial auth or a specific "user not found" type error
          if (isInitialAuthCall || errorMsg.includes('User not found')) {
             setTelegramAuthError(errorMsg);
          }
        }
      } else {
        const errorMsg = `Failed to fetch user data (status: ${response.status}). Relaunch might be needed.`;
        if (isInitialAuthCall) setTelegramAuthError(errorMsg);
        setCurrentUser(null);
      }
    } catch (error) {
      const errorMsg = 'Network error while fetching user data. Please check your connection.';
      if (isInitialAuthCall) setTelegramAuthError(errorMsg);
      setCurrentUser(null);
    } finally {
        // Loading is managed by initializeTelegramSession for initial auth sequence
        if (!isInitialAuthCall) {
            setLoadingUserInternal(false);
        }
    }
    return null;
  }, []);

  const initializeTelegramSession = React.useCallback(async (initDataRawToUse: string) => {
    // setLoadingUserInternal(true) is managed by the calling useEffect's logic or initial state
    // setTelegramAuthError(null); // Clear previous errors for this specific attempt IF this function is called directly.
                             // However, error is managed by the useEffect that calls this for initial load.

    try {
      if (miniApp) {
        miniApp.ready();
        miniApp.expand();
      } else {
        console.warn("UserContext: miniApp instance not available at initializeTelegramSession call. Skipping ready/expand.");
      }

      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: initDataRawToUse }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({ error: "Login API request failed with unparseable response" }));
        throw new Error(errorData.error || `Login to backend failed (status: ${loginResponse.status}). Please try relaunching.`);
      }
      
      const user = await fetchUserData(true); // true indicates this is part of the initial auth sequence
      if (!user && !telegramAuthError) { // If fetchUserData returned null but didn't set an error, set a generic one.
          setTelegramAuthError("Failed to retrieve user details after login. Please relaunch.");
      }

    } catch (error: any) {
      console.error('UserContext: Telegram login processing error:', error);
      setTelegramAuthError(error.message || 'Failed to process Telegram login. Relaunch from Telegram.');
      setCurrentUser(null);
    } finally {
      // This is the single point where loading finishes for the entire initial session setup sequence
      // console.log("UserContext: initializeTelegramSession finished. Setting loadingUserInternal to false.");
      setLoadingUserInternal(false);
    }
  }, [miniApp, fetchUserData, telegramAuthError]); // Added telegramAuthError to dependencies

  React.useEffect(() => {
    if (!isMounted) {
      // console.log("UserContext: Not mounted yet.");
      return; // Wait for client mount
    }

    // console.log("UserContext Mounted. initDataResult:", initDataResult);

    if (initDataResult === undefined) {
      // SDK is still loading or hasn't provided initData status yet.
      // loadingUserInternal should remain true (or be set true by the caller if this effect re-runs).
      // console.log("UserContext: initDataResult is undefined, SDK likely loading.");
      if (!loadingUserInternal) setLoadingUserInternal(true); // Ensure loading is true if SDK is still working
      return;
    }

    if (initDataResult === null || !initDataResult.initDataRaw) {
      // SDK has determined initData is not available or invalid.
      // console.error("UserContext: initDataResult is null or initDataRaw is missing. Setting auth error.");
      setTelegramAuthError(
        'Telegram launch parameters (initData) were not found or are invalid. Please ensure the app is launched correctly through the bot.'
      );
      setCurrentUser(null);
      setLoadingUserInternal(false); // Critical: stop loading on definitive failure.
      return;
    }

    // At this point, initDataResult.initDataRaw is available.
    // console.log("UserContext: initDataRaw found. Scheduling login attempt with a delay.");
    
    // Ensure loading is true before starting the async operation if it was somehow set false.
    if (!loadingUserInternal) setLoadingUserInternal(true); 

    const timerId = setTimeout(() => {
      // console.log("UserContext: Timeout expired, calling initializeTelegramSession with initDataRaw:", initDataResult.initDataRaw);
      initializeTelegramSession(initDataResult.initDataRaw as string); // Cast as string, already checked for null/undefined
    }, 300); // 300ms delay

    return () => clearTimeout(timerId); // Cleanup timeout

  }, [isMounted, initDataResult, initializeTelegramSession, loadingUserInternal]);


  const updateUserSession = React.useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) {
        console.warn("updateUserSession called when currentUser is null. Update ignored. Data:", updatedUserData);
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

    
