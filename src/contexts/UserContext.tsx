
'use client';

import React from 'react';
import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { retrieveLaunchParams } from '@telegram-apps/sdk'; // Use direct import
import { useMiniApp } from '@telegram-apps/sdk-react'; // For SDK functions

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
  const [initDataRawState, setInitDataRawState] = React.useState<string | null | undefined>(undefined); // undefined: not yet checked, null: checked & not found

  const miniApp = useMiniApp(); // For .ready(), .expand()

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (isMounted && initDataRawState === undefined) { // Only try to retrieve once if not already attempted
      // console.log("UserContext: Component mounted. Attempting to retrieve launch params directly.");
      try {
        const launchParams = retrieveLaunchParams();
        // console.log("UserContext: retrieveLaunchParams result:", launchParams);
        if (launchParams.initDataRaw) {
          // console.log("UserContext: initDataRaw found directly:", launchParams.initDataRaw.substring(0, 50) + "...");
          setInitDataRawState(launchParams.initDataRaw);
        } else {
          // console.error("UserContext: initDataRaw is NOT available from retrieveLaunchParams directly.");
          setInitDataRawState(null); // Mark as checked but not found
          setTelegramAuthError('Telegram launch parameters (initData) were not found directly. Please ensure app is launched correctly via Telegram.');
          setCurrentUser(null);
          setLoadingUserInternal(false);
        }
      } catch (e: any) {
        // console.error("UserContext: Error in retrieveLaunchParams directly:", e);
        setInitDataRawState(null); // Mark as checked, error occurred
        setTelegramAuthError(`Error retrieving launch parameters directly: ${e.message}. Relaunch from Telegram.`);
        setCurrentUser(null);
        setLoadingUserInternal(false);
      }
    }
  }, [isMounted, initDataRawState]);


  const initializeTelegramSession = React.useCallback(async (retrievedInitDataRaw: string) => {
    setTelegramAuthError(null);
    // setLoadingUserInternal(true); // Already true or handled by caller

    try {
      if (miniApp && typeof miniApp.ready === 'function') {
        miniApp.ready();
      }
      if (miniApp && typeof miniApp.expand === 'function') {
         miniApp.expand();
      }

      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: retrievedInitDataRaw }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok || !loginData.success) {
        throw new Error(loginData.error || `Login failed (status: ${loginResponse.status}). Please relaunch. Details: ${JSON.stringify(loginData.details || {})}`);
      }
      
      const user = await fetchUserData(true); 
      if (!user) {
        if (!telegramAuthError) { // Check if fetchUserData already set an error
          setTelegramAuthError("Failed to retrieve user details after login. Please relaunch.");
        }
      }
    } catch (error: any) {
      console.error('UserContext: Error during initializeTelegramSession:', error);
      setTelegramAuthError(error.message || 'An unexpected error occurred during session initialization. Please relaunch from Telegram.');
      setCurrentUser(null);
    } finally {
      setLoadingUserInternal(false); // CRITICAL: Ensure loading stops
    }
  }, [miniApp, fetchUserData, telegramAuthError]); // fetchUserData is a dependency


  React.useEffect(() => {
    if (isMounted && initDataRawState) { // initDataRawState is now a string
      const timerId = setTimeout(() => {
        initializeTelegramSession(initDataRawState);
      }, 150); // Short delay
      return () => clearTimeout(timerId);
    } else if (isMounted && initDataRawState === null) {
      // This means initData was checked, not found, and error already set by the first effect.
      // Ensure loading is false if it hasn't been set by that path.
      if (loadingUserInternal) {
          setLoadingUserInternal(false);
      }
    }
  }, [isMounted, initDataRawState, initializeTelegramSession, loadingUserInternal]);


  const fetchUserData = React.useCallback(async (isInitialAuthCall = false): Promise<AppUser | null> => {
    if (!isInitialAuthCall) {
      setLoadingUserInternal(true);
    }
    // Ensure any pre-existing auth error is cleared if we are re-fetching, unless it's an initial auth call
    if (!isInitialAuthCall) {
        setTelegramAuthError(null);
    }

    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (response.ok && data.success && data.user) {
        setCurrentUser(data.user as AppUser);
        if (!isInitialAuthCall) setTelegramAuthError(null); // Clear error on successful standalone fetch
        return data.user as AppUser;
      } else {
        setCurrentUser(null);
        const errorMsg = data.error || `Failed to authenticate user session (/api/auth/me status: ${response.status}).`;
        setTelegramAuthError(errorMsg); // Set error here
      }
    } catch (error: any) {
      console.error("UserContext: Network error in fetchUserData:", error);
      setTelegramAuthError('Network error while fetching user data. Please check your connection.');
      setCurrentUser(null);
    } finally {
      if (!isInitialAuthCall) {
        setLoadingUserInternal(false); // Only set loading false here for standalone calls
      }
    }
    return null;
  }, []); // Removed telegramAuthError from dependency array to prevent potential loops if fetch itself causes an error

  const updateUserSession = React.useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) return null;
      const newUser = { ...prevUser, ...updatedUserData };
      // Ensure numeric fields are numbers
      (Object.keys(updatedUserData) as Array<keyof AppUser>).forEach(key => {
        if (['gold_points', 'diamond_points', 'purple_gem_points', 'blue_gem_points', 'referrals_made', 'referral_gold_earned', 'referral_diamond_earned', 'ad_spins_used_today_count', 'ad_views_today_count', 'bonus_spins_available', 'daily_reward_streak', 'daily_ad_views_limit', 'stake_builder_high_score'].includes(key)) {
          (newUser as any)[key] = Number(updatedUserData[key]) || 0;
        } else if (key === 'initial_free_spin_used') {
          (newUser as any)[key] = Boolean(updatedUserData[key]);
        }
      });
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
