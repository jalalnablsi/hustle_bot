
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AppUser } from '@/app/types';
import { retrieveLaunchParams } from '@telegram-apps/sdk'; // Use direct import
import { useMiniApp } from '@telegram-apps/sdk-react';

const LOCAL_STORAGE_USER_KEY = 'hustleSoulUserMinimal'; // For storing {id, telegram_id, first_name, username, photo_url}

interface UserContextType {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void; // Expose for direct manipulation if ever needed
  updateUserSession: (updatedUserData: Partial<AppUser>) => void;
  loadingUser: boolean;
  fetchUserData: (isInitialAuthCall?: boolean, fallbackToId?: boolean) => Promise<AppUser | null>;
  telegramAuthError: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserInternal] = useState<AppUser | null>(null);
  const [loadingUserInternal, setLoadingUserInternal] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const miniApp = useMiniApp(); // Still useful for miniApp.ready() etc.

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
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(minimalUser));
      console.log("UserContext: Minimal user data saved to localStorage on setCurrentUser:", minimalUser);
    } else if (user === null) {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      console.log("UserContext: User set to null, removed minimal user data from localStorage.");
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
            errorMsg += typeof data.error === 'string' ? data.error : (data.error.message || "Unknown server error.");
        } else if (!response.ok) {
            errorMsg += ` Status: ${response.status}`;
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
    fallbackToIdIfMeFails = true // New parameter to control fallback explicitly
  ): Promise<AppUser | null> => {
    if (!isInitialAuthCall) {
      console.log("UserContext: fetchUserData (standalone) called.");
      setLoadingUserInternal(true); // Only set loading if it's a standalone call
      setTelegramAuthError(null);
    } else {
      console.log("UserContext: fetchUserData (part of initial auth sequence) called.");
    }

    try {
      console.log("UserContext: Attempting to fetch /api/auth/me");
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      console.log("UserContext: /api/auth/me response:", { status: response.status, dataExists: !!data.user });

      if (response.ok && data.success && data.user) {
        setCurrentUserAndUpdateStorage(data.user as AppUser);
        setTelegramAuthError(null);
        console.log("UserContext: User data fetched and set successfully from /api/auth/me:", data.user.id);
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

        let effectiveErrorMessage = meErrorMessage;

        if (fallbackToIdIfMeFails) {
          console.log("UserContext: /api/auth/me failed or no user. Attempting localStorage fallback via fetchUserDataById.");
          const storedMinimalUserStr = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
          if (storedMinimalUserStr) {
            console.log("UserContext: Found minimal user data in localStorage:", storedMinimalUserStr);
            try {
              const minimalUser = JSON.parse(storedMinimalUserStr);
              if (minimalUser && minimalUser.id) {
                console.log(`UserContext: Attempting to fetch full user data by DB ID ${minimalUser.id} from localStorage fallback.`);
                const userFromId = await fetchUserDataById(minimalUser.id);
                if (userFromId) {
                  setCurrentUserAndUpdateStorage(userFromId); // <<<< CRITICAL: Update user
                  setTelegramAuthError(null);              // <<<< CRITICAL: Clear previous error
                  console.log("UserContext: User data successfully fetched and set via localStorage ID fallback:", userFromId.id);
                  return userFromId;                       // <<<< CRITICAL: Return successfully
                } else {
                  console.warn("UserContext: localStorage ID fallback failed to fetch full user data (fetchUserDataById returned null).");
                  effectiveErrorMessage = meErrorMessage + " Fallback via stored ID also failed to retrieve user data.";
                }
              } else {
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                console.warn("UserContext: Stored minimal user data was invalid (no ID).");
                effectiveErrorMessage = meErrorMessage + " Stored user identifier was invalid for fallback.";
              }
            } catch (e: any) {
              localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
              console.error("UserContext: Error parsing user data from localStorage:", (e?.message || String(e)));
              effectiveErrorMessage = meErrorMessage + " Error reading stored user data for fallback.";
            }
          } else {
            console.log("UserContext: No minimal user data found in localStorage for fallback.");
            // effectiveErrorMessage is already meErrorMessage
          }
        } else {
            console.log("UserContext: Fallback via fetchUserDataById was explicitly disabled for this call to fetchUserData.");
        }
        
        // If we reach here, it means primary /api/auth/me failed and either fallback was not attempted,
        // not applicable, or also failed.
        setTelegramAuthError(effectiveErrorMessage);
        setCurrentUserAndUpdateStorage(null);
        return null;
      }
    } catch (error: any) {
      let networkErrorMessage = 'Network error while fetching user data. ';
      if (error && error.message) networkErrorMessage += error.message;
      else networkErrorMessage += 'Please check connection.';
      console.error('UserContext: Network error in fetchUserData catch block:', networkErrorMessage, error);
      setTelegramAuthError(networkErrorMessage);
      setCurrentUserAndUpdateStorage(null);
      return null;
    } finally {
      if (!isInitialAuthCall) { // Only set loading false if it's a standalone call
        console.log("UserContext: fetchUserData (standalone) FINALLY. Setting loadingUserInternal to false.");
        setLoadingUserInternal(false);
      }
    }
  }, [fetchUserDataById, setCurrentUserAndUpdateStorage]);


  const initializeTelegramSession = useCallback(async (retrievedInitDataRaw: string) => {
    console.log("UserContext: Entered initializeTelegramSession with initDataRaw:", retrievedInitDataRaw ? "Present" : "MISSING");
    setTelegramAuthError(null);
    // setLoadingUserInternal is managed by the main useEffect's finally block for this path

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
      console.log("UserContext: /api/login response:", { status: loginResponse.status, dataExists: !!loginData.user, isNew: loginData.isNewUser });

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
      
      // After successful login, /api/login has set the cookie.
      // Now fetch the full user data using that cookie.
      console.log("UserContext: Login successful. Fetching full user data from /api/auth/me (as part of initial auth sequence).");
      const user = await fetchUserData(true, true); // Pass true for isInitialAuthCall and true for fallbackToIdIfMeFails
      
      if (!user) {
        console.error("UserContext: fetchUserData returned null after a successful /api/login. This is unexpected if login sets cookie correctly.");
        // telegramAuthError should be set by fetchUserData in this case
        if (!telegramAuthError) { // Safety net
            setTelegramAuthError("Failed to retrieve user details after login. Please relaunch.");
        }
      } else {
        console.log("UserContext: User fully authenticated and data fetched via initializeTelegramSession:", user.id);
      }

    } catch (error: any) {
      let sessionInitErrorMsg = "Error during session initialization. ";
      if (error && error.message) sessionInitErrorMsg += error.message;
      else sessionInitErrorMsg += 'An unexpected error occurred. Please relaunch.';
      console.error('UserContext: Error during initializeTelegramSession catch block:', sessionInitErrorMsg, error);
      setTelegramAuthError(sessionInitErrorMsg);
      setCurrentUserAndUpdateStorage(null);
    } 
    // setLoadingUserInternal(false) will be handled by the calling useEffect's finally block
  }, [miniApp, fetchUserData, telegramAuthError, setCurrentUserAndUpdateStorage]);

  useEffect(() => {
    if (!isMounted) {
      console.log("UserContext: Main initialization useEffect - SKIPPING (not mounted yet).");
      return;
    }
    console.log("UserContext: Main initialization useEffect - RUNNING (isMounted). currentUser:", currentUser?.id, "loadingUserInternal:", loadingUserInternal);

    if (currentUser) {
      console.log("UserContext: User already present (currentUser.id:", currentUser.id,"), skipping full init. Setting loadingUserInternal to false.");
      setLoadingUserInternal(false);
      return;
    }
    
    if (!loadingUserInternal) { // Only restart loading if not already in a loading sequence from this effect
        console.log("UserContext: Main useEffect - not loading and no user, setting loadingUserInternal = true and clearing error.");
        setLoadingUserInternal(true);
        setTelegramAuthError(null);
    }

    let initDataRaw: string | undefined = undefined;
    try {
      const launchParams = retrieveLaunchParams();
      initDataRaw = launchParams.initDataRaw;
      console.log("UserContext: retrieveLaunchParams() result:", launchParams.initDataRaw ? "initDataRaw PRESENT" : "initDataRaw MISSING", launchParams);
    } catch (e: any) {
      const errorMsg = `Error retrieving launch parameters via retrieveLaunchParams(): ${e?.message || String(e)}. Ensure app is launched from Telegram.`;
      console.error("UserContext:", errorMsg);
      // If retrieveLaunchParams itself throws, we might not even have initDataRaw to try.
      // Attempt localStorage fallback directly.
      console.log("UserContext: retrieveLaunchParams threw error. Attempting direct localStorage fallback via fetchUserData(true).");
      fetchUserData(true, true) // true for initial, true for fallback
        .then(user => {
          if (user) {
            console.log("UserContext: Direct localStorage fallback successful after retrieveLaunchParams error.", user.id);
          } else {
            console.warn("UserContext: Direct localStorage fallback FAILED after retrieveLaunchParams error. Setting specific auth error.");
            setTelegramAuthError(errorMsg); // Set the original error from retrieveLaunchParams
          }
        })
        .catch(fetchError => {
          console.error("UserContext: Unexpected error during direct localStorage fallback (after retrieveLaunchParams error):", fetchError);
          setTelegramAuthError("Unexpected error during fallback authentication after launch param failure.");
          setCurrentUserAndUpdateStorage(null);
        })
        .finally(() => {
          console.log("UserContext: retrieveLaunchParams error path in useEffect FINALLY. Setting loadingUserInternal to false.");
          setLoadingUserInternal(false);
        });
      return;
    }

    if (!initDataRaw) {
      const errorMsg = 'Telegram launch parameters (initDataRaw) were not found using retrieveLaunchParams(). Please ensure the app is launched correctly through the bot.';
      console.warn(`UserContext: ${errorMsg}`);
      
      console.log("UserContext: initDataRaw is MISSING after retrieveLaunchParams. Attempting direct localStorage fallback via fetchUserData(true).");
      fetchUserData(true, true) // true for initial, true for fallback
        .then(user => {
          if (user) {
            console.log("UserContext: Direct localStorage fallback successful (initDataRaw missing path).", user.id);
          } else {
            console.warn("UserContext: Direct localStorage fallback FAILED (initDataRaw missing path). Setting specific auth error.");
            setTelegramAuthError(errorMsg); // Set the specific error about missing initDataRaw
          }
        })
        .catch(fetchError => {
          console.error("UserContext: Unexpected error during direct localStorage fallback (initDataRaw missing path):", fetchError);
          setTelegramAuthError("Unexpected error during fallback authentication.");
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
        console.log("UserContext: Timeout triggered. Calling initializeTelegramSession with retrieved initDataRaw.");
        initializeTelegramSession(initDataRaw).finally(() => {
            console.log("UserContext: initializeTelegramSession (from initDataRaw path) FINALLY. Setting loadingUserInternal to false.");
            setLoadingUserInternal(false);
        });
    }, 150); 

    return () => {
      console.log("UserContext: Main initialization useEffect cleanup (clearing timeout).");
      clearTimeout(timerId);
    };

  }, [isMounted, currentUser, initializeTelegramSession, fetchUserData, setCurrentUserAndUpdateStorage]); // Added fetchUserData, setCurrentUserAndUpdateStorage


  const updateUserSession = useCallback((updatedUserData: Partial<AppUser>) => {
    console.log("UserContext: updateUserSession called with:", updatedUserData);
    setCurrentUserInternal(prevUser => {
      if (!prevUser) {
        console.warn("UserContext: updateUserSession called but prevUser is null. Cannot update.");
        return null;
      }
      const newUser = { ...prevUser, ...updatedUserData };
      // Ensure numeric fields are numbers
      (Object.keys(updatedUserData) as Array<keyof AppUser>).forEach(key => {
        const numericKeys: (keyof AppUser)[] = [
          'gold_points', 'diamond_points', 'purple_gem_points', 'blue_gem_points', 
          'referrals_made', 'referral_gold_earned', 'referral_diamond_earned', 
          'ad_spins_used_today_count', 'ad_views_today_count', 'bonus_spins_available', 
          'daily_reward_streak', 'daily_ad_views_limit', 'stake_builder_high_score'
        ];
        if (numericKeys.includes(key)) {
          (newUser as any)[key] = Number(updatedUserData[key] ?? 0);
        } else if (key === 'initial_free_spin_used') {
          (newUser as any)[key] = Boolean(updatedUserData[key]);
        }
      });
      // Update localStorage with the new minimal data
      if (newUser.id && newUser.telegram_id) {
         const minimalUserForStorage = {
            id: newUser.id,
            telegram_id: newUser.telegram_id,
            first_name: newUser.first_name,
            username: newUser.username,
            photo_url: newUser.photo_url,
         };
         localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(minimalUserForStorage));
         console.log("UserContext: Minimal user data updated in localStorage via updateUserSession.");
      }
      console.log("UserContext: User session updated via updateUserSession. New state:", newUser.id);
      return newUser;
    });
  }, []);

  const finalLoadingState = !isMounted || loadingUserInternal;

  const providerValue = React.useMemo(() => ({
    currentUser,
    setCurrentUser: setCurrentUserAndUpdateStorage, // Use the wrapped setter
    updateUserSession,
    loadingUser: finalLoadingState,
    fetchUserData,
    telegramAuthError
  }), [currentUser, setCurrentUserAndUpdateStorage, updateUserSession, finalLoadingState, fetchUserData, telegramAuthError]);

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

    
