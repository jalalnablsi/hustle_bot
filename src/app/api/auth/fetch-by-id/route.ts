
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AppUser } from '@/app/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    // Validate if userId is a UUID if your IDs are UUIDs, otherwise adjust validation
    // Example UUID regex: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    // if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId)) {
    //   return NextResponse.json({ success: false, error: 'Invalid User ID format.' }, { status: 400 });
    // }
    
    console.log(`API fetch-by-id: Attempting to fetch user with DB ID: ${userId}`);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId) // Fetch by the primary key 'id' (UUID)
      .single();

    if (error) {
      console.error(`API fetch-by-id: User fetch error for ID ${userId}:`, error.message, error.code);
      if (error.code === 'PGRST116') { // No rows found
         return NextResponse.json({ success: false, error: 'User not found in database.' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: `Database error fetching user: ${error.message}` }, { status: 500 });
    }
    
    if (!user) { 
         return NextResponse.json({ success: false, error: 'User not found (post-query check).' }, { status: 404 });
    }

    // No need to update last_login here, this is a data retrieval endpoint
    // last_login should be updated upon active session validation (e.g. in /api/auth/me or /api/login)

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
    
    console.log(`API fetch-by-id: Successfully fetched user: ${sanitizedUser.id}`);
    return NextResponse.json({
        success: true,
        user: sanitizedUser,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('API fetch-by-id: General error:', error.message, error.stack);
    return NextResponse.json({ success: false, error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
