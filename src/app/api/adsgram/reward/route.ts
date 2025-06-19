
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ADSGRAM_BLOCK_ID_WHEEL = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_WHEEL;
const ADSGRAM_BLOCK_ID_DIAMOND = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_DIAMOND;
const ADSGRAM_BLOCK_ID_STAKE_HEART = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_STAKE_HEART;

const DIAMOND_REWARD_AMOUNT_FROM_AD = 1;
const SPIN_REWARD_AMOUNT_FROM_AD = 1;
const HEART_REWARD_AMOUNT_FROM_AD = 1;
const MAX_POOLED_HEARTS_STAKE_BUILDER = 5; // Consistent with game page

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const telegramId = searchParams.get('userId');
  const blockId = searchParams.get('blockId');

  if (!telegramId) {
    return NextResponse.json({ success: false, error: 'User ID (Telegram ID) is required from Adsgram.' }, { status: 400 });
  }
  if (!blockId) {
    return NextResponse.json({ success: false, error: 'Block ID is required from Adsgram.' }, { status: 400 });
  }

  try {
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (fetchUserError || !user) {
      console.error('Adsgram Reward: User not found or DB error for Telegram ID:', telegramId, fetchUserError?.message);
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    let updatePayload: Partial<any> = {};
    let rewardType = '';
    let rewardAmount = 0;
    let purpose = '';
    const now = new Date().toISOString();
    
    // Ensure numeric fields are treated as numbers, defaulting to 0 if null/undefined
    const currentTotalAdsViews = Number(user.total_ads_views || 0) + 1;
    const currentAdViewsToday = Number(user.ad_views_today_count || 0);
    const dailyAdLimitGeneral = Number(user.daily_ad_views_limit || 50); // General limit

    // Generic Ad Limit Check (applied to Diamond and Heart ads, Wheel ads have specific counter)
    if (blockId === ADSGRAM_BLOCK_ID_DIAMOND || blockId === ADSGRAM_BLOCK_ID_STAKE_HEART) {
        if (currentAdViewsToday >= dailyAdLimitGeneral) {
             return NextResponse.json({ success: false, error: `Daily ad limit reached (${currentAdViewsToday}/${dailyAdLimitGeneral}).` }, { status: 429 });
        }
    }


    if (blockId === ADSGRAM_BLOCK_ID_WHEEL) {
      const currentBonusSpins = Number(user.bonus_spins_available || 0);
      const currentAdSpinsUsedForWheel = Number(user.ad_spins_used_today_count || 0); // Assuming ad_spins_used_today_count is for wheel
      const dailySpinAdLimit = Number(user.daily_ad_views_limit || 3); // This might need a specific column 'daily_wheel_ad_limit' if it's different from general

      if (currentAdSpinsUsedForWheel >= dailySpinAdLimit) {
        return NextResponse.json({ success: false, error: `Daily ad limit for wheel spins reached (${currentAdSpinsUsedForWheel}/${dailySpinAdLimit}).` }, { status: 429 });
      }
      updatePayload = {
        bonus_spins_available: currentBonusSpins + SPIN_REWARD_AMOUNT_FROM_AD,
        ad_spins_used_today_count: currentAdSpinsUsedForWheel + 1, // Increment specific counter for wheel ads
        total_ads_views: currentTotalAdsViews, // Increment total ads viewed
      };
      rewardType = 'spin';
      rewardAmount = SPIN_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_wheel_spin';

    } else if (blockId === ADSGRAM_BLOCK_ID_DIAMOND) {
      const currentDiamondPoints = Number(user.diamond_points || 0);
      // General ad counter 'ad_views_today_count' is already checked above
      updatePayload = {
        diamond_points: currentDiamondPoints + DIAMOND_REWARD_AMOUNT_FROM_AD,
        ad_views_today_count: currentAdViewsToday + 1, // Increment general ad counter
        total_ads_views: currentTotalAdsViews,
      };
      rewardType = 'diamond';
      rewardAmount = DIAMOND_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_diamond_reward';

    } else if (blockId === ADSGRAM_BLOCK_ID_STAKE_HEART) {
      const gameHeartsRaw = user.game_hearts;
      // Standardizing to simple key-value: { 'stake-builder': count }
      const currentHearts = Number(gameHeartsRaw?.['stake-builder'] || 0);
      
      // General ad counter 'ad_views_today_count' is already checked above
      if (currentHearts >= MAX_POOLED_HEARTS_STAKE_BUILDER) {
        return NextResponse.json({ success: false, error: 'Maximum hearts already reached for Stake Builder.' }, { status: 403 });
      }

      const updatedGameHearts = { ...(typeof gameHeartsRaw === 'object' && gameHeartsRaw !== null ? gameHeartsRaw : {}) };
      updatedGameHearts['stake-builder'] = currentHearts + HEART_REWARD_AMOUNT_FROM_AD;
      
      updatePayload = {
        game_hearts: updatedGameHearts,
        ad_views_today_count: currentAdViewsToday + 1, // Increment general ad counter
        total_ads_views: currentTotalAdsViews,
      };
      rewardType = 'heart_stake_builder';
      rewardAmount = HEART_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_stake_builder_heart';

    } else {
      console.warn('Adsgram Reward: Unknown blockId received:', blockId);
      return NextResponse.json({ success: false, error: 'Unknown or unsupported ad block ID.' }, { status: 400 });
    }

    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', user.id);

    if (updateUserError) {
      console.error('Adsgram Reward: Error updating user:', user.id, updateUserError);
      return NextResponse.json({ success: false, error: 'Failed to update user details.' }, { status: 500 });
    }

    // Log the ad view
    const { error: logError } = await supabaseAdmin
      .from('ad_views_log')
      .insert({
        user_id: user.id,
        rewarded: true,
        reward_type: rewardType,
        reward_amount: rewardAmount,
        purpose: purpose,
        viewed_at: now,
        ad_platform: 'adsgram',
        ad_block_id: blockId,
      });

    if (logError) {
      console.error('Adsgram Reward: Error logging ad view:', user.id, logError);
      // Non-critical, so don't fail the request if logging fails
    }

    return NextResponse.json({ success: true, message: `Reward processed for block ${blockId}.` });

  } catch (error: any) {
    console.error('Adsgram Reward: Unexpected error in /api/adsgram/reward:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.', details: error.message }, { status: 500 });
  }
}
