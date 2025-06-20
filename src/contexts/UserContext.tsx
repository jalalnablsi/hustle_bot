
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
  fetchUserData: (isInitialAuthCall?: boolean, fallbackToIdIfMeFails?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserInternal] = useState<AppUser | null>(null);
  const [loadingUserInternal, setLoadingUserInternal] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const miniApp = useMiniApp();

  useEffect(() => {
    setIsMounted(true);
    console.log("UserContext: ComponentDidMount (isMounted set to true)");
  }, []);

  const setCurrentUserAndUpdateStorage = useCallback((user: AppUser | null) => {
    setCurrentUserInternal(user);
    if (user && user.id && user.telegram_id) {
      const minimalUser = {
        id: user.id,
        telegram_id: user.telegram_id,
        first_name: user.first_name,
        username: user.username,
        photo_url: user.photo_url,
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(minimalUser));
        console.log("UserContext: Minimal user data saved to localStorage:", minimalUser);
      } catch (e) {
        console.warn("UserContext: Failed to save minimal user data to localStorage:", e);
      }
    } else if (user === null) {
      try {
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        console.log("UserContext: User set to null, removed minimal user data from localStorage.");
      } catch (e) {
        console.warn("UserContext: Failed to remove minimal user data from localStorage:", e);
      }
    }
  }, []);

  const fetchUserDataById = useCallback(async (userId: string): Promise<AppUser | null> => {
    console.log(`UserContext: fetchUserDataById called for DB ID: ${userId}`);
    try {
      const response = await fetch(`/api/auth/fetch-by-id?userId=${userId}`);
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        console.log("UserContext: User data fetched by ID successfully:", data.user.id);
        return data.user as AppUser;
      } else {
        let errorMsg = `Failed to fetch user by ID ${userId}. `;
        if (data && data.error) {
            errorMsg += typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
        } else if (!response.ok) {
            errorMsg += `Status: ${response.status}`;
        }
        console.warn(`UserContext: ${errorMsg}`);
        return null;
      }
    } catch (error: any) {
      console.error(`UserContext: Network error fetching user by ID ${userId}:`, (error?.message || String(error)));
      return null;
    }
  }, []);

  const fetchUserData = useCallback(async (
    isInitialAuthCall = false, 
    fallbackToIdIfMeFails = true
  ): Promise<AppUser | null> => {
    if (!isInitialAuthCall) {
      console.log("UserContext: fetchUserData (standalone) called.");
      setLoadingUserInternal(true);
      setTelegramAuthError(null);
    } else {
      console.log("UserContext: fetchUserData (part of initial auth sequence) called.");
    }

    try {
      console.log("UserContext: Attempting to fetch /api/auth/me");
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      console.log("UserContext: /api/auth/me response:", { status: response.status, success: data.success, userExists: !!data.user });

      if (response.ok && data.success && data.user) {
        setCurrentUserAndUpdateStorage(data.user as AppUser);
        setTelegramAuthError(null); // Clear any previous auth error
        console.log("UserContext: User data fetched and set successfully from /api/auth/me:", data.user.id);
        return data.user as AppUser;
      } else {
        let meErrorMessage = 'Session check via /api/auth/me failed. ';
        if (data && data.error) {
            meErrorMessage += typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
        } else if (!response.ok) {
            meErrorMessage += `Server responded with status ${response.status}.`;
        } else {
            meErrorMessage += 'No user data returned from session check or success was false.';
        }
        console.warn(`UserContext: ${meErrorMessage}`);

        if (fallbackToIdIfMeFails) {
          console.log("UserContext: /api/auth/me failed. Attempting localStorage fallback via fetchUserDataById.");
          const storedMinimalUserStr = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
          if (storedMinimalUserStr) {
            console.log("UserContext: Found minimal user data in localStorage:", storedMinimalUserStr);
            try {
              const minimalUser = JSON.parse(storedMinimalUserStr);
              if (minimalUser && minimalUser.id) {
                console.log(`UserContext: Attempting to fetch full user data by DB ID ${minimalUser.id} from localStorage fallback.`);
                const userFromId = await fetchUserDataById(minimalUser.id);
                if (userFromId) {
                  setCurrentUserAndUpdateStorage(userFromId);
                  setTelegramAuthError(null); // CRITICAL: Clear error on successful fallback
                  console.log("UserContext: User data successfully fetched and set via localStorage ID fallback:", userFromId.id);
                  return userFromId; // Success through fallback
                } else {
                  console.warn("UserContext: localStorage ID fallback failed (fetchUserDataById returned null). Auth error will remain from /me failure or be set if not already.");
                  setTelegramAuthError(meErrorMessage + " Fallback via stored ID also failed.");
                }
              } else {
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                console.warn("UserContext: Stored minimal user data was invalid (no ID).");
                setTelegramAuthError(meErrorMessage + " Stored user identifier was invalid for fallback.");
              }
            } catch (e: any) {
              localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
              console.error("UserContext: Error parsing user data from localStorage:", (e?.message || String(e)));
              setTelegramAuthError(meErrorMessage + " Error reading stored user data for fallback.");
            }
          } else {
            console.log("UserContext: No minimal user data found in localStorage for fallback.");
            setTelegramAuthError(meErrorMessage); // Keep error from /me if no local storage
          }
        } else {
            console.log("UserContext: Fallback via fetchUserDataById was explicitly disabled.");
            setTelegramAuthError(meErrorMessage); // Keep error from /me
        }
        
        // If primary /api/auth/me failed and fallback was not successful or not attempted
        setCurrentUserAndUpdateStorage(null);
        return null;
      }
    } catch (error: any) {
      let networkErrorMessage = 'Network error during /api/auth/me or fallback. ';
      networkErrorMessage += (error?.message || String(error));
      console.error('UserContext: Network error in fetchUserData catch block:', networkErrorMessage, error);
      setTelegramAuthError(networkErrorMessage);
      setCurrentUserAndUpdateStorage(null);
      return null;
    } finally {
      if (!isInitialAuthCall) {
        console.log("UserContext: fetchUserData (standalone) FINALLY. Setting loadingUserInternal to false.");
        setLoadingUserInternal(false);
      }
    }
  }, [fetchUserDataById, setCurrentUserAndUpdateStorage]);


  const initializeTelegramSession = useCallback(async (retrievedInitDataRaw: string) => {
    console.log("UserContext: Entered initializeTelegramSession with initDataRaw:", retrievedInitDataRaw ? "Present" : "MISSING");
    setTelegramAuthError(null); // Clear previous errors at the start of a new attempt

    try {
      if (miniApp) {
        console.log("UserContext: Calling miniApp.ready() and miniApp.expand()");
        if (typeof miniApp.ready === 'function') miniApp.ready();
        if (typeof miniApp.expand === 'function') miniApp.expand();
      } else {
        console.warn("UserContext: miniApp object not available for .ready() or .expand()");
      }

      console.log("UserContext: Attempting to call /api/login with initDataRaw");
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataString: retrievedInitDataRaw }),
      });
      const loginData = await loginResponse.json();
      console.log("UserContext: /api/login response:", { status: loginResponse.status, success: loginData.success, userExists: !!loginData.user, isNew: loginData.isNewUser });

      if (!loginResponse.ok || !loginData.success) {
        let loginErrorMsg = "Login API call failed. ";
         if (loginData && loginData.error) {
          loginErrorMsg += typeof loginData.error === 'string' ? loginData.error : (loginData.error.message || JSON.stringify(loginData.error));
        } else if (!loginResponse.ok) {
          loginErrorMsg += `Server responded with status ${loginResponse.status}.`;
        }
        loginErrorMsg += " Please relaunch.";
        console.error("UserContext: Login failure -", loginErrorMsg, loginData.details ? `Details: ${JSON.stringify(loginData.details)}` : '');
        throw new Error(loginErrorMsg); // This will be caught by the outer catch
      }
      
      // /api/login was successful and set the cookie. It also returned minimal user data.
      // Save this minimal data to localStorage immediately.
      if (loginData.user) {
        setCurrentUserAndUpdateStorage(loginData.user as AppUser); // Temporarily set, will be overwritten by full fetch
        console.log("UserContext: Minimal user data from /api/login response saved to localStorage:", loginData.user);
      }

      console.log("UserContext: Login successful. Fetching full user data from /api/auth/me (as part of initial auth sequence).");
      const user = await fetchUserData(true, true); // true for isInitialAuthCall, true for fallbackToIdIfMeFails
      
      if (user) {
        console.log("UserContext: User fully authenticated and data fetched via initializeTelegramSession:", user.id);
        setTelegramAuthError(null); // Explicitly clear any error if user is fetched
      } else {
        console.error("UserContext: fetchUserData returned null after a successful /api/login. This is unexpected if login sets cookie correctly and /me or fallback works.");
        // telegramAuthError should have been set by fetchUserData in this case
        if (!telegramAuthError) { // Safety net
            setTelegramAuthError("Failed to retrieve user details after login. Please relaunch.");
        }
      }

    } catch (error: any) {
      let sessionInitErrorMsg = "Error during session initialization. ";
      sessionInitErrorMsg += (error?.message || String(error));
      console.error('UserContext: Error during initializeTelegramSession catch block:', sessionInitErrorMsg, error);
      setTelegramAuthError(sessionInitErrorMsg);
      setCurrentUserAndUpdateStorage(null);
    } 
    // setLoadingUserInternal(false) is handled by the main useEffect's finally block
  }, [miniApp, fetchUserData, telegramAuthError, setCurrentUserAndUpdateStorage]);

  useEffect(() => {
    if (!isMounted) {
      console.log("UserContext: Main initialization useEffect - SKIPPING (not mounted yet).");
      return;
    }
    console.log("UserContext: Main initialization useEffect - RUNNING (isMounted). currentUser:", currentUser?.id);

    if (currentUser) {
      console.log("UserContext: User already present (currentUser.id:", currentUser.id,"), skipping full init. Setting loadingUserInternal to false.");
      setLoadingUserInternal(false);
      return;
    }
    
    // Start loading sequence if not already in one and no user
    console.log("UserContext: Main useEffect - No current user. Setting loadingUserInternal = true and clearing error.");
    setLoadingUserInternal(true);
    setTelegramAuthError(null);

    let initDataRawString: string | undefined = undefined;
    try {
      console.log("UserContext: Attempting retrieveLaunchParams().");
      const launchParams = retrieveLaunchParams();
      initDataRawString = launchParams.initDataRaw;
      console.log("UserContext: retrieveLaunchParams() result - initDataRaw:", initDataRawString ? "PRESENT" : "MISSING/UNDEFINED", "Full launchParams:", launchParams);
    } catch (e: any) {
      const errorMsg = `Error calling retrieveLaunchParams(): ${e?.message || String(e)}. Ensure app is launched from Telegram.`;
      console.error("UserContext:", errorMsg);
      setTelegramAuthError(errorMsg);
      setCurrentUserAndUpdateStorage(null);
      setLoadingUserInternal(false); // Critical: stop loading if this fails
      return;
    }

    if (!initDataRawString) {
      const errorMsg = 'Telegram launch parameters (initDataRaw) were not found using retrieveLaunchParams(). Please ensure the app is launched correctly through the bot.';
      console.warn(`UserContext: ${errorMsg}`);
      
      // Attempt localStorage fallback IF initDataRaw is missing (e.g. web direct load for testing after login)
      console.log("UserContext: initDataRaw is MISSING. Attempting direct localStorage fallback via fetchUserData(true, true).");
      fetchUserData(true, true) 
        .then(user => {
          if (user) {
            console.log("UserContext: Direct localStorage fallback successful (initDataRaw missing path).", user.id);
            setTelegramAuthError(null); // Clear error on success
          } else {
            console.warn("UserContext: Direct localStorage fallback FAILED (initDataRaw missing path). Setting specific auth error.");
            if(!telegramAuthError) setTelegramAuthError(errorMsg); // Set error only if not already set by fetchUserData
          }
        })
        .catch(fetchError => {
          console.error("UserContext: Unexpected error during direct localStorage fallback (initDataRaw missing path):", fetchError);
          setTelegramAuthError(prevError => prevError || "Unexpected error during fallback authentication.");
          setCurrentUserAndUpdateStorage(null);
        })
        .finally(() => {
          console.log("UserContext: initDataRaw missing path in useEffect FINALLY. Setting loadingUserInternal to false.");
          setLoadingUserInternal(false);
        });
      return;
    }

    // If initDataRaw IS present:
    console.log("UserContext: initDataRaw is PRESENT. Proceeding with initializeTelegramSession after a short delay.");
    const timerId = setTimeout(() => {
        console.log("UserContext: Timeout triggered. Calling initializeTelegramSession with retrieved initDataRawString.");
        if (initDataRawString) { // Double check
            initializeTelegramSession(initDataRawString).finally(() => {
                console.log("UserContext: initializeTelegramSession (from initDataRaw path) FINALLY. Setting loadingUserInternal to false.");
                setLoadingUserInternal(false);
            });
        } else {
            // Should not happen if previous checks are correct
            console.error("UserContext: initDataRawString became undefined before timeout callback. This is a bug.");
            setTelegramAuthError("Internal error: Launch parameters lost before processing.");
            setLoadingUserInternal(false);
        }
    }, 250); // Slightly increased delay

    return () => {
      console.log("UserContext: Main initialization useEffect cleanup (clearing timeout).");
      clearTimeout(timerId);
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]); // Run only once after mount. Dependencies like currentUser removed to prevent re-runs.

  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    console.log("UserContext: updateUserSession called with:", updatedUserData);
    setCurrentUserInternal(prevUser => {
      if (!prevUser) {
        console.warn("UserContext: updateUserSession called but prevUser is null. Cannot update.");
        return null;
      }
      const newUser = { ...prevUser, ...updatedUserData };
      const numericKeys: (keyof AppUser)[] = [
        'gold_points', 'diamond_points', 'purple_gem_points', 'blue_gem_points', 
        'referrals_made', 'referral_gold_earned', 'referral_diamond_earned', 
        'ad_spins_used_today_count', 'ad_views_today_count', 'bonus_spins_available', 
        'daily_reward_streak', 'daily_ad_views_limit', 'stake_builder_high_score'
      ];
      (Object.keys(updatedUserData) as Array<keyof AppUser>).forEach(key => {
        if (numericKeys.includes(key)) {
          (newUser as any)[key] = Number(updatedUserData[key] ?? prevUser[key] ?? 0);
        } else if (key === 'initial_free_spin_used') {
          (newUser as any)[key] = Boolean(updatedUserData[key]);
        }
      });
      if (newUser.id && newUser.telegram_id) {
         const minimalUserForStorage = {
            id: newUser.id,
            telegram_id: newUser.telegram_id,
            first_name: newUser.first_name,
            username: newUser.username,
            photo_url: newUser.photo_url,
         };
         try {
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(minimalUserForStorage));
         } catch (e) { console.warn("UserContext: Failed to save to localStorage in updateUserSession", e); }
      }
      console.log("UserContext: User session updated via updateUserSession. New state for user ID:", newUser.id);
      return newUser;
    });
  }, []);

  const finalLoadingState = !isMounted || loadingUserInternal;

  const providerValue = React.useMemo(() => ({
    currentUser,
    setCurrentUser: setCurrentUserAndUpdateStorage,
    updateUserSession,
    loadingUser: finalLoadingState,
    fetchUserData,
    telegramAuthError
  }), [currentUser, setCurrentUserAndUpdateStorage, updateUserSession, finalLoadingState, fetchUserData, telegramAuthError]);

  console.log("UserContext: Rendering Provider. loadingUser (final):", finalLoadingState, "currentUser ID:", currentUser?.id, "telegramAuthError:", telegramAuthError);

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
