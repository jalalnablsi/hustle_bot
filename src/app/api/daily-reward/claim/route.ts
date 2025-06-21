
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('id, gold_points, daily_reward_streak, last_daily_reward_claim_at')
      .eq('id', userId)
      .single();

    if (fetchUserError || !user) {
      console.error(`Daily Reward Claim Error: User not found for ID ${userId}`, fetchUserError);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const lastClaimedAt = user.last_daily_reward_claim_at ? new Date(user.last_daily_reward_claim_at) : null;

    if (lastClaimedAt && (now.getTime() - lastClaimedAt.getTime()) < TWENTY_FOUR_HOURS_IN_MS) {
      const nextClaimTime = new Date(lastClaimedAt.getTime() + TWENTY_FOUR_HOURS_IN_MS);
      return NextResponse.json({ 
        success: false, 
        error: 'Daily reward already claimed within the last 24 hours.',
        nextClaimTime: nextClaimTime.toISOString(),
      }, { status: 403 });
    }
    
    const yesterday = new Date(now.getTime() - TWENTY_FOUR_HOURS_IN_MS);
    let newStreak = 1; // Default to 1 for new claim or broken streak
    
    if (lastClaimedAt && lastClaimedAt > new Date(now.getTime() - (2 * TWENTY_FOUR_HOURS_IN_MS))) {
        // If last claim was within the last 48 hours, it's a continuing streak
        newStreak = (user.daily_reward_streak || 0) + 1;
    }

    // Define rewards based on streak
    const rewardAmount = 50 + (Math.min(newStreak, 7) * 10); // Base 50, +10 per day up to day 7

    const updatedGold = Number(user.gold_points || 0) + rewardAmount;
    
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        daily_reward_streak: newStreak,
        last_daily_reward_claim_at: now.toISOString(),
      })
      .eq('id', user.id);

    if (updateUserError) {
        console.error(`Daily Reward Claim Error: Failed to update user ${userId}`, updateUserError);
        return NextResponse.json({ success: false, error: 'Failed to update user rewards.' }, { status: 500 });
    }
    
    const { error: logError } = await supabaseAdmin.from('daily_rewards_log').insert({
      user_id: userId,
      day_claimed: now.toISOString().split('T')[0],
      reward_type: 'gold',
      amount_claimed: rewardAmount,
      claimed_at: now.toISOString(),
    });

    if (logError) {
        console.warn(`Daily Reward Claim Warning: Failed to log claim for user ${userId}`, logError);
    }

    const nextClaimTime = new Date(now.getTime() + TWENTY_FOUR_HOURS_IN_MS);

    return NextResponse.json({
        success: true,
        message: 'Daily reward claimed successfully!',
        goldPoints: updatedGold,
        dailyRewardStreak: newStreak,
        nextClaimTime: nextClaimTime.toISOString(),
        rewardAmount,
        claimedAt: now.toISOString(),
    });

  } catch (error: any) {
    console.error('Daily reward claim unhandled error:', error.message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
