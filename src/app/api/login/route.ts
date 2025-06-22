
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AppUser } from '@/app/types';
import crypto from 'node:crypto';

// --- Constants for Rewards and Settings ---
const WELCOME_BONUS_GOLD = 100;
const WELCOME_BONUS_DIAMONDS = 1;
const WELCOME_BONUS_SPINS = 1;
const WELCOME_BONUS_HEARTS = 5;

const REFERRAL_BONUS_GOLD_FOR_REFERRED = 150; // Bonus for the new user who was referred
const REFERRAL_BONUS_GOLD_FOR_REFERRER = 200; // Bonus for the user who made the referral
const REFERRAL_BONUS_SPINS_FOR_REFERRER = 1; // Bonus for the user who made the referral

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'HustleSoulBot';
const AUTH_EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface ValidatedTelegramData {
  isValid: boolean;
  userData?: any;
  startParam?: string | null;
  error?: string;
}

// More robust validation function
function validateTelegramData(initDataString: string, botToken: string): ValidatedTelegramData {
  if (!initDataString) {
    return { isValid: false, error: "initDataString is empty or undefined." };
  }

  const params = new URLSearchParams(initDataString);
  const hashFromTelegram = params.get('hash');
  const userParam = params.get('user');

  if (!hashFromTelegram || !userParam) {
    return { isValid: false, error: "Hash or user parameter missing in initData." };
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
    const secretKey = secretKeyHmac.digest();

    const calculatedHashHmac = crypto.createHmac('sha256', secretKey);
    calculatedHashHmac.update(dataCheckString);
    const calculatedHash = calculatedHashHmac.digest('hex');

    if (calculatedHash !== hashFromTelegram) {
      console.warn("Telegram data validation: HMAC hash mismatch.", { calculatedHash, receivedHash: hashFromTelegram });
      return { isValid: false, error: "Invalid data signature (hash mismatch)." };
    }
  } catch (e: any) {
    console.error("Error during HMAC calculation for validation:", e);
    return { isValid: false, error: "Server error during data validation (HMAC)." };
  }

  const authDateParam = params.get('auth_date');
  if (!authDateParam || isNaN(parseInt(authDateParam, 10))) {
    console.warn("Telegram data validation: auth_date missing or invalid.");
    return { isValid: false, error: "Authentication date missing or invalid from initData." };
  }
  const authDate = parseInt(authDateParam, 10);
  const now = Math.floor(Date.now() / 1000);

  if (now - authDate > AUTH_EXPIRATION_SECONDS) {
    console.warn(`Telegram data validation: auth_date is too old (>${AUTH_EXPIRATION_SECONDS}s). AuthDate: ${authDate}, Now: ${now}`);
    return { isValid: false, error: "Authentication data has expired. Please relaunch the app." };
  }

  try {
    const userData = JSON.parse(userParam);
    // Use 'start_param' as Telegram sends it, not 'startapp'
    const startParam = params.get('start_param') || null; 
    console.log("Login API (validateTelegramData): Successfully parsed. start_param is:", startParam);
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

    if (!validationResult.isValid || !validationResult.userData) {
      console.warn("Login API: Telegram data validation failed or user data missing.", validationResult);
      return NextResponse.json({ success: false, error: validationResult.error || 'Invalid Telegram data. Please relaunch from Telegram.' }, { status: 403 });
    }

    const tgUserData = validationResult.userData;
    const referrerTelegramId = validationResult.startParam;
    const telegramId = tgUserData.id.toString();
    
    console.log(`Login API: Processing request for TG ID ${telegramId}. Received start_param (referrer TG ID): ${referrerTelegramId}`);

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    let existingUser = user;
    let isNewUser = false;
    let referralBonusApplied = false;

    if (fetchUserError && fetchUserError.code === 'PGRST116') { // User not found, create new
      isNewUser = true;
      console.log(`Login API: New user detected with TG ID: ${telegramId}.`);
      
      let finalWelcomeBonusGold = WELCOME_BONUS_GOLD;
      let referrerUserRecord: any = null;

      // --- Referral Logic ---
      if (referrerTelegramId && referrerTelegramId !== telegramId) {
        console.log(`Login API: Searching for referrer with TG ID: ${referrerTelegramId}`);
        const { data: refUserRec, error: fetchRefError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('telegram_id', referrerTelegramId.toString())
          .single();

        if (!fetchRefError && refUserRec) {
          referrerUserRecord = refUserRec;
          finalWelcomeBonusGold += REFERRAL_BONUS_GOLD_FOR_REFERRED;
          console.log(`Login API: Found referrer user with DB ID ${referrerUserRecord.id}. New user will get an extra ${REFERRAL_BONUS_GOLD_FOR_REFERRED} gold.`);
        } else {
          console.warn(`Login API: Referrer with TG ID ${referrerTelegramId} (from start_param) not found. No referral bonus will be applied.`, fetchRefError?.message);
        }
      }
      // --- End Referral Logic ---

      const newUserPayload = {
        telegram_id: telegramId,
        first_name: tgUserData.first_name || '',
        last_name: tgUserData.last_name || null,
        username: tgUserData.username || null,
        photo_url: tgUserData.photo_url || null,
        gold_points: finalWelcomeBonusGold,
        diamond_points: WELCOME_BONUS_DIAMONDS,
        bonus_spins_available: WELCOME_BONUS_SPINS,
        game_hearts: { 'stake-builder': WELCOME_BONUS_HEARTS },
        // Use /Start for deep linking bots, startapp is for launching specific mini-apps
        referral_link: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${telegramId}`,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      };

      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(newUserPayload)
        .select()
        .single();

      if (insertError) {
        console.error("Login API: Error inserting new user:", insertError);
        return NextResponse.json({ success: false, error: `Database error inserting user: ${insertError.message}`, details: insertError }, { status: 500 });
      }
      
      console.log(`Login API: New user successfully created with DB ID: ${insertedUser.id}`);
      existingUser = insertedUser;

      // --- Apply Referrer Bonuses and Create Link if Referrer Was Found ---
      if (referrerUserRecord && insertedUser) {
        console.log(`Login API: Applying referral bonuses to referrer ID: ${referrerUserRecord.id}`);
        const { error: referrerUpdateError } = await supabaseAdmin
          .from('users')
          .update({
            gold_points: (Number(referrerUserRecord.gold_points) || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRER,
            bonus_spins_available: (Number(referrerUserRecord.bonus_spins_available) || 0) + REFERRAL_BONUS_SPINS_FOR_REFERRER,
            referrals_made: (Number(referrerUserRecord.referrals_made) || 0) + 1,
            referral_gold_earned: (Number(referrerUserRecord.referral_gold_earned) || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRER,
          })
          .eq('id', referrerUserRecord.id);
        
        if (referrerUpdateError) {
            console.error(`Login API: FAILED to update referrer user ${referrerUserRecord.id}.`, referrerUpdateError);
        } else {
            console.log(`Login API: Successfully updated referrer user ${referrerUserRecord.id}.`);
        }

        const { error: referralInsertError } = await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerUserRecord.id,
            referred_id: insertedUser.id,
            status: 'active',
            created_at: new Date().toISOString(),
          });

        if (referralInsertError) {
             console.error(`Login API: FAILED to insert into referrals table for referrer ${referrerUserRecord.id} and referred ${insertedUser.id}.`, referralInsertError);
        } else {
            console.log(`Login API: Successfully created referral link between referrer ${referrerUserRecord.id} and referred ${insertedUser.id}.`);
        }
        referralBonusApplied = true;
      }
      // --- End Apply Referrer Bonuses ---

    } else if (fetchUserError) {
      console.error("Login API: Error fetching existing user:", fetchUserError);
      return NextResponse.json({ success: false, error: `Database error fetching user: ${fetchUserError.message}` }, { status: 500 });
    } else if (existingUser) { // Existing user login
      console.log(`Login API: Existing user login for TG ID: ${telegramId}, DB ID: ${existingUser.id}`);
      await supabaseAdmin
        .from('users')
        .update({
          last_login: new Date().toISOString(),
          ...(tgUserData.username && tgUserData.username !== existingUser.username && { username: tgUserData.username }),
          ...(tgUserData.first_name && tgUserData.first_name !== existingUser.first_name && { first_name: tgUserData.first_name }),
          ...(tgUserData.last_name !== existingUser.last_name && { last_name: tgUserData.last_name }),
          ...(tgUserData.photo_url && tgUserData.photo_url !== existingUser.photo_url && { photo_url: tgUserData.photo_url }),
        })
        .eq('id', existingUser.id);
    }

    if (!existingUser) {
      console.error("Login API: Critical error - existingUser is null after create/fetch logic.");
      return NextResponse.json({ success: false, error: 'Failed to establish user session.' }, { status: 500 });
    }

    const userForCookieAndResponse = {
      id: existingUser.id.toString(),
      telegram_id: existingUser.telegram_id.toString(),
      first_name: existingUser.first_name,
      username: existingUser.username,
      photo_url: existingUser.photo_url,
    };

    const responsePayload: any = {
      success: true,
      user: userForCookieAndResponse,
      isNewUser,
      referralBonusApplied,
      message: isNewUser ? "User created successfully." : "User login successful.",
    };

    const response = NextResponse.json(responsePayload, { status: 200 });

    response.cookies.set(
      'tgUser',
      JSON.stringify(userForCookieAndResponse),
      {
        path: '/',
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE_SECONDS,
        secure: true, 
        sameSite: 'None',
      }
    );

    return response;

  } catch (error: any) {
    console.error('Login API: General unhandled error:', error.message, error.stack, error);
    return NextResponse.json({ success: false, error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
