
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AppUser } from '@/app/types';

export async function GET(req: NextRequest) {
  try {
    const tgUserStr = req.cookies.get('tgUser')?.value;

    if (!tgUserStr) {
      return NextResponse.json({ success: false, error: 'Authentication cookie not found. Please login.' }, { status: 401 });
    }

    let tgUserFromCookie;
    try {
        tgUserFromCookie = JSON.parse(tgUserStr);
    } catch (e) {
        return NextResponse.json({ success: false, error: 'Invalid authentication cookie format.' }, { status: 400 });
    }

    if (!tgUserFromCookie || !tgUserFromCookie.id) {
         return NextResponse.json({ success: false, error: 'Invalid authentication cookie content (missing ID).' }, { status: 400 });
    }
    
    const telegramId = tgUserFromCookie.id.toString();

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) {
      console.error('Auth me - user fetch error:', error.message, error.code);
      if (error.code === 'PGRST116') { // User not found
         return NextResponse.json({ success: false, error: 'User not found in database. Please login again.' }, { status: 404 });
      }
      // For other database errors
      return NextResponse.json({ success: false, error: `Database error fetching user: ${error.message}` }, { status: 500 });
    }
    
    if (!user) { // Should be caught by PGRST116, but as a safeguard
         return NextResponse.json({ success: false, error: 'User not found (post-query check).' }, { status: 404 });
    }


    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Ensure all numeric fields are numbers and booleans are booleans
    const sanitizedUser: AppUser = {
      id: user.id.toString(),
      telegram_id: user.telegram_id.toString(),
      first_name: user.first_name || '',
      last_name: user.last_name || null,
      username: user.username || null,
      gold_points: Number(user.gold_points) || 0,
      diamond_points: Number(user.diamond_points) || 0,
      purple_gem_points: Number(user.purple_gem_points) || 0,
      blue_gem_points: Number(user.blue_gem_points) || 0,
      referral_link: user.referral_link || `https://t.me/YOUR_BOT_USERNAME?start=${user.telegram_id}`, // Replace YOUR_BOT_USERNAME
      referrals_made: Number(user.referrals_made) || 0,
      referral_gold_earned: Number(user.referral_gold_earned) || 0,
      referral_diamond_earned: Number(user.referral_diamond_earned) || 0,
      initial_free_spin_used: Boolean(user.initial_free_spin_used),
      ad_spins_used_today_count: Number(user.ad_spins_used_today_count) || 0,
      ad_views_today_count: Number(user.ad_views_today_count) || 0,
      bonus_spins_available: Number(user.bonus_spins_available) || 0,
      daily_reward_streak: Number(user.daily_reward_streak) || 0,
      last_daily_reward_claim_at: user.last_daily_reward_claim_at || null,
      daily_ad_views_limit: Number(user.daily_ad_views_limit) || 50, // Default
      created_at: user.created_at || new Date().toISOString(),
      last_login: user.last_login || new Date().toISOString(), // Ensure last_login is a string
      game_hearts: typeof user.game_hearts === 'object' && user.game_hearts !== null ? user.game_hearts : {},
  
    };
    
    // Remove any potentially problematic or undefined fields that AppUser might not expect
    // (This is generally handled by explicit mapping above, but as a safeguard)
    Object.keys(sanitizedUser).forEach(key => {
        const K = key as keyof AppUser;
        if (sanitizedUser[K] === undefined) {
            delete sanitizedUser[K];
        }
    });


    return NextResponse.json({
        success: true,
        user: sanitizedUser,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Auth me - general error:', error.message, error.stack);
    return NextResponse.json({ success: false, error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
