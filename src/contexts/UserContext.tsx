
'use client';

import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void; // Allow setting to null for logout/error
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
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          const validatedUser: AppUser = {
            ...data.user,
            id: data.user.id || `mock-id-${data.user.telegram_id}`,
            gold_points: Number(data.user.gold_points) || 0,
            diamond_points: Number(data.user.diamond_points) || 0,
            purple_gem_points: Number(data.user.purple_gem_points) || 0,
            blue_gem_points: Number(data.user.blue_gem_points) || 0,
            referrals_made: Number(data.user.referrals_made) || 0,
            initial_free_spin_used: Boolean(data.user.initial_free_spin_used),
            ad_spins_used_today_count: Number(data.user.ad_spins_used_today_count) || 0,
            bonus_spins_available: Number(data.user.bonus_spins_available) || 0,
            daily_ad_views_limit: Number(data.user.daily_ad_views_limit) || 3,
            daily_reward_streak: Number(data.user.daily_reward_streak) || 0,
            last_daily_reward_claim_at: data.user.last_daily_reward_claim_at || null,
          };
          setCurrentUser(validatedUser);
          setLoadingUser(false);
          return validatedUser;
        } else {
          // If /api/auth/me reports user not found (e.g. new session, cookie expired)
          // it might return success: false, or success: true but user: null
          setCurrentUser(null);
        }
      } else {
        // Network or server error for /api/auth/me
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('UserContext: Error fetching user data:', error);
      setCurrentUser(null);
    }
    setLoadingUser(false);
    return null;
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) return null; // Or handle as new user if appropriate
      // Ensure numeric fields are correctly handled
      const newGold = updatedUserData.gold_points !== undefined ? Number(updatedUserData.gold_points) : prevUser.gold_points;
      const newDiamonds = updatedUserData.diamond_points !== undefined ? Number(updatedUserData.diamond_points) : prevUser.diamond_points;
      const newPurpleGems = updatedUserData.purple_gem_points !== undefined ? Number(updatedUserData.purple_gem_points) : prevUser.purple_gem_points;
      const newSpins = updatedUserData.bonus_spins_available !== undefined ? Number(updatedUserData.bonus_spins_available) : prevUser.bonus_spins_available;

      return {
        ...prevUser,
        ...updatedUserData,
        gold_points: newGold,
        diamond_points: newDiamonds,
        purple_gem_points: newPurpleGems,
        bonus_spins_available: newSpins,
      };
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
