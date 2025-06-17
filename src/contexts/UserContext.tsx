
'use client';

import React from 'react';
import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { useMiniApp, useInitData } from '@telegram-apps/sdk-react';

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  updateUserSession: (updatedUserData: Partial<AppUser>) => void;
  loadingUser: boolean;
  fetchUserData: (calledDuringInitialAuthSequence?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
  const [loadingUserInternal, setLoadingUserInternal] = React.useState(true);
  const [telegramAuthError, setTelegramAuthError] = React.useState<string | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  const miniApp = useMiniApp();
  const initDataUnsafe = useInitData(); // Provides LaunchParams | undefined from SDK

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchUserData = React.useCallback(async (calledDuringInitialAuthSequence = false): Promise<AppUser | null> => {
    if (!calledDuringInitialAuthSequence) {
      // Only manage loading for standalone fetches, initial load is handled by initializeTelegramSession
      setLoadingUserInternal(true);
      setTelegramAuthError(null); // Clear previous errors for this specific fetch attempt
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
          // Clear auth error ONLY if this fetch was successful and NOT part of the initial sequence
          // (initial sequence errors are handled by initializeTelegramSession)
          if (!calledDuringInitialAuthSequence) setTelegramAuthError(null);
          return validatedUser;
        } else {
          setCurrentUser(null);
          const errorMsg = data.error || 'Failed to authenticate user session.';
          // Set error only if not initial, or if it's a specific "user not found" which means login is needed
          if (!calledDuringInitialAuthSequence || errorMsg === 'User not found. Please login again.') {
             setTelegramAuthError(errorMsg);
          }
        }
      } else {
        const errorMsg = `Failed to fetch user data (status: ${response.status}). Relaunch might be needed.`;
        if (!calledDuringInitialAuthSequence) setTelegramAuthError(errorMsg);
        setCurrentUser(null);
      }
    } catch (error) {
      const errorMsg = 'Network error while fetching user data. Please check your connection.';
      if (!calledDuringInitialAuthSequence) setTelegramAuthError(errorMsg);
      setCurrentUser(null);
    } finally {
      if (!calledDuringInitialAuthSequence) {
        setLoadingUserInternal(false);
      }
    }
    return null;
  }, []); // Removed dependencies like miniApp

  const initializeTelegramSession = React.useCallback(async (initDataRawToUse: string) => {
    // setLoadingUserInternal(true) is managed by the calling useEffect for the initial load.
    setTelegramAuthError(null); // Clear previous errors for this new attempt

    try {
      if (miniApp) {
        miniApp.ready();
        miniApp.expand();
      } else {
        console.warn("UserContext: miniApp instance not available from useMiniApp() hook at time of initializeTelegramSession. Skipping ready/expand.");
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
      
      // Login to backend successful, server has set the cookie.
      // Now fetch the full user profile using the established session.
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
      setLoadingUserInternal(false);
    }
  }, [miniApp, fetchUserData, telegramAuthError]); // Added telegramAuthError

  React.useEffect(() => {
    if (!isMounted) {
      return; // Wait for AppProviders to mount, then this provider to mount.
    }

    // At this point, isMounted is true. SDKProvider has run.
    // useInitData() hook is active. Its value (initDataUnsafe) will trigger re-runs of this effect.

    if (initDataUnsafe === undefined) {
      // SDK is still working or hasn't provided data yet.
      // loadingUserInternal remains true (its default or set by a previous incomplete attempt).
      // console.log("UserContext:useEffect: Waiting for initDataUnsafe from SDK...");
      return; // Wait for initDataUnsafe to be populated by the SDK hook.
    }

    if (initDataUnsafe === null || !initDataUnsafe.initDataRaw) {
      // Case 1: SDK explicitly signals no initData is available (initDataUnsafe is null).
      // Case 2: SDK provides an object, but initDataRaw string is missing.
      // Both are failure conditions for login.
      setTelegramAuthError(
        'Telegram launch parameters (initData) were not found or are invalid. Please ensure the app is launched correctly through the bot.'
      );
      setCurrentUser(null);
      setLoadingUserInternal(false); // Definitive failure to get initData, stop loading.
      return;
    }

    // If we reach here, initDataUnsafe.initDataRaw is available.
    // Start the session initialization. setLoadingUserInternal(true) should already be active or will be set by initialize.
    // However, ensure it's true before starting the async operation if it was somehow set false by the above error block in a previous run.
    if (!loadingUserInternal) setLoadingUserInternal(true); 
    initializeTelegramSession(initDataUnsafe.initDataRaw);

  }, [isMounted, initDataUnsafe, initializeTelegramSession, loadingUserInternal]);


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
  
  const finalLoadingUser = !isMounted || loadingUserInternal;

  const providerValue = React.useMemo(() => ({
    currentUser,
    setCurrentUser,
    updateUserSession,
    loadingUser: finalLoadingUser,
    fetchUserData,
    telegramAuthError
  }), [currentUser, updateUserSession, finalLoadingUser, fetchUserData, telegramAuthError]);

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
    
