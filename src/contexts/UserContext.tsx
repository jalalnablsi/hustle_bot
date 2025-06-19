
'use client';

import React from 'react';
import type { AppUser } from '@/app/types';
import type { ReactNode } from 'react';
import { retrieveLaunchParams } from '@telegram-apps/sdk';
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

  const miniApp = useMiniApp();
  // useInitData can return undefined while loading, then null if not found, or the data object.
  const initDataResult = useInitData(); 

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const initializeTelegramSession = React.useCallback(async (retrievedInitDataRaw: string) => {
    setTelegramAuthError(null);
    // setLoadingUserInternal(true); // loadingUserInternal is already true initially

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
        // Capture details if available
        const errorDetails = loginData.details ? ` Details: ${JSON.stringify(loginData.details)}` : '';
        throw new Error(loginData.error || `Login API call failed (status: ${loginResponse.status}). Please relaunch.${errorDetails}`);
      }
      
      // After successful login, fetch the full user data from /api/auth/me
      const user = await fetchUserData(true); // Pass true to indicate it's part of initial auth
      if (!user) {
        // If fetchUserData returns null after a successful login, it means /api/auth/me failed.
        // telegramAuthError should have been set by fetchUserData in this case.
        // If not, set a generic one.
        if (!telegramAuthError) { 
            setTelegramAuthError("Failed to retrieve user details after successful login. Please relaunch.");
        }
      }
      // currentUser will be set by fetchUserData
    } catch (error: any) {
      console.error('UserContext: Error during initializeTelegramSession:', error);
      setTelegramAuthError(error.message || 'An unexpected error occurred during session initialization. Please relaunch from Telegram.');
      setCurrentUser(null);
    } finally {
      setLoadingUserInternal(false); // CRITICAL: Ensure loading stops regardless of outcome
    }
  }, [miniApp, fetchUserData, telegramAuthError]);


  React.useEffect(() => {
    if (!isMounted) {
      return; 
    }

    // initDataResult could be undefined (still loading), null (error/not found), or an object.
    if (initDataResult === undefined) {
      // SDK is still trying to load initData, do nothing, loadingUserInternal remains true.
      // console.log("UserContext: initDataResult is undefined, waiting for SDK...");
      return;
    }

    if (initDataResult === null || !initDataResult.initDataRaw) {
      // console.error("UserContext: initDataResult is null or initDataRaw is missing. Result:", initDataResult);
      setTelegramAuthError('Telegram launch parameters (initData) were not found or are invalid. Please ensure the app is launched correctly through the bot.');
      setCurrentUser(null);
      setLoadingUserInternal(false); // Stop loading as we have a definitive failure state.
      return;
    }

    // At this point, initDataResult.initDataRaw is available.
    // console.log("UserContext: initDataRaw found via useInitData. Attempting initialization.");
    const rawData = initDataResult.initDataRaw;
    
    // Small delay can sometimes help with SDK readiness for other calls, though primary initData is present.
    const timerId = setTimeout(() => {
      initializeTelegramSession(rawData);
    }, 200); 

    return () => clearTimeout(timerId);

  }, [isMounted, initDataResult, initializeTelegramSession]);


  const fetchUserData = React.useCallback(async (isInitialAuthCall = false): Promise<AppUser | null> => {
    // Only set loading true for standalone calls, not for the one within initializeTelegramSession
    if (!isInitialAuthCall) {
      setLoadingUserInternal(true);
      setTelegramAuthError(null); // Clear previous errors for a fresh fetch attempt
    }

    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (response.ok && data.success && data.user) {
        setCurrentUser(data.user as AppUser);
        if (!isInitialAuthCall) setTelegramAuthError(null);
        return data.user as AppUser;
      } else {
        // Do not clear telegramAuthError if it was set by a preceding login failure in isInitialAuthCall
        const errorMsg = data.error || `Failed to authenticate user session (/api/auth/me status: ${response.status}). Please relaunch.`;
        if (!isInitialAuthCall || (isInitialAuthCall && !telegramAuthError)) {
            setTelegramAuthError(errorMsg);
        }
        setCurrentUser(null);
      }
    } catch (error: any) {
      console.error("UserContext: Network error in fetchUserData:", error);
      const netErrorMsg = 'Network error while fetching user data. Please check your connection and relaunch.';
       if (!isInitialAuthCall || (isInitialAuthCall && !telegramAuthError)) {
            setTelegramAuthError(netErrorMsg);
       }
      setCurrentUser(null);
    } finally {
      // setLoadingUserInternal is managed by initializeTelegramSession's finally block during initial load.
      // Only set it here for standalone calls.
      if (!isInitialAuthCall) {
        setLoadingUserInternal(false);
      }
    }
    return null;
  }, [telegramAuthError]); // Dependency on telegramAuthError to avoid overwriting specific login errors

  const updateUserSession = React.useCallback((updatedUserData: Partial<AppUser>) => {
    setCurrentUser(prevUser => {
      if (!prevUser) return null;
      const newUser = { ...prevUser, ...updatedUserData };
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
  
  // Ensure loadingUser reflects both mount status and internal loading flag
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
