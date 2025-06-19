
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AppUser } from '@/app/types';
import { retrieveLaunchParams } from '@telegram-apps/sdk'; // Use direct SDK function
import { useMiniApp } from '@telegram-apps/sdk-react'; // Still use for miniApp object

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
  const [loadingUserInternal, setLoadingUserInternal] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const miniApp = useMiniApp(); // Get miniApp object for SDK functionalities

  useEffect(() => {
    setIsMounted(true);
    console.log("UserContext: ComponentDidMount (isMounted set to true)");
  }, []);

  const fetchUserData = useCallback(async (isInitialAuthCall = false): Promise<AppUser | null> => {
    if (!isInitialAuthCall) {
      console.log("UserContext: fetchUserData (standalone) called.");
      setLoadingUserInternal(true); // Set loading true for standalone calls
      setTelegramAuthError(null);   // Clear previous errors
    } else {
      console.log("UserContext: fetchUserData (part of initial auth) called.");
    }

    try {
      console.log("UserContext: Attempting to fetch /api/auth/me");
      const response = await fetch('/api/auth/me');
      console.log(`UserContext: /api/auth/me response status: ${response.status}`);
      const data = await response.json();
      console.log("UserContext: /api/auth/me response data:", data);

      if (response.ok && data.success && data.user) {
        setCurrentUser(data.user as AppUser);
        if (!isInitialAuthCall) {
            setTelegramAuthError(null); // Clear error only if it's a standalone success
        }
        console.log("UserContext: User data fetched and set successfully from /api/auth/me.");
        return data.user as AppUser;
      } else {
        const errorMsg = data.error || `Failed to authenticate user session (/api/auth/me status: ${response.status}). Please relaunch.`;
        console.error("UserContext: Error from /api/auth/me:", errorMsg);
        // Preserve initial login error if this is part of initial auth, otherwise set it.
        if (!isInitialAuthCall || (isInitialAuthCall && !telegramAuthError)) { // Avoid overwriting a more specific login error
            setTelegramAuthError(errorMsg);
        }
        setCurrentUser(null);
      }
    } catch (error: any) {
      console.error("UserContext: Network error in fetchUserData:", error.message, error.stack);
      const netErrorMsg = 'Network error while fetching user data. Please check connection and relaunch.';
      if (!isInitialAuthCall || (isInitialAuthCall && !telegramAuthError)) { // Avoid overwriting a more specific login error
           setTelegramAuthError(netErrorMsg);
      }
      setCurrentUser(null);
    } finally {
      // setLoadingUserInternal is managed by initializeTelegramSession's finally block during initial load.
      // Only set it here for standalone calls.
      if (!isInitialAuthCall) {
        console.log("UserContext: fetchUserData (standalone) finished. Setting loadingUserInternal to false.");
        setLoadingUserInternal(false);
      }
    }
    return null;
  }, [telegramAuthError]); // Add telegramAuthError: if it changes, this callback might behave differently on error setting


  const initializeTelegramSession = useCallback(async (retrievedInitDataRaw: string) => {
    console.log("UserContext: Entered initializeTelegramSession.");
    setTelegramAuthError(null); // Clear previous errors before attempting login
    // setLoadingUserInternal(true); // loadingUserInternal should already be true or is managed by the caller effect

    try {
      if (miniApp) {
        if (typeof miniApp.ready === 'function') {
          console.log("UserContext: Calling miniApp.ready()");
          miniApp.ready();
        }
        if (typeof miniApp.expand === 'function') {
          console.log("UserContext: Calling miniApp.expand()");
          miniApp.expand();
        }
      } else {
        console.warn("UserContext: miniApp object not available when trying to call .ready() or .expand()");
      }

      console.log("UserContext: Attempting to call /api/login with initDataString:", retrievedInitDataRaw ? "Present" : "MISSING/EMPTY");
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: retrievedInitDataRaw }),
      });
      console.log(`UserContext: /api/login response status: ${loginResponse.status}`);
      const loginData = await loginResponse.json();
      console.log("UserContext: /api/login response data:", loginData);

      if (!loginResponse.ok || !loginData.success) {
        const errorDetails = loginData.details ? ` Details: ${JSON.stringify(loginData.details)}` : '';
        const errorMessage = loginData.error || `Login API call failed (status: ${loginResponse.status}). Please relaunch.${errorDetails}`;
        console.error("UserContext: Login API error:", errorMessage);
        throw new Error(errorMessage); // This will be caught by the catch block below
      }

      console.log("UserContext: Login successful via /api/login. Now fetching full user data from /api/auth/me.");
      // After successful login, fetch the full user data.
      // The cookie should be set by the /api/login endpoint.
      const user = await fetchUserData(true); // true indicates this is part of initial auth
      if (!user) {
        console.error("UserContext: fetchUserData returned null after a successful /api/login call. This indicates /api/auth/me failed.");
        // If fetchUserData returned null, it should have set telegramAuthError.
        // If not, set a generic one, though this path should ideally be covered by fetchUserData's error handling.
        if (!telegramAuthError) {
            setTelegramAuthError("Failed to retrieve user details after successful login. Please relaunch.");
        }
      } else {
        console.log("UserContext: User fully authenticated and data fetched:", user.id);
      }
    } catch (error: any) {
      console.error('UserContext: Error during initializeTelegramSession catch block:', error.message, error.stack);
      setTelegramAuthError(error.message || 'An unexpected error occurred during session initialization. Please relaunch.');
      setCurrentUser(null);
    } finally {
      console.log("UserContext: initializeTelegramSession FINALLY block. Setting loadingUserInternal to false.");
      setLoadingUserInternal(false); // CRITICAL: Ensure loading stops
    }
  }, [miniApp, fetchUserData, telegramAuthError]); // fetchUserData and telegramAuthError are dependencies

  useEffect(() => {
    if (!isMounted) {
      console.log("UserContext: Main initialization useEffect - SKIPPING (not mounted yet).");
      return;
    }

    console.log("UserContext: Main initialization useEffect - RUNNING (isMounted is true).");
    // setLoadingUserInternal(true); // This is already true by default, so no need to set it again.

    let rawInitData: string | undefined;
    try {
      console.log("UserContext: Attempting to call retrieveLaunchParams()...");
      const launchParams = retrieveLaunchParams();
      rawInitData = launchParams.initDataRaw;
      console.log("UserContext: retrieveLaunchParams() called. initDataRaw:", rawInitData ? "Found" : "NOT FOUND/EMPTY", "Full launchParams:", launchParams);

      if (!rawInitData) {
        console.error("UserContext: initDataRaw is missing or empty from retrieveLaunchParams(). This is a critical failure point.");
        setTelegramAuthError('Telegram launch parameters (initDataRaw) were not found or are invalid. Please ensure the app is launched correctly through the bot.');
        setCurrentUser(null);
        setLoadingUserInternal(false); // Stop loading if initData is definitively missing
        return; // Exit early
      }
    } catch (sdkError: any) {
      console.error("UserContext: Error during retrieveLaunchParams() call:", sdkError.message, sdkError.stack);
      setTelegramAuthError(`Error retrieving launch parameters from Telegram SDK: ${sdkError.message}. Please relaunch.`);
      setCurrentUser(null);
      setLoadingUserInternal(false); // Stop loading on SDK error
      return; // Exit early
    }

    // If initDataRaw was successfully retrieved
    console.log("UserContext: initDataRaw successfully retrieved. Scheduling session initialization.");
    const timerId = setTimeout(() => {
      console.log("UserContext: setTimeout triggered. Calling initializeTelegramSession.");
      initializeTelegramSession(rawInitData!); // rawInitData is confirmed to be present here
    }, 150); // A small delay, can be adjusted or removed if not needed

    return () => {
      console.log("UserContext: Main initialization useEffect cleanup (clearing timeout).");
      clearTimeout(timerId);
    };
  }, [isMounted, initializeTelegramSession]); // Depends on isMounted and the memoized initializeTelegramSession

  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    console.log("UserContext: updateUserSession called with:", updatedUserData);
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
  if(isMounted && !loadingUserInternal){
      console.log("UserContext: FINAL RENDER STATE - isMounted: true, loadingUserInternal: false. CurrentUser:", currentUser ? currentUser.id : null, "AuthError:", telegramAuthError);
  } else if (isMounted && loadingUserInternal){
      console.log("UserContext: FINAL RENDER STATE - isMounted: true, loadingUserInternal: true (Still loading). CurrentUser:", currentUser ? currentUser.id : null, "AuthError:", telegramAuthError);
  }


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
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

    
