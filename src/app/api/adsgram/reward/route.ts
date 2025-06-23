
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ADSGRAM_BLOCK_ID_WHEEL = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_WHEEL;
const ADSGRAM_BLOCK_ID_DIAMOND = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_DIAMOND;
const ADSGRAM_BLOCK_ID_STAKE_HEART = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_STAKE_HEART;

const DIAMOND_REWARD_AMOUNT_FROM_AD = 1;
const SPIN_REWARD_AMOUNT_FROM_AD = 1;
const HEART_REWARD_AMOUNT_FROM_AD = 1;
const MAX_POOLED_HEARTS_STAKE_BUILDER = 5; 
const GAME_TYPE_STAKE_BUILDER = 'stake-builder';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const telegramId = searchParams.get('userId');
  const blockId = searchParams.get('blockId');

  console.log(`Adsgram Reward: Full request URL received: ${req.url}`);

  if (!telegramId) {
    console.error('Adsgram Reward Error: User ID (Telegram ID) is required from Adsgram.');
    return NextResponse.json({ success: false, error: 'User ID (Telegram ID) is required from Adsgram.' }, { status: 400 });
  }
  if (!blockId) {
    console.error('Adsgram Reward Error: Block ID is required from Adsgram for Telegram ID:', telegramId);
    return NextResponse.json({ success: false, error: 'Block ID is required from Adsgram.' }, { status: 400 });
  }

  console.log(`Adsgram Reward: Received callback for userId: ${telegramId}, blockId: ${blockId}`);

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
    
    const currentTotalAdsViews = Number(user.total_ads_views || 0) + 1;
    const currentAdViewsToday = Number(user.ad_views_today_count || 0); 
    const dailyAdLimitGeneral = Number(user.daily_ad_views_limit || 50);

    if (blockId === ADSGRAM_BLOCK_ID_DIAMOND || blockId === ADSGRAM_BLOCK_ID_STAKE_HEART) {
        if (currentAdViewsToday >= dailyAdLimitGeneral) {
            console.warn(`Adsgram Reward: Daily ad limit reached for user ${telegramId} (general: ${currentAdViewsToday}/${dailyAdLimitGeneral}) for blockId ${blockId}`);
            return NextResponse.json({ success: false, error: `Daily ad limit reached (${currentAdViewsToday}/${dailyAdLimitGeneral}).` }, { status: 429 });
        }
        updatePayload.ad_views_today_count = currentAdViewsToday + 1;
    }

    if (blockId === ADSGRAM_BLOCK_ID_WHEEL) {
      const currentBonusSpins = Number(user.bonus_spins_available || 0);
      const currentAdSpinsUsedForWheel = Number(user.ad_spins_used_today_count || 0); 
      const dailySpinAdLimit = Number(user.daily_ad_views_limit_wheel || 3);

      if (currentAdSpinsUsedForWheel >= dailySpinAdLimit) {
        console.warn(`Adsgram Reward: Daily ad limit for wheel spins reached for user ${telegramId} (${currentAdSpinsUsedForWheel}/${dailySpinAdLimit})`);
        return NextResponse.json({ success: false, error: `Daily ad limit for wheel spins reached (${currentAdSpinsUsedForWheel}/${dailySpinAdLimit}).` }, { status: 429 });
      }
      updatePayload = {
        ...updatePayload,
        bonus_spins_available: currentBonusSpins + SPIN_REWARD_AMOUNT_FROM_AD,
        ad_spins_used_today_count: currentAdSpinsUsedForWheel + 1,
      };
      rewardType = 'spin_wheel';
      rewardAmount = SPIN_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_wheel_spin';

    } else if (blockId === ADSGRAM_BLOCK_ID_DIAMOND) {
      const currentDiamondPoints = Number(user.diamond_points || 0);
      updatePayload = {
        ...updatePayload, 
        diamond_points: currentDiamondPoints + DIAMOND_REWARD_AMOUNT_FROM_AD,
      };
      rewardType = 'diamond';
      rewardAmount = DIAMOND_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_diamond_reward';

    } else if (blockId === ADSGRAM_BLOCK_ID_STAKE_HEART) {
      const gameHeartsRaw = user.game_hearts; 
      const currentHeartsForStakeBuilder = Number(gameHeartsRaw?.[GAME_TYPE_STAKE_BUILDER] || 0);
      
      if (currentHeartsForStakeBuilder >= MAX_POOLED_HEARTS_STAKE_BUILDER) {
        console.warn(`Adsgram Reward: Max hearts already reached for Stake Builder for user ${telegramId}`);
        return NextResponse.json({ success: false, error: 'Maximum hearts already reached for Stake Builder.' }, { status: 403 });
      }

      const updatedGameHearts = { ...(typeof gameHeartsRaw === 'object' && gameHeartsRaw !== null ? gameHeartsRaw : {}) };
      updatedGameHearts[GAME_TYPE_STAKE_BUILDER] = currentHeartsForStakeBuilder + HEART_REWARD_AMOUNT_FROM_AD;
      
      updatePayload = {
        ...updatePayload, 
        game_hearts: updatedGameHearts,
      };
      rewardType = 'heart_stake_builder';
      rewardAmount = HEART_REWARD_AMOUNT_FROM_AD;
      purpose = 'adsgram_stake_builder_heart';

    } else {
      console.warn('Adsgram Reward: Unknown blockId received:', blockId, 'for user', telegramId);
      return NextResponse.json({ success: false, error: 'Unknown or unsupported ad block ID.' }, { status: 400 });
    }

    updatePayload.total_ads_views = currentTotalAdsViews;

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
       
        ad_id: blockId,
      });

    if (logError) {
      console.error('Adsgram Reward: Error logging ad view:', user.id, logError);
    }
    
    console.log(`Adsgram Reward: Successfully processed for userId: ${telegramId}, blockId: ${blockId}. Update:`, updatePayload);
    return NextResponse.json({ success: true, message: `Reward processed for block ${blockId}.` });

  } catch (error: any) {
    console.error('Adsgram Reward: Unexpected error in /api/adsgram/reward:', error, "for userId:", telegramId, "blockId:", blockId);
    return NextResponse.json({ success: false, error: 'Internal server error.', details: error.message }, { status: 500 });
  }
}
