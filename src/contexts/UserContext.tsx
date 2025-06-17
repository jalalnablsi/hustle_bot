
'use client';

import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWebApp, useInitData } from '@telegram-apps/sdk-react';

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  updateUserSession: (updatedUserData: Partial<AppUser>) => void;
  loadingUser: boolean;
  fetchUserData: (isInitialAuth?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);

  const webApp = useWebApp(); // Hook from @telegram-apps/sdk-react
  const initData = useInitData(); // Hook from @telegram-apps/sdk-react

  const fetchUserData = useCallback(async (isInitialAuth = false): Promise<AppUser | null> => {
    if (!isInitialAuth) setLoadingUser(true); // Only set loading if it's not part of the initial sequence driven by initData
    
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
          setTelegramAuthError(null); // Clear auth error on successful fetch
          return validatedUser;
        } else {
          setCurrentUser(null);
          if (isInitialAuth && data.error) { // Only set general auth error if it's part of initial sequence and API returns error
            setTelegramAuthError(data.error === 'User not found. Please login again.' ? 'Session invalid or user not found. Please relaunch.' : data.error);
          }
        }
      } else {
        console.warn('UserContext: Failed to fetch user data from /api/auth/me, status:', response.status);
        if (isInitialAuth) {
            setTelegramAuthError(`Failed to fetch user data (status: ${response.status}). Relaunch might be needed.`);
        }
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('UserContext: Exception during fetch user data:', error);
      if (isInitialAuth) {
        setTelegramAuthError('Network error while fetching user data. Check connection.');
      }
      setCurrentUser(null);
    } finally {
        // Ensure loading is set to false after any fetch attempt, especially initial ones
        if (isInitialAuth || !currentUser) setLoadingUser(false);
    }
    return null;
  }, [currentUser]);

  useEffect(() => {
    // This effect handles the initial Telegram authentication flow
    // It depends on `initData` from the @telegram-apps/sdk-react hook
    // and the `webApp` object for SDK interactions.

    setLoadingUser(true); // Start loading as soon as context is used
    setTelegramAuthError(null);

    if (webApp && initData) { // initData is InitData from the SDK
      webApp.ready(); // Signal to Telegram client that the app is ready
      webApp.expand(); // Expand the Web App to full screen

      const initDataString = webApp.initData; // The raw initData string

      if (initDataString) {
        // We have the raw initData string, proceed to login with backend
        fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initDataString }), 
        })
        .then(async (loginResponse) => {
          if (!loginResponse.ok) {
            const errorData = await loginResponse.json().catch(() => ({ error: "Login API request failed with unparseable response" }));
            throw new Error(errorData.error || `Login to backend failed (status: ${loginResponse.status}). Please try relaunching.`);
          }
          // Login to backend was successful (cookie should be set by server)
          // Now fetch the full user profile using the established session
          return fetchUserData(true); // true indicates this is part of the initial auth sequence
        })
        .catch((error: any) => {
          console.error('Telegram login processing error:', error);
          setTelegramAuthError(error.message || 'Failed to process Telegram login. Please relaunch from Telegram.');
          setCurrentUser(null);
          setLoadingUser(false);
        });
      } else {
        // This case should ideally not happen if `initData` (the hook's result) is available,
        // as `webApp.initData` (the raw string) should also be available.
        // But as a fallback, try fetching user if a session might already exist.
        console.warn("UserContext: SDK's initData object is available, but raw initData string is empty. This is unexpected. Attempting to fetch user data with existing session.");
        fetchUserData(true).catch(e => {
            setTelegramAuthError('initData string was empty, and fallback session fetch failed. Relaunch from Telegram.');
            setCurrentUser(null);
            setLoadingUser(false);
        });
      }
    } else if (!initData && webApp) {
        // WebApp SDK is available, but initData is not (yet).
        // This might mean the app is not launched with user context or SDK is still initializing.
        // The SDKProvider should handle initial loading. If initData remains null after a reasonable time,
        // it implies an issue with how the Web App was launched.
        console.warn("UserContext: Telegram WebApp SDK ready, but initData is null. The app might not have been launched with user context.");
        // Attempt to fetch user data just in case a session already exists from a previous run (less likely for first-time auth)
        fetchUserData(true).then(existingUser => {
            if (!existingUser) {
                setTelegramAuthError('Telegram initData is missing. Please ensure the app is launched correctly with user context (e.g., via a bot button).');
            }
        }).catch(e => {
            setTelegramAuthError('Error during fallback session fetch. Relaunch from Telegram.');
        }).finally(() => {
            setLoadingUser(false); // Ensure loading is false if initData isn't coming
        });
    } else if (!webApp) {
        // This case means the useWebApp() hook returned null, indicating SDK is not available.
        // SDKProvider should ideally handle this, but if context runs before provider, this could occur.
        // Or if it's truly not a Telegram environment.
        setTelegramAuthError('Telegram WebApp SDK not available. Please launch the app from within Telegram.');
        setCurrentUser(null);
        setLoadingUser(false);
    }
    // setLoadingUser(false) is handled within fetchUserData or error catches
  }, [webApp, initData, fetchUserData]);


  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) {
        // This case should be rare if login flow is robust.
        // Potentially, the app could be trying to update before currentUser is set after login.
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

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, updateUserSession, loadingUser, fetchUserData, telegramAuthError }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
