
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AppUser } from '@/app/types';
import { retrieveLaunchParams } from '@telegram-apps/sdk';
import { useMiniApp, useInitData } from '@telegram-apps/sdk-react';

const LOCAL_STORAGE_USER_KEY = 'hustleSoulUserMinimal';

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  updateUserSession: (updatedUserData: Partial<AppUser>) => void;
  loadingUser: boolean;
  fetchUserData: (isInitialAuthCall?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loadingUserInternal, setLoadingUserInternal] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const miniApp = useMiniApp();
  const initDataResult = useInitData();

  useEffect(() => {
    setIsMounted(true);
    console.log("UserContext: ComponentDidMount (isMounted set to true)");
  }, []);

  const fetchUserDataById = useCallback(async (userId: string): Promise<AppUser | null> => {
    console.log(`UserContext: fetchUserDataById called for ID: ${userId}`);
    setLoadingUserInternal(true); // Ensure loading is true during this direct fetch
    try {
      const response = await fetch(`/api/auth/fetch-by-id?userId=${userId}`);
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        console.log("UserContext: User data fetched by ID successfully:", data.user.id);
        return data.user as AppUser;
      } else {
        let errorMsg = `Failed to fetch user by ID ${userId}.`;
        if (data && data.error) {
            errorMsg += typeof data.error === 'string' ? data.error : (data.error.message || "Unknown server error.");
        } else if (!response.ok) {
            errorMsg += ` Status: ${response.status}`;
        }
        console.warn(`UserContext: ${errorMsg}`);
        // Do not set telegramAuthError here, let the caller decide.
        return null;
      }
    } catch (error: any) {
      console.error(`UserContext: Network error fetching user by ID ${userId}:`, (error.message || String(error)));
      // Do not set telegramAuthError here.
      return null;
    } finally {
      // setLoadingUserInternal(false); // Loading state should be managed by the calling function for this helper
    }
  }, []);

  const fetchUserData = useCallback(async (isInitialAuthCall = false): Promise<AppUser | null> => {
    if (!isInitialAuthCall) {
      console.log("UserContext: fetchUserData (standalone) called.");
      setLoadingUserInternal(true);
      setTelegramAuthError(null);
    } else {
      console.log("UserContext: fetchUserData (part of initial auth) called.");
    }

    try {
      console.log("UserContext: Attempting to fetch /api/auth/me");
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      console.log("UserContext: /api/auth/me response:", { status: response.status, data });

      if (response.ok && data.success && data.user) {
        setCurrentUser(data.user as AppUser);
        setTelegramAuthError(null);
        console.log("UserContext: User data fetched and set successfully from /api/auth/me.");
        return data.user as AppUser;
      } else {
        let meErrorMessage = 'Session check via /api/auth/me failed. ';
        if (data && data.error) {
            if (typeof data.error === 'string') meErrorMessage += data.error;
            else if (typeof data.error === 'object' && data.error.message) meErrorMessage += data.error.message;
            else meErrorMessage += 'Unknown error from /api/auth/me.';
        } else if (!response.ok) {
            meErrorMessage += `Server responded with status ${response.status}.`;
        } else {
            meErrorMessage += 'No user data returned from session check.';
        }
        console.warn(`UserContext: ${meErrorMessage}`);

        if (isInitialAuthCall) {
          console.log("UserContext: /api/auth/me failed during initial auth. Attempting localStorage fallback.");
          const storedMinimalUserStr = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
          if (storedMinimalUserStr) {
            console.log("UserContext: Found minimal user data in localStorage.");
            try {
              const minimalUser = JSON.parse(storedMinimalUserStr);
              if (minimalUser && minimalUser.id) {
                console.log(`UserContext: Attempting to fetch full user data by ID ${minimalUser.id} from localStorage fallback.`);
                const userFromId = await fetchUserDataById(minimalUser.id);
                if (userFromId) {
                  setCurrentUser(userFromId);
                  setTelegramAuthError(null);
                  console.log("UserContext: User data successfully fetched via localStorage ID fallback.");
                  return userFromId;
                } else {
                  console.warn("UserContext: localStorage ID fallback failed to fetch full user data.");
                   setTelegramAuthError("Could not re-authenticate using stored ID. Please try a full relaunch from Telegram.");
                }
              } else {
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Invalid stored data
                setTelegramAuthError("Stored user identifier was invalid. Please relaunch.");
              }
            } catch (e: any) {
              console.error("UserContext: Error parsing user data from localStorage:", (e.message || String(e)));
              localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
              setTelegramAuthError("Error reading stored user data. Please relaunch.");
            }
          } else {
            console.log("UserContext: No minimal user data found in localStorage for fallback.");
            setTelegramAuthError(meErrorMessage); // Use the error from /api/auth/me if no localStorage
          }
        } else { // Not an initial auth call, so just report the /api/auth/me failure
            setTelegramAuthError(meErrorMessage);
        }
        setCurrentUser(null);
        return null;
      }
    } catch (error: any) {
      let networkErrorMessage = 'Network error while fetching user data. ';
      if (error && error.message) {
        networkErrorMessage += error.message;
      } else {
        networkErrorMessage += 'Please check connection and relaunch.';
      }
      console.error('UserContext: Network error in fetchUserData:', networkErrorMessage, error);
      setTelegramAuthError(networkErrorMessage);
      setCurrentUser(null);
      return null;
    } finally {
      if (!isInitialAuthCall) {
        console.log("UserContext: fetchUserData (standalone) FINALLY. Setting loading to false.");
        setLoadingUserInternal(false);
      }
    }
  }, [fetchUserDataById]);


  const initializeTelegramSession = useCallback(async (retrievedInitDataRaw: string) => {
    console.log("UserContext: Entered initializeTelegramSession with initDataRaw:", retrievedInitDataRaw ? "Present" : "MISSING");
    setTelegramAuthError(null);
    // setLoadingUserInternal is true by default or set by caller

    try {
      if (miniApp && typeof miniApp.ready === 'function') {
        console.log("UserContext: Calling miniApp.ready()");
        miniApp.ready();
      }
      if (miniApp && typeof miniApp.expand === 'function') {
        console.log("UserContext: Calling miniApp.expand()");
        miniApp.expand();
      }

      console.log("UserContext: Attempting to call /api/login with initDataRaw");
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: retrievedInitDataRaw }),
      });
      const loginData = await loginResponse.json();
      console.log("UserContext: /api/login response:", { status: loginResponse.status, data: loginData });

      if (!loginResponse.ok || !loginData.success) {
        let loginErrorMsg = "Login API call failed. ";
        if (loginData && loginData.error) {
            if (typeof loginData.error === 'string') loginErrorMsg += loginData.error;
            else if (typeof loginData.error === 'object' && loginData.error.message) loginErrorMsg += loginData.error.message;
            else loginErrorMsg += 'Unknown error during login.';
        } else if (!loginResponse.ok) {
            loginErrorMsg += `Server responded with status ${loginResponse.status}.`;
        }
        loginErrorMsg += " Please relaunch.";
        console.error("UserContext: Login failure -", loginErrorMsg, loginData.details ? `Details: ${JSON.stringify(loginData.details)}` : '');
        throw new Error(loginErrorMsg);
      }

      if (loginData.user && loginData.user.id) { // Ensure user and id exist
        console.log("UserContext: /api/login successful. Storing minimal user data to localStorage:", loginData.user);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(loginData.user));
      } else {
        console.warn("UserContext: /api/login successful but no user data in response or user.id missing. Cannot store to localStorage.");
      }

      console.log("UserContext: Login successful. Fetching full user data from /api/auth/me (as part of initial auth).");
      const user = await fetchUserData(true); // true indicates this is part of initial auth
      if (!user) {
        console.error("UserContext: fetchUserData returned null after a successful /api/login. /api/auth/me or fallback likely failed.");
        // telegramAuthError should be set by fetchUserData in this case
        if (!telegramAuthError) { // Safety net if fetchUserData didn't set one
            setTelegramAuthError("Failed to retrieve user details after login. Please relaunch.");
        }
      } else {
        console.log("UserContext: User fully authenticated and data fetched via initializeTelegramSession:", user.id);
      }
    } catch (error: any) {
      let sessionInitErrorMsg = "Error during session initialization. ";
      if (error && error.message) {
        sessionInitErrorMsg += error.message;
      } else {
        sessionInitErrorMsg += 'An unexpected error occurred. Please relaunch.';
      }
      console.error('UserContext: Error during initializeTelegramSession catch block:', sessionInitErrorMsg, error);
      setTelegramAuthError(sessionInitErrorMsg);
      setCurrentUser(null);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    } finally {
      console.log("UserContext: initializeTelegramSession FINALLY block. Setting loadingUserInternal to false.");
      setLoadingUserInternal(false);
    }
  }, [miniApp, fetchUserData, telegramAuthError]); // Added telegramAuthError

  useEffect(() => {
    if (!isMounted) {
      console.log("UserContext: Main initialization useEffect - SKIPPING (not mounted yet).");
      return;
    }
    console.log("UserContext: Main initialization useEffect - RUNNING (isMounted). currentUser:", currentUser?.id, "loadingUserInternal:", loadingUserInternal, "initDataResult:", initDataResult);

    if (currentUser) {
      console.log("UserContext: User already present, skipping initData retrieval and login attempt.");
      setLoadingUserInternal(false);
      return;
    }
    
    // Only proceed if not already loading from a previous attempt in this effect run
    if (!loadingUserInternal && !currentUser) {
        setLoadingUserInternal(true); // Set loading true for this new attempt
        setTelegramAuthError(null); // Clear previous errors for this new attempt
    }


    if (initDataResult === undefined) {
      console.log("UserContext: initDataResult is UNDEFINED. Waiting for SDK... (loadingUserInternal remains true)");
      // setLoadingUserInternal(true) should already be active or set above
      return; // SDK still loading initData
    }

    if (initDataResult === null || !initDataResult.initDataRaw) {
      const errorMsg = 'Telegram launch parameters (initData) were not found or are invalid. Please ensure the app is launched correctly through the bot.';
      console.warn(`UserContext: initDataResult is NULL or initDataRaw is missing. Error: "${errorMsg}"`);
      
      // Attempt localStorage + fetchById fallback ONLY IF initData is truly unavailable
      // and we haven't already successfully loaded a user.
      console.log("UserContext: initData unavailable. Attempting localStorage + fetchById fallback.");
      const storedMinimalUserStr = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (storedMinimalUserStr) {
        try {
          const minimalUser = JSON.parse(storedMinimalUserStr);
          if (minimalUser && minimalUser.id) {
            fetchUserDataById(minimalUser.id).then(userFromId => {
              if (userFromId) {
                setCurrentUser(userFromId);
                setTelegramAuthError(null);
                console.log("UserContext: Successfully re-authenticated user from localStorage ID on app load (initData missing path).");
              } else {
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                setTelegramAuthError("Failed to re-verify stored session. Please relaunch from Telegram.");
              }
            }).catch(e => {
              localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
              setTelegramAuthError(`Error during stored session re-verification: ${e.message || String(e)}. Please relaunch.`);
            }).finally(() => {
              setLoadingUserInternal(false);
            });
            return; // Exit after initiating fetch-by-id
          } else {
             localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Invalid format
          }
        } catch(e) {
           localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Parse error
           console.error("UserContext: Error parsing localStorage for initData fallback:", e);
        }
      }
      // If localStorage fallback also fails or not applicable:
      setTelegramAuthError(errorMsg);
      setCurrentUser(null);
      setLoadingUserInternal(false);
      return;
    }

    // If initDataRaw IS present:
    const { initDataRaw } = initDataResult;
    console.log("UserContext: initDataRaw is PRESENT. Proceeding with initializeTelegramSession.");
    
    // Small delay before initializing, can sometimes help with SDK readiness.
    const timerId = setTimeout(() => {
        console.log("UserContext: Timeout triggered. Calling initializeTelegramSession with retrieved initDataRaw.");
        initializeTelegramSession(initDataRaw);
    }, 150); 

    return () => {
      console.log("UserContext: Main initialization useEffect cleanup (clearing timeout).");
      clearTimeout(timerId);
    };

  }, [isMounted, initDataResult, currentUser, initializeTelegramSession, fetchUserDataById]); // Added fetchUserDataById


  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    console.log("UserContext: updateUserSession called with:", updatedUserData);
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
      console.log("UserContext: User session updated. New state:", newUser);
      return newUser;
    });
  }, []);

  const finalLoadingState = !isMounted || loadingUserInternal;

  const providerValue = React.useMemo(() => ({
    currentUser,
    setCurrentUser, // Exposing this directly for potential advanced use or reset, though updateUserSession is preferred
    updateUserSession,
    loadingUser: finalLoadingState,
    fetchUserData,
    telegramAuthError
  }), [currentUser, updateUserSession, finalLoadingState, fetchUserData, telegramAuthError]);

  console.log("UserContext: Rendering Provider. loadingUser (final):", finalLoadingState, "currentUser:", currentUser?.id, "telegramAuthError:", telegramAuthError);

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
