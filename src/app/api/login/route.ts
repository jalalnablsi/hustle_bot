
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

// Function to validate Telegram initData
function validateTelegramData(initDataString: string, botToken: string): { isValid: boolean; userData?: any; startParam?: string | null; authDate?: number; hash?: string; rawUserParam?: string; } {
  const params = new URLSearchParams(initDataString);
  const hash = params.get('hash');
  
  if (!hash) return { isValid: false };

  const dataToCheck: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataToCheck.push(`${key}=${value}`);
    }
  });

  dataToCheck.sort(); 
  const dataCheckString = dataToCheck.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  
  if (calculatedHash !== hash) {
    console.warn("Telegram data validation: Hash mismatch.", { calculatedHash, receivedHash: hash, dataCheckString });
    return { isValid: false };
  }

  const authDateParam = params.get('auth_date');
  if (!authDateParam) {
      console.warn("Telegram data validation: auth_date missing.");
      return { isValid: false };
  }
  const authDate = parseInt(authDateParam, 10);
  const now = Math.floor(Date.now() / 1000);

  if (now - authDate > AUTH_EXPIRATION_SECONDS) { 
    console.warn(`Telegram data validation: auth_date is too old (>${AUTH_EXPIRATION_SECONDS}s). AuthDate: ${authDate}, Now: ${now}`);
    return { isValid: false, error: "Authentication data has expired. Please relaunch." } as any;
  }
  
  const userParam = params.get('user');
  if (!userParam) {
      // This could be valid if the WebApp is opened in a context where user data isn't directly passed,
      // but for login, we expect it.
      console.warn("Telegram data validation: user parameter missing in initData.");
      return { isValid: true, userData: null, authDate, hash, rawUserParam: null }; // Hash is valid, but no user for login
  }

  try {
    const userData = JSON.parse(decodeURIComponent(userParam));
    const startParam = params.get('start_param') || null;
    return { isValid: true, userData, startParam, authDate, hash, rawUserParam: userParam };
  } catch (e) {
    console.error("Error parsing Telegram user data from initData:", e);
    return { isValid: false, error: "Could not parse user data." } as any;
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
      return NextResponse.json({ success: false, error: 'Server configuration error: Bot token missing.' }, { status: 500 });
    }

    const validationResult = validateTelegramData(initDataString, TELEGRAM_BOT_TOKEN);

    if (!validationResult.isValid || !validationResult.userData) {
      console.warn("Telegram data validation failed or user data missing for login. Result:", validationResult);
      return NextResponse.json({ success: false, error: (validationResult as any).error || 'Invalid or incomplete Telegram data. Please relaunch from Telegram.' }, { status: 403 });
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
        bonus_spins_available: 1, 
        daily_reward_streak: 0,
        last_daily_reward_claim_at: null,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        daily_ad_views_limit: 50, 
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
          .eq('telegram_id', referrerTelegramId.toString())
          .single();
        if (!fetchRefError && refUserRec) {
          referrerUserRecord = refUserRec;
        } else {
          console.warn(`Referrer with TG ID ${referrerTelegramId} not found.`);
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

      if (referrerUserRecord && insertedUser) {
        await supabaseAdmin
          .from('users')
          .update({
            gold_points: (referrerUserRecord.gold_points || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRER,
            bonus_spins_available: (referrerUserRecord.bonus_spins_available || 0) + REFERRAL_BONUS_SPINS_FOR_REFERRER,
            referrals_made: (referrerUserRecord.referrals_made || 0) + 1,
          })
          .eq('id', referrerUserRecord.id);

        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerUserRecord.id,
            referred_id: insertedUser.id,
            status: 'inactive', // Start as inactive for ongoing earnings
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
      throw fetchUserError; 
    } else if (existingUser) {
      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', existingUser.id);
    }
    
    // This data is for the /api/login response, not the cookie.
    // The cookie is minimal for security.
    const userForResponsePayload = { 
      id: existingUser.id.toString(),
      telegram_id: existingUser.telegram_id.toString(),
      first_name: existingUser.first_name,
      username: existingUser.username,
      // Add other fields if needed by the client immediately after login,
      // but /api/auth/me will be the main source of truth.
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
            responsePayload.referralBonusGold = referralBonusGoldForReferredUser; 
            responsePayload.referralBonusSpinsForReferrer = REFERRAL_BONUS_SPINS_FOR_REFERRER; 
            responsePayload.referralBonusGoldForReferrer = REFERRAL_BONUS_GOLD_FOR_REFERRER;
        }
    } else {
        responsePayload.message = "User login successful.";
    }

    const response = NextResponse.json(responsePayload, { status: 200 });

    // Set the HTTPOnly cookie containing basic, non-sensitive Telegram user info for /api/auth/me
    // The rawUserParam might be large, so only store essential identifiers.
    const cookieTgUser = {
        id: tgUserData.id.toString(),
        first_name: tgUserData.first_name,
        username: tgUserData.username,
        // Storing auth_date and hash from initData can be useful for re-validation by /api/auth/me if needed,
        // but requires careful consideration of cookie size and security. For now, keep it simple.
        // auth_date: validationResult.authDate,
        // hash: validationResult.hash,
    };

    response.cookies.set(
      'tgUser', 
      JSON.stringify(cookieTgUser),
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
    console.error('Login API error:', error.message, error.stack);
    return NextResponse.json({ success: false, error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
    
    
