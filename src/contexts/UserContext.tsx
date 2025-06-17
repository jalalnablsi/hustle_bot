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
  fetchUserData: (isInitialAuth?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
  const [loadingUserInternal, setLoadingUserInternal] = React.useState(true);
  const [telegramAuthError, setTelegramAuthError] = React.useState<string | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  const miniApp = useMiniApp(); // Called unconditionally as per React hook rules
  const initDataUtils = useInitData(); // Called unconditionally

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchUserData = React.useCallback(async (isInitialAuth = false): Promise<AppUser | null> => {
    if (isInitialAuth || !currentUser) setLoadingUserInternal(true);
    
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
          setTelegramAuthError(null); 
          return validatedUser;
        } else {
          setCurrentUser(null);
          if (data.error === 'User not found. Please login again.') {
             setTelegramAuthError('Session invalid or user not found. Please relaunch.');
          } else if (isInitialAuth) { 
            setTelegramAuthError(data.error || 'Failed to authenticate user via /api/auth/me.');
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
        // setLoadingUserInternal should be set to false only after all auth/fetch attempts
        if (isInitialAuth || !currentUser ) {
            setLoadingUserInternal(false);
        }
    }
    return null;
  }, [currentUser]);


  const initializeTelegramSession = React.useCallback(async (initDataString?: string) => {
    setLoadingUserInternal(true);
    setTelegramAuthError(null);

    if (!initDataString) {
      setTelegramAuthError(
        'Telegram initData not found. Please ensure the app is launched correctly from Telegram.'
      );
      setCurrentUser(null);
      setLoadingUserInternal(false);
      return;
    }

    try {
      // initDataString is now guaranteed to be present here by the calling useEffect
      // miniApp might still be null/undefined if useMiniApp() had issues, but initDataString is key for login.
      if (miniApp) {
        miniApp.ready(); // Signal readiness to Telegram client
        miniApp.expand(); // Expand the Web App
      } else {
        console.warn("UserContext: miniApp instance not available from useMiniApp() at time of initializeTelegramSession, but proceeding with initDataString for login.");
      }

      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: initDataString }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({ error: "Login API request failed, unparseable response" }));
        throw new Error(errorData.error || `Login to backend failed (status: ${loginResponse.status}). Please try relaunching.`);
      }
      
      await fetchUserData(true); // Fetch full user profile after successful login
    } catch (error: any) {
      console.error('UserContext: Telegram login processing error:', error);
      setTelegramAuthError(error.message || 'Failed to process Telegram login. Relaunch from Telegram.');
      setCurrentUser(null);
    } finally {
      setLoadingUserInternal(false);
    }
  }, [miniApp, fetchUserData]); // Dependencies for initializeTelegramSession

  React.useEffect(() => {
    if (isMounted) {
      // initDataUtils can be null initially if SDK is still loading
      const rawInitData = initDataUtils?.initDataRaw;
      if (rawInitData) {
        initializeTelegramSession(rawInitData);
      } else {
        // This block will run if useInitData() returns null/undefined for initDataRaw after mount.
        // It might be too early, or initData is genuinely missing.
        // We set a timeout to give the SDK a bit more time to populate initDataUtils.
        const timer = setTimeout(() => {
            const currentRawInitData = initDataUtils?.initDataRaw; // Re-check
            if (currentRawInitData) {
                initializeTelegramSession(currentRawInitData);
            } else if (!loadingUserInternal) { // Only set error if not already processing from a successful earlier fetch
                setTelegramAuthError(
                    'Failed to retrieve Telegram InitData after a delay. Please relaunch from Telegram.'
                );
                setCurrentUser(null);
                setLoadingUserInternal(false);
            }
        }, 750); // Increased delay to 750ms
        return () => clearTimeout(timer);
      }
    }
  }, [isMounted, initDataUtils, initializeTelegramSession, loadingUserInternal]); // Add loadingUserInternal to prevent setting error if already loading

  const updateUserSession = React.useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) {
        // This case should ideally not happen if login flow is robust.
        // If it does, it might indicate an issue where an update is attempted before user is set.
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
  
  // loadingUser is true if not mounted OR if internal loading (e.g., API calls) is happening.
  const loadingUser = !isMounted || loadingUserInternal;

  const providerValue = React.useMemo(() => ({
    currentUser,
    setCurrentUser,
    updateUserSession,
    loadingUser,
    fetchUserData,
    telegramAuthError
  }), [currentUser, updateUserSession, loadingUser, fetchUserData, telegramAuthError]);

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
