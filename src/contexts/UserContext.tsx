
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
  fetchUserData: (isInitialAuthAttempt?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);

  const webApp = useWebApp(); // Hook from @telegram-apps/sdk-react
  const initData = useInitData(); // Hook from @telegram-apps/sdk-react

  const fetchUserData = useCallback(async (isInitialAuthAttempt = false): Promise<AppUser | null> => {
    if (!isInitialAuthAttempt) setLoadingUser(true);
    
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
          if (isInitialAuthAttempt && data.error) {
            setTelegramAuthError(data.error === 'User not found. Please login again.' ? 'Session invalid or user not found. Please relaunch.' : data.error);
          }
        }
      } else {
        console.warn('UserContext: Failed to fetch user data from /api/auth/me, status:', response.status);
        if (isInitialAuthAttempt) {
            setTelegramAuthError(`Failed to fetch user data (status: ${response.status}). Relaunch might be needed.`);
        }
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('UserContext: Exception during fetch user data:', error);
      if (isInitialAuthAttempt) {
        setTelegramAuthError('Network error while fetching user data. Check connection.');
      }
      setCurrentUser(null);
    } finally {
        // Ensure loading is set to false after any fetch attempt, especially initial ones
        // Only set loading false if it was an initial attempt or if user is still null.
        // This prevents flickering if fetchUserData is called for a refresh.
        if (isInitialAuthAttempt || !currentUser) {
            setLoadingUser(false);
        }
    }
    return null;
  }, [currentUser]); // Added currentUser to dep array to re-evaluate loadingUser correctly


  useEffect(() => {
    // This effect handles the initial Telegram authentication flow
    // It depends on `initData` from the @telegram-apps/sdk-react hook
    // and the `webApp` object for SDK interactions.
    setLoadingUser(true);
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
        // This case implies the `initData` object from the hook exists, but the raw string `webApp.initData` is empty.
        // This is unusual if the hook provides `initData`.
        console.warn("UserContext: SDK's initData object is available, but raw webApp.initData string is empty. This is unexpected. Attempting to fetch user data with existing session.");
        fetchUserData(true).catch(e => {
            setTelegramAuthError('initData string was empty, and fallback session fetch failed. Relaunch from Telegram.');
            setCurrentUser(null);
            setLoadingUser(false);
        });
      }
    } else if (!webApp && !initData) {
        // Neither webApp nor initData is available. This suggests the SDK is not initializing or not in a Telegram env.
        // This state might be transient as SDKProvider initializes.
        // If it persists, it's a problem.
        // No immediate error set here; let it retry or wait if SDKProvider eventually provides them.
        // If after a short period, they are still null, it's an issue.
        // Consider adding a timeout or a check if it's been too long without SDK data.
        console.warn("UserContext: webApp or initData from @telegram-apps/sdk-react not yet available. Waiting for SDKProvider.");
        // A timeout to set error if still not available after a delay
        const timer = setTimeout(() => {
            if (!webApp && !initData && loadingUser) { // Check loadingUser to avoid setting error if resolved
                setTelegramAuthError('Telegram SDK could not initialize. Please launch the app from within Telegram.');
                setLoadingUser(false);
            }
        }, 3000); // 3-second timeout for SDK to initialize
        return () => clearTimeout(timer);
    }
    // Note: setLoadingUser(false) is primarily handled within fetchUserData or the error catches.
    // If initData or webApp are null, the effect might re-run when they become available.
  }, [webApp, initData, fetchUserData, loadingUser]); // Added loadingUser to dependencies


  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
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

