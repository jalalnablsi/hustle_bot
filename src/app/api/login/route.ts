
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AppUser } from '@/app/types';

const WELCOME_BONUS_GOLD = 100;
const WELCOME_BONUS_DIAMONDS = 1;
const REFERRAL_BONUS_GOLD_FOR_REFERRED = 150; // Bonus for the new user who was referred
const REFERRAL_BONUS_SPINS_FOR_REFERRER = 1;  // Bonus for the one who made the referral
const REFERRAL_BONUS_GOLD_FOR_REFERRER = 200; // Bonus for the one who made the referral

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, firstName, lastName, username, referrerTelegramId } = body;

    if (!telegramId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Telegram ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId.toString())
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
        telegram_id: telegramId.toString(),
        first_name: firstName,
        last_name: lastName || null,
        username: username || null,
        referral_link: `https://t.me/HustleSoulBot?start=${telegramId}`,
        gold_points: welcomeBonusGoldApplied,
        diamond_points: welcomeBonusDiamondsApplied,
        purple_gem_points: 0,
        blue_gem_points: 0,
        referrals_made: 0,
        initial_free_spin_used: false,
        ad_spins_used_today_count: 0,
        bonus_spins_available: 1, // Initial free spin
        daily_reward_streak: 0,
        last_daily_reward_claim_at: null,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        // game_hearts: {}, 
        // last_heart_replenished: {}, 
      };

      // Handle referral if referrerTelegramId is provided for a new user
      let referrerUser: AppUser | null = null;
      if (referrerTelegramId) {
        const { data: refUser, error: fetchRefError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('telegram_id', referrerTelegramId.toString())
          .single();
        if (!fetchRefError && refUser) {
          referrerUser = refUser;
        } else {
          console.warn(`Referrer with TG ID ${referrerTelegramId} not found.`);
        }
      }

      if (referrerUser) {
        newUserPayload.gold_points = (newUserPayload.gold_points || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRED;
        referralBonusGoldForReferredUser = REFERRAL_BONUS_GOLD_FOR_REFERRED;
      }

      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(newUserPayload)
        .select()
        .single();

      if (insertError) throw insertError;
      existingUser = insertedUser;

      // If referral was processed, update referrer and log referral
      if (referrerUser && insertedUser) {
        await supabaseAdmin
          .from('users')
          .update({
            gold_points: (referrerUser.gold_points || 0) + REFERRAL_BONUS_GOLD_FOR_REFERRER,
            bonus_spins_available: (referrerUser.bonus_spins_available || 0) + REFERRAL_BONUS_SPINS_FOR_REFERRER,
            referrals_made: (referrerUser.referrals_made || 0) + 1,
          })
          .eq('id', referrerUser.id);

        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerUser.id,
            referred_id: insertedUser.id,
            status: 'inactive', // Changed from 'completed' to 'inactive'
            ad_views_count: 0,     // Added field
            rewards_collected: false, // Added field
            // completed_at: new Date().toISOString(), // Removed, as status is 'inactive'
            // referred_gold_at_activation: REFERRAL_BONUS_GOLD_FOR_REFERRED, // Removed, or re-evaluate if this means initial bonus
          });
        referralBonusApplied = true;
      }

    } else if (fetchUserError) {
      throw fetchUserError; // Re-throw other fetch errors
    } else {
      // User exists, update last_login
      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', existingUser.id);
    }


    const sanitizedUser = {
      ...existingUser,
      gold_points: Number(existingUser.gold_points || 0),
      diamond_points: Number(existingUser.diamond_points || 0),
      purple_gem_points: Number(existingUser.purple_gem_points || 0),
      blue_gem_points: Number(existingUser.blue_gem_points || 0),
      bonus_spins_available: Number(existingUser.bonus_spins_available || 0),
      ad_spins_used_today_count: Number(existingUser.ad_spins_used_today_count || 0),
      daily_ad_views_limit: Number(existingUser.daily_ad_views_limit || 5), // Default from schema or type
      daily_reward_streak: Number(existingUser.daily_reward_streak || 0),
      initial_free_spin_used: Boolean(existingUser.initial_free_spin_used),
    };

    const responsePayload: any = {
        success: true,
        user: sanitizedUser,
        isNewUser,
        referralBonusApplied,
    };
    if (isNewUser) {
        responsePayload.welcomeBonusGold = welcomeBonusGoldApplied;
        responsePayload.welcomeBonusDiamonds = welcomeBonusDiamondsApplied;
        if(referralBonusApplied) {
            responsePayload.referralBonusGold = referralBonusGoldForReferredUser; 
            responsePayload.referralBonusSpinsForReferrer = REFERRAL_BONUS_SPINS_FOR_REFERRER; 
            responsePayload.referralBonusGoldForReferrer = REFERRAL_BONUS_GOLD_FOR_REFERRER;
        }
    }


    const response = new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

    response.headers.set(
      'Set-Cookie',
      `tgUser=${encodeURIComponent(JSON.stringify({
        id: sanitizedUser.telegram_id, 
        first_name: sanitizedUser.first_name,
        username: sanitizedUser.username,
      }))}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 7}; Secure; SameSite=Lax` 
    );

    return response;

  } catch (error: any) {
    console.error('Login API error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
