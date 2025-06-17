
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AppUser } from '@/app/types';
import crypto from 'node:crypto';

const WELCOME_BONUS_GOLD = 100;
const WELCOME_BONUS_DIAMONDS = 1;
const REFERRAL_BONUS_GOLD_FOR_REFERRED = 150; 
const REFERRAL_BONUS_SPINS_FOR_REFERRER = 1;  
const REFERRAL_BONUS_GOLD_FOR_REFERRER = 200; 

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTH_EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

// Function to validate Telegram initData using HMAC-SHA256 as per documentation
function validateTelegramData(initDataString: string, botToken: string): { isValid: boolean; userData?: any; startParam?: string | null; error?: string; } {
  const params = new URLSearchParams(initDataString);
  
  const hash = params.get('hash');
  if (!hash) {
    return { isValid: false, error: "Hash parameter missing in initData." };
  }

  // Step 1 & 2 from Telegram docs: Create array of key=value strings, sort, exclude hash
  const dataToCheck: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataToCheck.push(`${key}=${value}`);
    }
  });
  dataToCheck.sort(); // Sort alphabetically
  const dataCheckString = dataToCheck.join('\n'); // Join with newline

  // Step 3 from Telegram docs: Create secret_key for HMAC
  // HMAC-SHA256(bot_token, "WebAppData") - bot_token is the data, "WebAppData" is the key
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  
  // Step 4 from Telegram docs: Create HMAC-SHA256 of data_check_string with secret_key
  // HMAC-SHA256(data_check_string, secret_key) - data_check_string is data, secretKey is the key
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  
  // Step 5: Compare hashes
  if (calculatedHash !== hash) {
    console.warn("Telegram data validation: HMAC hash mismatch.", { calculatedHash, receivedHash: hash, dataCheckString });
    return { isValid: false, error: "Invalid data signature (hash mismatch)." };
  }

  // Check auth_date
  const authDateParam = params.get('auth_date');
  if (!authDateParam) {
      console.warn("Telegram data validation: auth_date missing.");
      return { isValid: false, error: "Authentication date missing from initData." };
  }
  const authDate = parseInt(authDateParam, 10);
  const now = Math.floor(Date.now() / 1000);

  if (now - authDate > AUTH_EXPIRATION_SECONDS) { 
    console.warn(`Telegram data validation: auth_date is too old (>${AUTH_EXPIRATION_SECONDS}s). AuthDate: ${authDate}, Now: ${now}`);
    return { isValid: false, error: "Authentication data has expired. Please relaunch the app." };
  }
  
  const userParam = params.get('user');
  if (!userParam) {
      // This case means the hash is valid, but the user object itself isn't in the initData.
      // This might happen in some contexts, but for a login, we expect it.
      console.warn("Telegram data validation: user parameter missing in initData, though hash is valid.");
      // Depending on strictness, you could return isValid: false here if user object is mandatory.
      // For now, let's say the data is valid but user object is missing.
      return { isValid: true, userData: null, startParam: params.get('start_param') || null, error: "User data object missing in initData." };
  }

  try {
    const userData = JSON.parse(decodeURIComponent(userParam));
    const startParam = params.get('start_param') || null;
    return { isValid: true, userData, startParam };
  } catch (e) {
    console.error("Error parsing Telegram user data (JSON) from initData:", e);
    return { isValid: false, error: "Could not parse user data JSON from initData." };
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initDataString } = body;

    if (!initDataString) {
      return NextResponse.json({ success: false, error: 'Missing initDataString' }, { status: 400 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN is not set in environment variables.");
      return NextResponse.json({ success: false, error: 'Server configuration error: Bot token missing for validation.' }, { status: 500 });
    }

    const validationResult = validateTelegramData(initDataString, TELEGRAM_BOT_TOKEN);

    if (!validationResult.isValid) {
      console.warn("Telegram data validation failed. Result:", validationResult);
      return NextResponse.json({ success: false, error: validationResult.error || 'Invalid Telegram data. Please relaunch from Telegram.' }, { status: 403 });
    }
    
    if (!validationResult.userData) {
      // Hash was valid, but user object was missing in initData or couldn't be parsed.
      console.warn("Telegram data valid, but user object missing or unparseable in initData. Result:", validationResult);
      return NextResponse.json({ success: false, error: validationResult.error || 'User data object missing or unparseable in initData. Please relaunch.' }, { status: 403 });
    }

    const tgUserData = validationResult.userData;
    const referrerTelegramId = validationResult.startParam; // This is the start_param from initData
    const telegramId = tgUserData.id.toString();
    const firstName = tgUserData.first_name;
    const lastName = tgUserData.last_name || null;
    const username = tgUserData.username || null;

    // Check if user exists
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    let existingUser = user;
    let isNewUser = false;
    let referralBonusApplied = false;
    let welcomeBonusGoldApplied = 0;
    let welcomeBonusDiamondsApplied = 0;
    let referralBonusGoldForReferredUser = 0;


    if (fetchUserError && fetchUserError.code === 'PGRST116') { // User not found, create new
      isNewUser = true;
      welcomeBonusGoldApplied = WELCOME_BONUS_GOLD;
      welcomeBonusDiamondsApplied = WELCOME_BONUS_DIAMONDS;

      const newUserPayload: Partial<AppUser> = {
        telegram_id: telegramId,
        first_name: firstName,
        last_name: lastName,
        username: username,
        referral_link: `https://t.me/HustleSoulBot?start=${telegramId}`, 
        gold_points: welcomeBonusGoldApplied,
        diamond_points: welcomeBonusDiamondsApplied,
        purple_gem_points: 0,
        blue_gem_points: 0,
        referrals_made: 0,
        initial_free_spin_used: false,
        ad_spins_used_today_count: 0,
        ad_views_today_count: 0, // Initialize general ad views count
        bonus_spins_available: 1, // Typically 1 free spin for new users
        daily_reward_streak: 0,
        last_daily_reward_claim_at: null,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        daily_ad_views_limit: 50, // Default daily ad views limit
        game_hearts: { stake_builder: { count: 5, nextRegen: null } }, 
        last_heart_replenished: null,
        stake_builder_high_score: 0,
        referral_gold_earned: 0,
        referral_diamond_earned: 0,
      };

      let referrerUserRecord: AppUser | null = null;
      if (referrerTelegramId && referrerTelegramId !== telegramId) { // Prevent self-referral
        const { data: refUserRec, error: fetchRefError } = await supabaseAdmin
          .from('users')
          .select('*')
          // Important: Referrer is identified by their *Telegram ID* from start_param
          .eq('telegram_id', referrerTelegramId.toString()) 
          .single();
        if (!fetchRefError && refUserRec) {
          referrerUserRecord = refUserRec;
        } else {
          console.warn(`Referrer with TG ID ${referrerTelegramId} (from start_param) not found.`);
        }
      }

      if (referrerUserRecord) {
        newUserPayload.gold_points = (newUserPayload.gold_points || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRED;
        referralBonusGoldForReferredUser = REFERRAL_BONUS_GOLD_FOR_REFERRED;
      }

      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(newUserPayload)
        .select()
        .single();

      if (insertError) {
          console.error("Error inserting new user:", insertError);
          throw insertError;
      }
      existingUser = insertedUser;

      // Apply bonuses to referrer if a valid referrer was found and new user created
      if (referrerUserRecord && insertedUser) {
        await supabaseAdmin
          .from('users')
          .update({
            gold_points: (referrerUserRecord.gold_points || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRER,
            bonus_spins_available: (referrerUserRecord.bonus_spins_available || 0) + REFERRAL_BONUS_SPINS_FOR_REFERRER,
            referrals_made: (referrerUserRecord.referrals_made || 0) + 1,
          })
          .eq('id', referrerUserRecord.id); // Referrer's Supabase ID

        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerUserRecord.id, // Referrer's Supabase ID
            referred_id: insertedUser.id,     // New user's Supabase ID
            status: 'inactive', // Start as inactive for ongoing earnings; activate based on criteria
            ad_views_count: 0,     
            rewards_collected: false, 
            last_rewarded_gold: 0,
            last_rewarded_diamond: 0,
            created_at: new Date().toISOString(),
          });
        referralBonusApplied = true;
      }

    } else if (fetchUserError) { // Other error fetching user (not PGRST116)
      console.error("Error fetching existing user:", fetchUserError);
      throw fetchUserError; 
    } else if (existingUser) { // User exists, update last login and potentially other details
      await supabaseAdmin
        .from('users')
        .update({ 
            last_login: new Date().toISOString(),
            // Optionally update username/first_name/last_name if they changed in Telegram
            ...(username && username !== existingUser.username && { username }),
            ...(firstName && firstName !== existingUser.first_name && { first_name: firstName }),
            ...(lastName !== existingUser.last_name && { last_name: lastName }), // Handles if lastName becomes null
        })
        .eq('id', existingUser.id);
    }
    
    // This data is for the /api/login response, not the cookie.
    // The cookie is minimal for security.
    const userForResponsePayload = { 
      id: existingUser!.id.toString(), // existingUser will be defined at this point due to logic flow
      telegram_id: existingUser!.telegram_id.toString(),
      first_name: existingUser!.first_name,
      username: existingUser!.username,
    };

    const responsePayload: any = {
        success: true,
        user: userForResponsePayload, // Send minimal user data
        isNewUser,
        referralBonusApplied,
    };

    if (isNewUser) {
        responsePayload.message = "User created successfully.";
        responsePayload.welcomeBonusGold = welcomeBonusGoldApplied;
        responsePayload.welcomeBonusDiamonds = welcomeBonusDiamondsApplied;
        if(referralBonusApplied) {
            responsePayload.referralBonusGoldForReferred = referralBonusGoldForReferredUser; 
            responsePayload.referralBonusSpinsForReferrer = REFERRAL_BONUS_SPINS_FOR_REFERRER; 
            responsePayload.referralBonusGoldForReferrer = REFERRAL_BONUS_GOLD_FOR_REFERRER;
        }
    } else {
        responsePayload.message = "User login successful.";
    }

    const response = NextResponse.json(responsePayload, { status: 200 });

    // For the /api/auth/me cookie, store only essential, non-sensitive identifiers from the *validated* tgUserData.
    // Do NOT store the full initDataRaw in the cookie.
    const cookieTgUser = {
        id: tgUserData.id.toString(),
        first_name: tgUserData.first_name,
        username: tgUserData.username,
        // auth_date and hash from initData are not needed in the cookie for /api/auth/me
        // as the session is now established by this login.
    };

    response.cookies.set(
      'tgUser', 
      JSON.stringify(cookieTgUser),
      {
        path: '/',
        httpOnly: true, 
        maxAge: 60 * 60 * 24 * 7, // 7 days
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'Lax', // Or 'Strict' if appropriate for your flow
      }
    );

    return response;

  } catch (error: any) {
    console.error('Login API error:', error.message, error.stack);
    return NextResponse.json({ success: false, error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
