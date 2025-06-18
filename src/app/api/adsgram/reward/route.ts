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
      console.error('Adsgram Reward: User not found or DB error for Telegram ID:', telegramId, fetchUserError);
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    let updatePayload: Partial<any> = {};
    let rewardType = '';
    let rewardAmount = 0;
    let purpose = '';
    const now = new Date().toISOString();
    const currentTotalAdsViews = Number(user.total_ads_views || 0) + 1;

    if (blockId === ADSGRAM_BLOCK_ID_WHEEL) {
      const currentBonusSpins = Number(user.bonus_spins_available || 0);
      const currentAdSpinsUsed = Number(user.ad_spins_used_today_count || 0);
      const dailySpinAdLimit = Number(user.daily_ad_views_limit || 3); // Default from wheel page, make consistent

      if (currentAdSpinsUsed >= dailySpinAdLimit) {
        return NextResponse.json({ success: false, error: `Daily ad limit for spins reached (${currentAdSpinsUsed}/${dailySpinAdLimit}).` }, { status: 429 });
      }
      updatePayload = {
        bonus_spins_available: currentBonusSpins + SPIN_REWARD_AMOUNT_FROM_AD,
        ad_spins_used_today_count: currentAdSpinsUsed + 1, // Specific counter for wheel ads
        total_ads_views: currentTotalAdsViews,
      };
      rewardType = 'spin';
      rewardAmount = SPIN_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_wheel_spin';

    } else if (blockId === ADSGRAM_BLOCK_ID_DIAMOND) {
      const currentDiamondPoints = Number(user.diamond_points || 0);
      const currentAdViewsToday = Number(user.ad_views_today_count || 0); // General ad counter
      const dailyDiamondAdLimit = Number(user.daily_ad_views_limit || 50);

      if (currentAdViewsToday >= dailyDiamondAdLimit) {
         return NextResponse.json({ success: false, error: `Daily ad limit for diamonds reached (${currentAdViewsToday}/${dailyDiamondAdLimit}).` }, { status: 429 });
      }
      updatePayload = {
        diamond_points: currentDiamondPoints + DIAMOND_REWARD_AMOUNT_FROM_AD,
        ad_views_today_count: currentAdViewsToday + 1,
        total_ads_views: currentTotalAdsViews,
      };
      rewardType = 'diamond';
      rewardAmount = DIAMOND_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_diamond_reward';

    } else if (blockId === ADSGRAM_BLOCK_ID_STAKE_HEART) {
      const gameHeartsRaw = user.game_hearts;
      const currentHearts = typeof gameHeartsRaw === 'object' && gameHeartsRaw !== null && gameHeartsRaw['stake-builder'] !== undefined
        ? Number(gameHeartsRaw['stake-builder']) // Direct number access if new schema
        : (typeof gameHeartsRaw === 'object' && gameHeartsRaw !== null && typeof gameHeartsRaw['stake-builder'] === 'object' && gameHeartsRaw['stake-builder'] !== null
            ? Number(gameHeartsRaw['stake-builder'].count) // Access .count if old schema
            : 0);
      
      const currentAdViewsToday = Number(user.ad_views_today_count || 0); // Using general ad counter
      const dailyAdLimit = Number(user.daily_ad_views_limit || 50);


      if (currentAdViewsToday >= dailyAdLimit) {
        return NextResponse.json({ success: false, error: `Daily ad limit for hearts reached (${currentAdViewsToday}/${dailyAdLimit}).` }, { status: 429 });
      }
      if (currentHearts >= MAX_POOLED_HEARTS_STAKE_BUILDER) {
        return NextResponse.json({ success: false, error: 'Maximum hearts already reached for Stake Builder.' }, { status: 403 });
      }

      const updatedGameHearts = { ...(typeof gameHeartsRaw === 'object' && gameHeartsRaw !== null ? gameHeartsRaw : {}) };
      // Standardize game_hearts to be simple key-value { 'game-id': count }
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
    }

    return NextResponse.json({ success: true, message: `Reward processed for block ${blockId}.` });

  } catch (error: any) {
    console.error('Adsgram Reward: Unexpected error in /api/adsgram/reward:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.', details: error.message }, { status: 500 });
  }
}
