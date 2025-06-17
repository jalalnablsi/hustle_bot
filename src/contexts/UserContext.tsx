
'use client';

import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Keep the global Window interface declaration
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          start_param?: string;
          [key: string]: any; 
        };
        ready: () => void;
        expand: () => void;
        MainButton: {
            show: () => void;
            hide: () => void;
            setText: (text: string) => void;
            onClick: (callback: () => void) => void;
            offClick: (callback: () => void) => void;
            enable: () => void;
            disable: () => void;
        };
        [key: string]: any; 
      };
    };
  }
}

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

  const fetchUserData = useCallback(async (isInitialAuth = false): Promise<AppUser | null> => {
    // setLoadingUser(true) will be handled by initializeTelegramSession
    
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
          if (isInitialAuth) {
             setTelegramAuthError(data.error === 'User not found. Please login again.' ? 'Session invalid or user not found. Please relaunch from Telegram.' : (data.error || 'Failed to authenticate user session.'));
          }
        }
      } else {
        console.warn('UserContext: /api/auth/me fetch failed, status:', response.status);
        if (isInitialAuth) {
            setTelegramAuthError(`User session fetch failed (status: ${response.status}). Please relaunch.`);
        }
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('UserContext: Exception during fetch user data:', error);
      if (isInitialAuth) {
        setTelegramAuthError('Network error fetching user session. Check connection.');
      }
      setCurrentUser(null);
    } finally {
      if (isInitialAuth || !currentUser) { // Ensure loading is set to false after initial auth or if no user
         setLoadingUser(false);
      }
    }
    return null;
  }, [currentUser]); // currentUser added to dependencies for final setLoadingUser state

  const initializeTelegramSession = useCallback(async () => {
    setLoadingUser(true); // Set loading true at the very beginning of the process
    setTelegramAuthError(null);

    const processTelegramData = async () => {
        try {
            if (typeof window.Telegram?.WebApp === 'object') {
                window.Telegram.WebApp.ready(); 
                window.Telegram.WebApp.expand(); 

                const initDataString = window.Telegram.WebApp.initData;
                
                if (initDataString) {
                    const loginResponse = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ initDataString }), 
                    });

                    if (!loginResponse.ok) {
                        const errorData = await loginResponse.json().catch(() => ({ error: "Login API request failed with unparseable response" }));
                        throw new Error(errorData.error || `Login to backend failed (status: ${loginResponse.status}). Relaunch from Telegram.`);
                    }
                    
                    const user = await fetchUserData(true); 
                    if (!user && !telegramAuthError) { 
                        setTelegramAuthError("User data could not be retrieved after login. Please relaunch.");
                    }
                } else {
                    console.warn("UserContext: Telegram WebApp is ready, but initData is empty. Trying to fetch user with existing session.");
                    const existingUser = await fetchUserData(true);
                    if (!existingUser) {
                        setTelegramAuthError('Telegram user identification data (initData) is missing. Please ensure you launch the app correctly through the bot.');
                    }
                }
            } else {
                 setTelegramAuthError('Not running in a Telegram Web App environment. Please launch the app from Telegram.');
                 setCurrentUser(null); // Ensure currentUser is null if SDK not found
            }
        } catch (error: any) {
            console.error('UserContext: Telegram login processing error:', error);
            setTelegramAuthError(error.message || 'Failed to process Telegram login. Please relaunch from Telegram.');
            setCurrentUser(null);
        } finally {
            setLoadingUser(false); // Set loading to false in finally block of processTelegramData
        }
    };
    
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        processTelegramData();
    } else {
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
                processTelegramData();
            } else {
                 setTelegramAuthError('Telegram SDK not detected (timeout). Please launch from Telegram.');
                 setCurrentUser(null);
                 setLoadingUser(false);
            }
        }, 700); // Increased timeout slightly
    }

  }, [fetchUserData, telegramAuthError]); // telegramAuthError to prevent re-runs if error already set

  useEffect(() => {
    initializeTelegramSession();
  }, [initializeTelegramSession]); // Runs once on mount

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
    
