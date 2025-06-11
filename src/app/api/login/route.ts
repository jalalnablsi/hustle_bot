
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, firstName, lastName, username } = body;

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

    if (fetchUserError && fetchUserError.code === 'PGRST116') {
      const newUser = {
        telegram_id: telegramId.toString(),
        first_name: firstName,
        last_name: lastName || null,
        username: username || null,
        referral_link: `https://t.me/HustleSoulBot?start=${telegramId}`, // Updated bot name
        gold_points: 100, // Initial GOLD points for new user
        diamond_points: 1, // Initial DIAMOND points for new user
        purple_gem_points: 0,
        blue_gem_points: 0,
        referrals_made: 0,
        initial_free_spin_used: false, // New users get a free spin
        ad_spins_used_today_count: 0,
        bonus_spins_available: 1, // Start with 1 bonus spin (initial free spin)
        daily_reward_streak: 0,
        last_daily_reward_claim_at: null,
      };

      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(newUser)
        .select()
        .single();

      if (insertError) throw insertError;

      existingUser = insertedUser;
      isNewUser = true;
    } else if (fetchUserError) {
      throw fetchUserError; // Re-throw other fetch errors
    }


    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', existingUser.id);

    const sanitizedUser = {
      ...existingUser,
      gold_points: Number(existingUser.gold_points || 0),
      diamond_points: Number(existingUser.diamond_points || 0),
      purple_gem_points: Number(existingUser.purple_gem_points || 0),
      blue_gem_points: Number(existingUser.blue_gem_points || 0),
      bonus_spins_available: Number(existingUser.bonus_spins_available || 0),
      ad_spins_used_today_count: Number(existingUser.ad_spins_used_today_count || 0),
      daily_ad_views_limit: Number(existingUser.daily_ad_views_limit || 5),
      daily_reward_streak: Number(existingUser.daily_reward_streak || 0),
    };

    const response = new Response(
      JSON.stringify({
        success: true,
        user: sanitizedUser,
        isNewUser,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

    response.headers.set(
      'Set-Cookie',
      `tgUser=${encodeURIComponent(JSON.stringify({
        id: sanitizedUser.telegram_id,
        first_name: sanitizedUser.first_name,
        username: sanitizedUser.username,
      }))}; Path=/; HttpOnly; Max-Age=86400; Secure; SameSite=strict`
    );

    return response;

  } catch (error: any) {
    console.error('Login error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

