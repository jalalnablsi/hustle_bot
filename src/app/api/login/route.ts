
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

// Function to validate Telegram initData
function validateTelegramData(initDataString: string, botToken: string): { isValid: boolean; userData?: any; startParam?: string | null } {
  const params = new URLSearchParams(initDataString);
  const hash = params.get('hash');
  
  if (!hash) return { isValid: false };

  const dataToCheck: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataToCheck.push(`${key}=${value}`);
    }
  });

  dataToCheck.sort(); // Sort alphabetically
  const dataCheckString = dataToCheck.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  
  if (calculatedHash !== hash) {
    return { isValid: false };
  }

  // Optional: Check auth_date for freshness (e.g., within 24 hours)
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) { // 24 hours
    console.warn("Telegram auth_date is older than 24 hours.");
    // Depending on security policy, you might want to reject this.
    // For now, we'll allow it but log a warning.
  }
  
  const userParam = params.get('user');
  if (!userParam) return { isValid: true, userData: null }; // Valid hash but no user data in this structure.

  try {
    const userData = JSON.parse(decodeURIComponent(userParam));
    const startParam = params.get('start_param') || null;
    return { isValid: true, userData, startParam };
  } catch (e) {
    console.error("Error parsing Telegram user data:", e);
    return { isValid: false };
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

    const { isValid, userData: tgUserData, startParam: referrerTelegramId } = validateTelegramData(initDataString, TELEGRAM_BOT_TOKEN);

    if (!isValid || !tgUserData || !tgUserData.id) {
      console.warn("Telegram data validation failed or user data missing. Body:", body, "Validation result:", {isValid, tgUserData});
      return NextResponse.json({ success: false, error: 'Invalid or incomplete Telegram data. Please relaunch from Telegram.' }, { status: 403 });
    }
    
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
        referral_link: `https://t.me/HustleSoulBot?start=${telegramId}`, // Ensure your bot username is correct here
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
        daily_ad_views_limit: 50, // Default daily ad limit
        game_hearts: { stake_builder: { count: 5, nextRegen: null } }, 
        last_heart_replenished: null,
        stake_builder_high_score: 0,
      };

      let referrerUserRecord: AppUser | null = null;
      if (referrerTelegramId) {
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
            status: 'inactive', 
            ad_views_count: 0,     
            rewards_collected: false, 
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
    
    const sanitizedUser = {
      ...existingUser,
      id: existingUser.id.toString(),
      telegram_id: existingUser.telegram_id.toString(),
      gold_points: Number(existingUser.gold_points || 0),
      diamond_points: Number(existingUser.diamond_points || 0),
      purple_gem_points: Number(existingUser.purple_gem_points || 0),
      blue_gem_points: Number(existingUser.blue_gem_points || 0),
      bonus_spins_available: Number(existingUser.bonus_spins_available || 0),
      ad_spins_used_today_count: Number(existingUser.ad_spins_used_today_count || 0),
      ad_views_today_count: Number(existingUser.ad_views_today_count || 0),
      daily_ad_views_limit: Number(existingUser.daily_ad_views_limit || 50),
      daily_reward_streak: Number(existingUser.daily_reward_streak || 0),
      initial_free_spin_used: Boolean(existingUser.initial_free_spin_used),
      game_hearts: typeof existingUser.game_hearts === 'object' && existingUser.game_hearts !== null ? existingUser.game_hearts : {},
      stake_builder_high_score: Number(existingUser.stake_builder_high_score) || 0,
      last_heart_replenished: existingUser.last_heart_replenished || null,
    };

    const responsePayload: any = {
        success: true,
        user: sanitizedUser, // The /api/auth/me endpoint will re-fetch and be the source of truth for client
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

    // Set the cookie containing basic, non-sensitive Telegram user info
    // This cookie is primarily used by /api/auth/me to identify the user for DB lookup
    response.cookies.set(
      'tgUser', // Cookie name
      JSON.stringify({ // Store a minimal JSON string
        id: sanitizedUser.telegram_id, 
        first_name: sanitizedUser.first_name,
        username: sanitizedUser.username,
      }),
      {
        path: '/',
        httpOnly: true, // Crucial for security
        maxAge: 60 * 60 * 24 * 7, // 7 days
        secure: process.env.NODE_ENV === 'production', // True in production
        sameSite: 'Lax', // Or 'Strict' if appropriate
      }
    );

    return response;

  } catch (error: any) {
    console.error('Login API error:', error.message, error.stack);
    return NextResponse.json({ success: false, error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
    
