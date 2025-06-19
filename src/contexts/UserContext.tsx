
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AppUser } from '@/app/types';
import { retrieveLaunchParams } from '@telegram-apps/sdk';
import { useMiniApp } from '@telegram-apps/sdk-react';

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

  useEffect(() => {
    setIsMounted(true);
    console.log("UserContext: ComponentDidMount (isMounted set to true)");
  }, []);

  const fetchUserDataById = useCallback(async (userId: string): Promise<AppUser | null> => {
    console.log(`UserContext: fetchUserDataById called for ID: ${userId}`);
    try {
      const response = await fetch(`/api/auth/fetch-by-id?userId=${userId}`);
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        console.log("UserContext: User data fetched by ID successfully:", data.user.id);
        return data.user as AppUser;
      } else {
        console.warn(`UserContext: Failed to fetch user by ID ${userId}. Error: ${data.error}`);
        return null;
      }
    } catch (error: any) {
      console.error(`UserContext: Network error fetching user by ID ${userId}:`, error.message);
      return null;
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
        console.warn(`UserContext: /api/auth/me failed. Status: ${response.status}, Error: ${data.error}. Attempting localStorage fallback if initial auth.`);
        if (isInitialAuthCall) {
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
                  setTelegramAuthError(null); // Clear error if fallback succeeds
                  console.log("UserContext: User data successfully fetched via localStorage ID fallback.");
                  return userFromId;
                } else {
                  console.warn("UserContext: localStorage ID fallback failed to fetch full user data.");
                }
              }
            } catch (e) {
              console.error("UserContext: Error parsing user data from localStorage:", e);
              localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Clear corrupted data
            }
          } else {
            console.log("UserContext: No minimal user data found in localStorage for fallback.");
          }
        }
        // If we reach here, /api/auth/me failed and localStorage fallback also failed or wasn't applicable
        const errorMsg = data.error || `Failed to authenticate user session. Please relaunch.`;
        if (!telegramAuthError && (!isInitialAuthCall || response.status !== 401)) { // Don't overwrite a more specific login error
            setTelegramAuthError(errorMsg);
        }
        setCurrentUser(null);
        return null;
      }
    } catch (error: any) {
      console.error("UserContext: Network error in fetchUserData:", error.message, error.stack);
      const netErrorMsg = 'Network error while fetching user data. Please check connection and relaunch.';
      if (!telegramAuthError) {
         setTelegramAuthError(netErrorMsg);
      }
      setCurrentUser(null);
      return null;
    } finally {
      if (!isInitialAuthCall) {
        setLoadingUserInternal(false);
      }
    }
  }, [fetchUserDataById, telegramAuthError]);


  const initializeTelegramSession = useCallback(async (retrievedInitDataRaw: string) => {
    console.log("UserContext: Entered initializeTelegramSession with initDataRaw:", retrievedInitDataRaw ? "Present" : "MISSING");
    setTelegramAuthError(null);
    // setLoadingUserInternal should already be true from the useEffect that calls this.

    try {
      if (miniApp && typeof miniApp.ready === 'function') {
        console.log("UserContext: Calling miniApp.ready()");
        miniApp.ready();
      }
      if (miniApp && typeof miniApp.expand === 'function') {
        console.log("UserContext: Calling miniApp.expand()");
        miniApp.expand();
      }

      console.log("UserContext: Attempting to call /api/login");
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: retrievedInitDataRaw }),
      });
      const loginData = await loginResponse.json();
      console.log("UserContext: /api/login response:", { status: loginResponse.status, data: loginData });

      if (!loginResponse.ok || !loginData.success) {
        const errorDetails = loginData.details ? ` Details: ${JSON.stringify(loginData.details)}` : '';
        const errorMessage = loginData.error || `Login API call failed. Please relaunch.${errorDetails}`;
        throw new Error(errorMessage);
      }

      if (loginData.user) {
        console.log("UserContext: /api/login successful. Storing minimal user data to localStorage:", loginData.user);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(loginData.user));
      }

      console.log("UserContext: Login successful. Fetching full user data from /api/auth/me (as part of initial auth).");
      const user = await fetchUserData(true); // true indicates this is part of initial auth
      if (!user) {
        console.error("UserContext: fetchUserData returned null after a successful /api/login. /api/auth/me or fallback likely failed.");
        if (!telegramAuthError) { // fetchUserData should set its own error
            setTelegramAuthError("Failed to retrieve user details after login. Please relaunch.");
        }
      } else {
        console.log("UserContext: User fully authenticated and data fetched via initializeTelegramSession:", user.id);
      }
    } catch (error: any) {
      console.error('UserContext: Error during initializeTelegramSession catch block:', error.message, error.stack);
      setTelegramAuthError(error.message || 'An unexpected error occurred during session initialization. Please relaunch.');
      setCurrentUser(null);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Clear local storage on login error
    } finally {
      console.log("UserContext: initializeTelegramSession FINALLY block. Setting loadingUserInternal to false.");
      setLoadingUserInternal(false);
    }
  }, [miniApp, fetchUserData, telegramAuthError]);

  useEffect(() => {
    if (!isMounted) {
      console.log("UserContext: Main initialization useEffect - SKIPPING (not mounted yet).");
      return;
    }
    console.log("UserContext: Main initialization useEffect - RUNNING (isMounted). CurrentUser:", currentUser?.id, "Loading:", loadingUserInternal);

    if (currentUser) { // If user is already loaded (e.g. from a previous session still valid with cookie)
        console.log("UserContext: User already present, skipping initData retrieval and login attempt.");
        setLoadingUserInternal(false);
        return;
    }
    
    // Try to get user from localStorage first on subsequent loads if no cookie session
    const storedMinimalUserStr = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (storedMinimalUserStr && !currentUser) { // Added !currentUser to avoid re-fetching if cookie worked
        console.log("UserContext: Found minimal user in localStorage, attempting to fetch full data by ID as initial step.");
        try {
            const minimalUser = JSON.parse(storedMinimalUserStr);
            if (minimalUser && minimalUser.id) {
                fetchUserDataById(minimalUser.id).then(userFromId => {
                    if (userFromId) {
                        setCurrentUser(userFromId);
                        setTelegramAuthError(null);
                        console.log("UserContext: Successfully re-authenticated user from localStorage ID on app load.");
                    } else {
                        console.warn("UserContext: Failed to re-authenticate from localStorage ID, proceeding to full initData flow.");
                        localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Stale/invalid data
                        // Proceed to initData flow below
                    }
                    // setLoadingUserInternal(false); // This path should also set loading to false.
                }).catch(e => {
                     console.error("UserContext: Error fetching by ID from localStorage:", e);
                     localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                }).finally(() => {
                    // If fetch by ID failed, we might still want to try full initData flow, so don't set loading false here
                    // Let the main initData flow handle the final loading state.
                    // However, if it succeeded, we should stop loading.
                    // This logic is tricky. The main effect below also runs.
                });
            }
        } catch (e) {
            console.error("UserContext: Error parsing localStorage data for initial check:", e);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        }
    }


    console.log("UserContext: Attempting to call retrieveLaunchParams().");
    let launchParams;
    try {
      launchParams = retrieveLaunchParams();
    } catch (sdkError: any) {
      console.error("UserContext: Error during retrieveLaunchParams() call:", sdkError.message, sdkError.stack);
      setTelegramAuthError(`Error retrieving launch params from SDK: ${sdkError.message}. Relaunch.`);
      setCurrentUser(null);
      setLoadingUserInternal(false);
      return;
    }

    const initDataRaw = launchParams.initDataRaw;
    console.log("UserContext: retrieveLaunchParams() result. initDataRaw:", initDataRaw ? "Found" : "NOT FOUND/EMPTY");

    if (!initDataRaw) {
      console.warn("UserContext: initDataRaw is missing or empty. This may be normal if not in Telegram or if SDK hasn't initialized it yet. Error will be set if it remains unavailable.");
      // Check if we already have a user from localStorage ID check earlier
      if (!currentUser) {
           // Try to fetch user via cookie one last time if initData is missing.
           // This covers scenarios where app is opened and cookie is valid but initData isn't (e.g. direct link after login)
            fetchUserData(true).then(userFromCookie => {
                if (!userFromCookie && !currentUser) { // Still no user
                    setTelegramAuthError('Telegram launch parameters (initData) were not found. Please launch correctly through the bot.');
                }
            }).finally(() => {
                setLoadingUserInternal(false);
            });
      } else {
        setLoadingUserInternal(false); // User found from localStorage, and initData missing (which is fine)
      }
      return;
    }

    // If initDataRaw IS present, proceed with session initialization
    // Small delay to allow SDK to fully initialize if needed
    const timerId = setTimeout(() => {
        console.log("UserContext: Timeout triggered. Calling initializeTelegramSession with retrieved initDataRaw.");
        initializeTelegramSession(initDataRaw);
    }, 150); 

    return () => {
      console.log("UserContext: Main initialization useEffect cleanup (clearing timeout).");
      clearTimeout(timerId);
    };
  }, [isMounted, initializeTelegramSession, fetchUserDataById, currentUser]); // Added fetchUserDataById, currentUser

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
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
