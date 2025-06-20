
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AppUser } from '@/app/types';
import { cookies } from 'next/headers'
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const tgUserCookie = cookieStore.get('tgUser');

    if (!tgUserCookie || !tgUserCookie.value) {
      console.warn('Auth me - cookie missing:', req.url);
      return NextResponse.json({ success: false, error: 'Authentication cookie not found. Please login.' }, { status: 401 });
    }

    let tgUserFromCookie;
    try {
        tgUserFromCookie = JSON.parse(tgUserCookie.value);
    } catch (e) {
        console.error('Auth me - cookie parse error:', e, { cookieValue: tgUserCookie.value.substring(0,100) });
        return NextResponse.json({ success: false, error: 'Invalid authentication cookie format.' }, { status: 400 });
    }

    if (!tgUserFromCookie || !tgUserFromCookie.id || !tgUserFromCookie.telegram_id) {
         console.warn('Auth me - invalid cookie content (missing id or telegram_id):', tgUserFromCookie);
         return NextResponse.json({ success: false, error: 'Invalid authentication cookie content.' }, { status: 400 });
    }
    
    const userIdFromCookie = tgUserFromCookie.id.toString();

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userIdFromCookie)
      .single();

    if (error) {
      console.error('Auth me - user fetch error by DB ID:', error.message, error.code, { userIdFromCookie });
      if (error.code === 'PGRST116') {
         return NextResponse.json({ success: false, error: 'User not found in database (via cookie ID). Please login again.' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: `Database error fetching user: ${error.message}` }, { status: 500 });
    }
    
    if (!user) { 
         return NextResponse.json({ success: false, error: 'User not found (post-query check with cookie ID).' }, { status: 404 });
    }

    if (user.telegram_id.toString() !== tgUserFromCookie.telegram_id.toString()) {
        console.warn('Auth me - cookie TG ID mismatch with DB record:', { cookieTgId: tgUserFromCookie.telegram_id, dbTgId: user.telegram_id });
    }

    try {
        await supabaseAdmin
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', user.id);
    } catch (updateError) {
        console.warn('Auth me - failed to update last_login:', updateError);
    }

    const sanitizedUser: AppUser = {
      id: user.id.toString(),
      telegram_id: user.telegram_id.toString(),
      first_name: user.first_name || '',
      last_name: user.last_name || null,
      username: user.username || null,
      photo_url: user.photo_url || null,
      gold_points: Number(user.gold_points || 0),
      diamond_points: Number(user.diamond_points || 0),
      purple_gem_points: Number(user.purple_gem_points || 0),
      blue_gem_points: Number(user.blue_gem_points || 0),
      referral_link: user.referral_link || `https://t.me/YOUR_BOT_USERNAME?start=${user.telegram_id}`,
      referrals_made: Number(user.referrals_made || 0),
      referral_gold_earned: Number(user.referral_gold_earned || 0),
      referral_diamond_earned: Number(user.referral_diamond_earned || 0),
      initial_free_spin_used: Boolean(user.initial_free_spin_used),
      ad_spins_used_today_count: Number(user.ad_spins_used_today_count || 0),
      ad_views_today_count: Number(user.ad_views_today_count || 0),
      bonus_spins_available: Number(user.bonus_spins_available || 0),
      daily_reward_streak: Number(user.daily_reward_streak || 0),
      last_daily_reward_claim_at: user.last_daily_reward_claim_at || null,
      daily_ad_views_limit: Number(user.daily_ad_views_limit || 50),
      created_at: user.created_at || new Date().toISOString(),
      last_login: user.last_login || new Date().toISOString(),
      game_hearts: typeof user.game_hearts === 'object' && user.game_hearts !== null ? user.game_hearts : {},
      last_heart_replenished: user.last_heart_replenished || null,
  
    };
    
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
