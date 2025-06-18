
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

// Function to validate Telegram initData using HMAC-SHA256 as per Telegram documentation
function validateTelegramData(initDataString: string, botToken: string): { isValid: boolean; userData?: any; startParam?: string | null; error?: string; } {
  if (!initDataString) {
    return { isValid: false, error: "initDataString is empty or undefined." };
  }

  const params = new URLSearchParams(initDataString);
  const hashFromTelegram = params.get('hash');

  if (!hashFromTelegram) {
    return { isValid: false, error: "Hash parameter missing in initData." };
  }

  const dataToCheck: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataToCheck.push(`${key}=${value}`);
    }
  });
  dataToCheck.sort();
  const dataCheckString = dataToCheck.join('\n');

  try {
    const secretKeyHmac = crypto.createHmac('sha256', 'WebAppData');
    secretKeyHmac.update(botToken);
    const secretKey = secretKeyHmac.digest(); // Raw bytes for the next HMAC key

    const calculatedHashHmac = crypto.createHmac('sha256', secretKey);
    calculatedHashHmac.update(dataCheckString);
    const calculatedHash = calculatedHashHmac.digest('hex');

    if (calculatedHash !== hashFromTelegram) {
      console.warn("Telegram data validation: HMAC hash mismatch.", { calculatedHash, receivedHash: hashFromTelegram, dataCheckString });
      return { isValid: false, error: "Invalid data signature (hash mismatch)." };
    }
  } catch (e: any) {
    console.error("Error during HMAC calculation:", e);
    return { isValid: false, error: "Server error during data validation." };
  }

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
    console.warn("Telegram data validation: user parameter missing in initData, though hash is valid.");
    // Depending on strictness, you might still want to proceed or error out.
    // If user object is absolutely required, this should be isValid: false.
    // For now, assuming valid hash means we can trust other params like start_param if user is missing.
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
      console.error("TELEGRAM_BOT_TOKEN is not set in environment variables. Cannot validate Telegram data.");
      return NextResponse.json({ success: false, error: 'Server configuration error: Bot token missing. Cannot validate request.' }, { status: 500 });
    }

    const validationResult = validateTelegramData(initDataString, TELEGRAM_BOT_TOKEN);

    if (!validationResult.isValid) {
      console.warn("Telegram data validation failed. Result:", validationResult);
      return NextResponse.json({ success: false, error: validationResult.error || 'Invalid Telegram data. Please relaunch from Telegram.' }, { status: 403 });
    }

    if (!validationResult.userData) {
      console.warn("Telegram data valid, but user object missing or unparseable in initData. Result:", validationResult);
      return NextResponse.json({ success: false, error: validationResult.error || 'User data object missing or unparseable in initData. Please relaunch.' }, { status: 403 });
    }

    const tgUserData = validationResult.userData;
    const referrerTelegramId = validationResult.startParam;
    const telegramId = tgUserData.id.toString();
    const firstName = tgUserData.first_name;
    const lastName = tgUserData.last_name || null;
    const username = tgUserData.username || null;

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

      const newUserPayload: Omit<AppUser, 'id' | 'created_at' | 'last_login' | 'referral_link' > & Partial<Pick<AppUser, 'referral_link'>> = {
        telegram_id: telegramId,
        first_name: firstName,
        last_name: lastName,
        username: username,
        gold_points: welcomeBonusGoldApplied,
        diamond_points: welcomeBonusDiamondsApplied,
        purple_gem_points: 0,
        blue_gem_points: 0,
        referrals_made: 0,
        referral_gold_earned: 0,
        referral_diamond_earned: 0,
        initial_free_spin_used: false,
        ad_spins_used_today_count: 0,
        ad_views_today_count: 0,
        bonus_spins_available: 1, // Initial bonus spin
        daily_reward_streak: 0,
        last_daily_reward_claim_at: null,
        daily_ad_views_limit: 50,
        game_hearts: { 'stake-builder': { count: 5, nextRegen: null } }, // Default hearts for stake-builder
        last_heart_replenished: null,
        // stake_builder_high_score: 0, // REMOVED: This column does not exist on users table
        payment_wallet_address: null,
        payment_network: null,
      };

      let referrerUserRecord: AppUser | null = null;
      if (referrerTelegramId && referrerTelegramId !== telegramId) {
        const { data: refUserRec, error: fetchRefError } = await supabaseAdmin
          .from('users')
          .select('*') // Select all fields to ensure AppUser type compatibility
          .eq('telegram_id', referrerTelegramId.toString())
          .single();
        if (!fetchRefError && refUserRec) {
          referrerUserRecord = refUserRec as AppUser; // Cast to AppUser
        } else {
          console.warn(`Referrer with TG ID ${referrerTelegramId} (from start_param) not found or error:`, fetchRefError?.message);
        }
      }

      if (referrerUserRecord) {
        newUserPayload.gold_points = (newUserPayload.gold_points || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRED;
        referralBonusGoldForReferredUser = REFERRAL_BONUS_GOLD_FOR_REFERRED;
      }

      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
            ...newUserPayload,
            referral_link: `https://t.me/YOUR_BOT_USERNAME?start=${telegramId}`, // Replace YOUR_BOT_USERNAME if different
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting new user:", insertError);
        // PGRST204 is "Cannot find column" -- which this change aims to fix
        // Other errors could be different (e.g., unique constraint violation if logic is flawed)
        return NextResponse.json({ success: false, error: `Database error inserting user: ${insertError.message}`, details: insertError }, { status: 500 });
      }
      existingUser = insertedUser;

      if (referrerUserRecord && insertedUser) { // Ensure insertedUser is not null
        await supabaseAdmin
          .from('users')
          .update({
            gold_points: (Number(referrerUserRecord.gold_points) || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRER,
            bonus_spins_available: (Number(referrerUserRecord.bonus_spins_available) || 0) + REFERRAL_BONUS_SPINS_FOR_REFERRER,
            referrals_made: (Number(referrerUserRecord.referrals_made) || 0) + 1,
            referral_gold_earned: (Number(referrerUserRecord.referral_gold_earned) || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRER,
          })
          .eq('id', referrerUserRecord.id);

        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerUserRecord.id,
            referred_id: insertedUser.id,
            status: 'active',
            ad_views_count: 0,
            rewards_collected: false,
            last_rewarded_gold: 0,
            last_rewarded_diamond: 0,
            created_at: new Date().toISOString(),
          });
        referralBonusApplied = true;
      }

    } else if (fetchUserError) {
      console.error("Error fetching existing user:", fetchUserError);
      return NextResponse.json({ success: false, error: `Database error fetching user: ${fetchUserError.message}` }, { status: 500 });
    } else if (existingUser) {
      // User exists, update last login and potentially other details if changed
      await supabaseAdmin
        .from('users')
        .update({
          last_login: new Date().toISOString(),
          ...(username && username !== existingUser.username && { username }), // Only update if changed
          ...(firstName && firstName !== existingUser.first_name && { first_name: firstName }),
          ...(lastName !== existingUser.last_name && { last_name: lastName }),
        })
        .eq('id', existingUser.id);
    }

    if (!existingUser) {
      console.error("Critical error: existingUser is null after create/fetch logic.");
      return NextResponse.json({ success: false, error: 'Failed to establish user session.' }, { status: 500 });
    }

    // Prepare user object for the cookie and response (minimal, non-sensitive info for cookie)
    const userForCookieAndResponse = {
      id: existingUser.id.toString(), // Supabase ID (UUID)
      telegram_id: existingUser.telegram_id.toString(),
      first_name: existingUser.first_name,
      username: existingUser.username,
    };

    const responsePayload: any = {
      success: true,
      user: userForCookieAndResponse, // Send the minimal user object
      isNewUser,
      referralBonusApplied,
    };

    if (isNewUser) {
      responsePayload.message = "User created successfully.";
      responsePayload.welcomeBonusGold = welcomeBonusGoldApplied;
      responsePayload.welcomeBonusDiamonds = welcomeBonusDiamondsApplied;
      if (referralBonusApplied) {
        responsePayload.referralBonusGoldForReferred = referralBonusGoldForReferredUser;
        responsePayload.referralBonusSpinsForReferrer = REFERRAL_BONUS_SPINS_FOR_REFERRER;
        responsePayload.referralBonusGoldForReferrer = REFERRAL_BONUS_GOLD_FOR_REFERRER;
      }
    } else {
      responsePayload.message = "User login successful.";
    }

    const response = NextResponse.json(responsePayload, { status: 200 });

    // Set cookie with minimal Telegram user info
    response.cookies.set(
      'tgUser',
      JSON.stringify(userForCookieAndResponse), // Use the same minimal object
      {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
      }
    );

    return response;

  } catch (error: any) {
    console.error('Login API error:', error.message, error.stack, error);
    return NextResponse.json({ success: false, error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

    
