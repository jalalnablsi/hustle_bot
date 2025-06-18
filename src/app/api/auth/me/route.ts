import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AppUser } from '@/app/types';

export async function GET(req: NextRequest) {
  try {
    // 1. Get and validate cookie
    const tgUserStr = req.cookies.get('tgUser')?.value;
    
    if (!tgUserStr) {
      console.warn('Auth me - No tgUser cookie found');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication cookie not found. Please login through Telegram.' 
        },
        { status: 401 }
      );
    }

    // 2. Parse cookie content
    let tgUser;
    try {
      tgUser = JSON.parse(tgUserStr);
      
      // Validate required fields
      if (!tgUser || !tgUser.telegram_id) {
        throw new Error('Missing telegram_id in cookie');
      }
    } catch (e) {
      console.error('Auth me - Cookie parse error:', e);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid authentication cookie format. Please re-login.' 
        },
        { status: 400 }
      );
    }

    // 3. Fetch user from database
    const telegramId = tgUser.telegram_id.toString();
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle(); // Safe handling of no results

    if (error) {
      console.error('Auth me - Database error:', {
        message: error.message,
        code: error.code
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database error fetching user. Please try again later.' 
        },
        { status: 500 }
      );
    }

    if (!user) {
      console.warn(`Auth me - User not found for telegram_id: ${telegramId}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found. Please re-login through Telegram.' 
        },
        { status: 404 }
      );
    }

    // 4. Update last login timestamp
    try {
      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);
    } catch (e) {
      console.error('Auth me - Failed to update last_login:', e);
      // Non-fatal error - continue with response
    }

    // 5. Sanitize and format user data
    const sanitizedUser: AppUser = {
      id: user.id.toString(),
      telegram_id: user.telegram_id.toString(),
      first_name: user.first_name || 'User',
      last_name: user.last_name || null,
      username: user.username || null,
      gold_points: Number(user.gold_points) || 0,
      diamond_points: Number(user.diamond_points) || 0,
      purple_gem_points: Number(user.purple_gem_points) || 0,
      blue_gem_points: Number(user.blue_gem_points) || 0,
      referral_link: user.referral_link || 
        `https://t.me/HustleSoulBot?start=${user.telegram_id}`,
      referrals_made: Number(user.referrals_made) || 0,
      referral_gold_earned: Number(user.referral_gold_earned) || 0,
      referral_diamond_earned: Number(user.referral_diamond_earned) || 0,
      initial_free_spin_used: Boolean(user.initial_free_spin_used),
      ad_spins_used_today_count: Number(user.ad_spins_used_today_count) || 0,
      ad_views_today_count: Number(user.ad_views_today_count) || 0,
      bonus_spins_available: Number(user.bonus_spins_available) || 0,
      daily_reward_streak: Number(user.daily_reward_streak) || 0,
      last_daily_reward_claim_at: user.last_daily_reward_claim_at || null,
      daily_ad_views_limit: Number(user.daily_ad_views_limit) || 50,
      created_at: user.created_at || new Date().toISOString(),
      last_login: user.last_login || new Date().toISOString(),
      game_hearts: typeof user.game_hearts === 'object' && user.game_hearts !== null ? user.game_hearts : {},
      last_heart_replenished: user.last_heart_replenished || null,
    };

    // 6. Remove undefined properties
    Object.keys(sanitizedUser).forEach(key => {
      const K = key as keyof AppUser;
      if (sanitizedUser[K] === undefined) {
        delete sanitizedUser[K];
      }
    });

    // 7. Return successful response
    return NextResponse.json(
      { 
        success: true, 
        user: sanitizedUser 
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Auth me - Unexpected error:', {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error. Please try again later.' 
      },
      { status: 500 }
    );
  }
}
