
'use client';

import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  updateUserSession: (updatedUserData: Partial<AppUser>) => void;
  loadingUser: boolean;
  fetchUserData: (isRetry?: boolean) => Promise<AppUser | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const fetchUserData = useCallback(async (isRetry = false): Promise<AppUser | null> => {
    if (!isRetry) setLoadingUser(true);
    try {
      const response = await fetch('/api/auth/me'); // This endpoint uses the cookie set by /api/login
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          // Validate and type cast data from API
          const validatedUser: AppUser = {
            ...data.user,
            id: data.user.id?.toString() || `tg-${data.user.telegram_id}`, // Ensure id is string
            telegram_id: data.user.telegram_id.toString(),
            first_name: data.user.first_name || '',
            username: data.user.username || null,
            last_name: data.user.last_name || null,
            gold_points: Number(data.user.gold_points) || 0,
            diamond_points: Number(data.user.diamond_points) || 0,
            purple_gem_points: Number(data.user.purple_gem_points) || 0,
            blue_gem_points: Number(data.user.blue_gem_points) || 0,
            referral_link: data.user.referral_link || '',
            referrals_made: Number(data.user.referrals_made) || 0,
            referral_gold_earned: Number(data.user.referral_gold_earned) || 0,
            referral_diamond_earned: Number(data.user.referral_diamond_earned) || 0,
            initial_free_spin_used: Boolean(data.user.initial_free_spin_used),
            ad_spins_used_today_count: Number(data.user.ad_spins_used_today_count) || 0,
            ad_views_today_count: Number(data.user.ad_views_today_count) || 0,
            bonus_spins_available: Number(data.user.bonus_spins_available) || 0,
            daily_reward_streak: Number(data.user.daily_reward_streak) || 0,
            last_daily_reward_claim_at: data.user.last_daily_reward_claim_at || null,
            daily_ad_views_limit: Number(data.user.daily_ad_views_limit) || 50, // Default to 50 if not set
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: data.user.last_login || new Date().toISOString(),
            // Ensure game_hearts is an object
            game_hearts: typeof data.user.game_hearts === 'object' && data.user.game_hearts !== null ? data.user.game_hearts : {},
          };
          setCurrentUser(validatedUser);
          setLoadingUser(false);
          return validatedUser;
        } else {
          setCurrentUser(null); // User not found or error in API response
        }
      } else {
         // Network error or server error (e.g., 500)
        console.error('UserContext: Failed to fetch user data, status:', response.status);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('UserContext: Exception during fetch user data:', error);
      setCurrentUser(null);
    }
    setLoadingUser(false);
    return null;
  }, []);

  useEffect(() => {
    // Initial fetch when provider mounts
    fetchUserData();
  }, [fetchUserData]);

  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) {
        // This case should ideally not happen if user is logged in.
        // If it does, it might mean we are trying to update a non-existent user.
        // For safety, we could try to cast updatedUserData to AppUser if it has enough fields,
        // or return null. For now, let's assume prevUser exists if this is called.
         console.warn("updateUserSession called when prevUser is null. Updated data:", updatedUserData);
         // Potentially, if updatedUserData contains an id, we could set it as the new currentUser.
         // However, this might bypass the intended auth flow.
         return null;
      }

      // Create a new object to ensure immutability and trigger re-renders
      const newUser = { ...prevUser };

      // Iterate over keys in updatedUserData to safely update newUser
      for (const key in updatedUserData) {
        if (Object.prototype.hasOwnProperty.call(updatedUserData, key)) {
          const K = key as keyof AppUser;
          const value = updatedUserData[K];

          // Type casting for numeric fields to prevent string concatenation or NaN issues
          if (K === 'gold_points' || K === 'diamond_points' || K === 'purple_gem_points' || 
              K === 'blue_gem_points' || K === 'referrals_made' || 
              K === 'referral_gold_earned' || K === 'referral_diamond_earned' ||
              K === 'ad_spins_used_today_count' || K === 'ad_views_today_count' ||
              K === 'bonus_spins_available' || K === 'daily_reward_streak' ||
              K === 'daily_ad_views_limit' || K === 'stake_builder_high_score') {
            (newUser[K] as any) = Number(value) || 0;
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
    <UserContext.Provider value={{ currentUser, setCurrentUser, updateUserSession, loadingUser, fetchUserData }}>
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
