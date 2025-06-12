
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const tgUserStr = req.cookies.get('tgUser')?.value;

    if (!tgUserStr) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telegram ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tgUser = JSON.parse(tgUserStr);
    const telegramId = tgUser.id.toString();

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) {
      console.error('Auth me - user fetch error:', error);
      if (error.code === 'PGRST116') { // User not found
         return new Response(
          JSON.stringify({ success: false, error: 'User not found. Please login again.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const sanitizedUser = {
      ...user,
      gold_points: Number(user.gold_points || 0),
      diamond_points: Number(user.diamond_points || 0),
      purple_gem_points: Number(user.purple_gem_points || 0),
      blue_gem_points: Number(user.blue_gem_points || 0),
      bonus_spins_available: Number(user.bonus_spins_available || 0),
      ad_views_today_count: Number(user.ad_views_today_count || 0),
      daily_ad_views_limit: Number(user.daily_ad_views_limit || 5),
      daily_reward_streak: Number(user.daily_reward_streak || 0),
      initial_free_spin_used: Boolean(user.initial_free_spin_used),
    };

    return new Response(
      JSON.stringify({
        success: true,
        user: sanitizedUser,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Auth me error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
