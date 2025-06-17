
'use client';

import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
        [key: string]: any; // For other WebApp properties
      };
    };
  }
}

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  updateUserSession: (updatedUserData: Partial<AppUser>) => void;
  loadingUser: boolean;
  fetchUserData: (isRetry?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);

  const fetchUserData = useCallback(async (isInitialAuthSequence = false): Promise<AppUser | null> => {
    if (!isInitialAuthSequence) setLoadingUser(true);
    
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
          setTelegramAuthError(null); // Clear any previous auth error on success
          return validatedUser;
        } else {
          setCurrentUser(null);
          if (data.error === 'User not found. Please login again.') {
             setTelegramAuthError('Session expired or user not found. Please relaunch from Telegram.');
          } else if (isInitialAuthSequence) { 
            setTelegramAuthError(data.error || 'Failed to authenticate user via /api/auth/me.');
          }
        }
      } else {
        console.warn('UserContext: Failed to fetch user data from /api/auth/me, status:', response.status);
        if (isInitialAuthSequence) {
            setTelegramAuthError(`Failed to fetch user data (status: ${response.status}). Please try relaunching.`);
        }
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('UserContext: Exception during fetch user data:', error);
      if (isInitialAuthSequence) {
        setTelegramAuthError('Network error while fetching user data. Please check your connection.');
      }
      setCurrentUser(null);
    } finally {
        setLoadingUser(false);
    }
    return null;
  }, []);

  const initializeTelegramSession = useCallback(async () => {
    setLoadingUser(true);
    setTelegramAuthError(null);

    const attemptInitialization = async () => {
        if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
            try {
                window.Telegram.WebApp.ready(); // Inform Telegram client the app is ready
                window.Telegram.WebApp.expand(); // Expand the Web App to full height

                const initDataString = window.Telegram.WebApp.initData;
                
                if (initDataString) {
                    const loginResponse = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ initDataString }), // Send the whole string
                    });

                    if (!loginResponse.ok) {
                        const errorData = await loginResponse.json().catch(() => ({ error: "Login API request failed to parse response" }));
                        throw new Error(errorData.error || `Login to backend failed (status: ${loginResponse.status}). Please ensure the app is launched from Telegram.`);
                    }
                    
                    // Backend has set the cookie if login was successful. Now fetch user data.
                    await fetchUserData(true); 
                } else {
                    // WebApp is ready, but no initData. This implies the user might have an existing session.
                    console.warn("UserContext: Telegram WebApp is ready, but initData is empty. Attempting to fetch user with existing session.");
                    const existingUser = await fetchUserData(true);
                    if (!existingUser) {
                        setTelegramAuthError('Telegram initData is missing. Please ensure you launch the app through the bot.');
                    }
                }
            } catch (error: any) {
                console.error('UserContext: Telegram login processing error:', error);
                setTelegramAuthError(error.message || 'Failed to process Telegram login. Please relaunch from Telegram.');
                setCurrentUser(null);
                setLoadingUser(false);
            }
        } else {
            setTelegramAuthError('Not running in a Telegram Web App environment. Please launch the app from Telegram.');
            setCurrentUser(null);
            setLoadingUser(false);
        }
    };

    // Wait a brief moment for the Telegram SDK to potentially inject itself
    // This is a common pattern for Web Apps.
    if (typeof window !== 'undefined' && (!window.Telegram || !window.Telegram.WebApp)) {
        setTimeout(attemptInitialization, 300); // Increased delay slightly
    } else {
        attemptInitialization();
    }

  }, [fetchUserData]);

  useEffect(() => {
    initializeTelegramSession();
  }, [initializeTelegramSession]);

  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) {
        // This scenario is less ideal; updates should ideally happen on an existing user object.
        // If this happens, it might indicate a race condition or an unexpected state.
        // For now, if there's an ID, attempt to construct a partial user.
        // Otherwise, this update might be lost if currentUser is null.
        console.warn("updateUserSession called when prevUser is null. Data:", updatedUserData);
        if (updatedUserData.id) {
            // This is a bit of a stretch, ideally, the user object is fully formed first.
            return { ...updatedUserData } as AppUser; 
        }
        return null;
      }
      const newUser = { ...prevUser };
      for (const key in updatedUserData) {
        if (Object.prototype.hasOwnProperty.call(updatedUserData, key)) {
          const K = key as keyof AppUser;
          const value = updatedUserData[K];
          if (K === 'gold_points' || K === 'diamond_points' || K === 'purple_gem_points' || 
              K === 'blue_gem_points' || K === 'referrals_made' || 
              K === 'referral_gold_earned' || K === 'referral_diamond_earned' ||
              K === 'ad_spins_used_today_count' || K === 'ad_views_today_count' ||
              K === 'bonus_spins_available' || K === 'daily_reward_streak' ||
              K === 'daily_ad_views_limit' || K === 'stake_builder_high_score') {
            (newUser[K] as any) = Number(value); // Allow 0
          } else if (K === 'initial_free_spin_used') {
            (newUser[K] as any) = Boolean(value);
          } else if (K === 'game_hearts') {
             (newUser[K] as any) = typeof value === 'object' && value !== null ? value : {};
          }
           else {
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
    
