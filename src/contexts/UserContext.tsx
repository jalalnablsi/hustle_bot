'use client';

import React from 'react';
import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
// Import retrieveLaunchParams from the base SDK, and useMiniApp from the React SDK for other functionalities
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

  // useMiniApp for SDK functionalities like ready() and expand()
  const miniApp = useMiniApp();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchUserData = React.useCallback(async (
    isInitialAuthCall = false
  ): Promise<AppUser | null> => {
    if (!isInitialAuthCall) {
      // Only manage loading for standalone fetches, not during initial auth sequence
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
          if (!isInitialAuthCall) setTelegramAuthError(null);
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
        if (isInitialAuthCall) setTelegramAuthError(errorMsg); // Set error for initial auth calls
        setCurrentUser(null);
      }
    } catch (error) {
      const errorMsg = 'Network error while fetching user data. Please check your connection.';
      if (isInitialAuthCall) setTelegramAuthError(errorMsg); // Set error for initial auth calls
      setCurrentUser(null);
    } finally {
      // Loading is managed by initializeTelegramSession for initial auth sequence
      // or by the caller for standalone fetches.
        if (!isInitialAuthCall) {
            setLoadingUserInternal(false);
        }
    }
    return null;
  }, []); // Removed telegramAuthError from dependencies to avoid re-triggering fetch on error

  const initializeTelegramSession = React.useCallback(async (initDataString: string) => {
    setTelegramAuthError(null); // Clear previous auth errors at the start of a new attempt
    try {
      // Signal to Telegram that the Mini App is ready and expand it
      if (miniApp) {
        miniApp.ready();
        miniApp.expand();
      } else {
        console.warn("UserContext: miniApp instance (from useMiniApp) not available when attempting to call ready/expand.");
      }

      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString }), // Send the raw initData string
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({ error: "Login API request failed with unparseable response" }));
        throw new Error(errorData.error || `Login to backend failed (status: ${loginResponse.status}). Please try relaunching.`);
      }
      
      // Login successful, now fetch user data
      const user = await fetchUserData(true); // true indicates this is part of the initial auth sequence
      if (!user && !telegramAuthError) { // If fetchUserData returned null but didn't set an error, set a generic one.
          // This check might be redundant if fetchUserData itself sets telegramAuthError correctly
          setTelegramAuthError("Failed to retrieve user details after successful login. Please relaunch.");
      }

    } catch (error: any) {
      console.error('UserContext: Error during initializeTelegramSession:', error);
      setTelegramAuthError(error.message || 'An unexpected error occurred during session initialization. Please relaunch from Telegram.');
      setCurrentUser(null);
    } finally {
      // This is the single point where loading finishes for the entire initial session setup sequence
      setLoadingUserInternal(false);
    }
  }, [miniApp, fetchUserData, telegramAuthError]); // Added telegramAuthError here

  React.useEffect(() => {
    if (!isMounted) {
      // console.log("UserContext: Not mounted yet.");
      return; // Wait for client mount
    }

    // console.log("UserContext Mounted. Attempting to retrieve launch params.");
    setLoadingUserInternal(true); // Start loading when this effect runs
    setTelegramAuthError(null);   // Clear previous errors

    // Try to retrieve launch parameters using the base SDK function
    const launchParams = retrieveLaunchParams();
    const initDataRaw = launchParams.initDataRaw;

    if (initDataRaw) {
      // console.log("UserContext: initDataRaw found via retrieveLaunchParams. Scheduling session initialization.");
      // A small delay can sometimes help ensure the Telegram environment is fully set up.
      const timerId = setTimeout(() => {
        initializeTelegramSession(initDataRaw);
      }, 250); // 250ms delay

      return () => clearTimeout(timerId); // Cleanup timeout if component unmounts or effect re-runs
    } else {
      // console.error("UserContext: initDataRaw is NOT available via retrieveLaunchParams.");
      setTelegramAuthError(
        'Telegram launch parameters (initData) were not found or are invalid. Please ensure the app is launched correctly through the bot.'
      );
      setCurrentUser(null);
      setLoadingUserInternal(false); // Stop loading as initData is definitively missing
    }
  }, [isMounted, initializeTelegramSession]); // initializeTelegramSession is a dependency

  const updateUserSession = React.useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) {
        // console.warn("updateUserSession called when currentUser is null. Update ignored. Data:", updatedUserData);
        return null;
      }
      const newUser = { ...prevUser };
      for (const key in updatedUserData) {
        if (Object.prototype.hasOwnProperty.call(updatedUserData, key)) {
          const K = key as keyof AppUser;
          const value = updatedUserData[K];
          // Ensure numeric fields are numbers, boolean for initial_free_spin_used
          if (['gold_points', 'diamond_points', 'purple_gem_points', 'blue_gem_points', 'referrals_made', 'referral_gold_earned', 'referral_diamond_earned', 'ad_spins_used_today_count', 'ad_views_today_count', 'bonus_spins_available', 'daily_reward_streak', 'daily_ad_views_limit', 'stake_builder_high_score'].includes(K)) {
            (newUser[K] as any) = Number(value) || 0;
          } else if (K === 'initial_free_spin_used') {
            (newUser[K] as any) = Boolean(value);
          } else if (K === 'game_hearts') {
             // Ensure game_hearts is always an object
             (newUser[K] as any) = typeof value === 'object' && value !== null ? value : {};
          } else {
            (newUser[K] as any) = value;
          }
        }
      }
      return newUser;
    });
  }, []);
  
  // The final loading state depends on whether the component is mounted AND internal loading is true
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
