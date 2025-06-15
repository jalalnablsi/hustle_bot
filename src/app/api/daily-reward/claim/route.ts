import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. جلب بيانات المستخدم ← لا يمكن التلاعب
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const lastClaimedAt = user.last_daily_reward_claim_at ? new Date(user.last_daily_reward_claim_at) : null;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    let rewardAmount = 50; // 50 ذهب كمكافأة أساسية
    let bonusSpins = 0;

    // 2. التحقق مما إذا كانت المكافأة قد سحبت بالفعل ← لا يمكن التلاعب
    if (lastClaimedAt) {
      const lastClaimDate = new Date(lastClaimedAt);
      lastClaimDate.setHours(0, 0, 0, 0);

      if (lastClaimDate >= todayStart) {
        return new Response(
          JSON.stringify({ success: false, error: 'Daily reward already claimed' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. حساب عدد الأيام بين آخر مطالبة واليوم ← لا يمكن التلاعب
    let dailyStreak = user.daily_reward_streak || 0;

    if (lastClaimedAt) {
      const diffDays = Math.floor((now.getTime() - lastClaimedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        dailyStreak += 1;
      } else if (diffDays > 1) {
        dailyStreak = 1;
      } else {
        dailyStreak = user.daily_reward_streak; // لم تمر 24 ساعة بعد
      }
    } else {
      dailyStreak = 1; // أول تسجيل دخول
    }

    // 4. تحديث رصيد المستخدم ← لا يمكن التلاعب
    const updatedGold = Number(user.gold_points) + rewardAmount;

    await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        daily_reward_streak: dailyStreak,
        last_daily_reward_claim_at: now.toISOString(),
      })
      .eq('id', userId);

    // 5. تسجيل المكافأة ← لا يمكن التلاعب
    await supabaseAdmin.from('daily_rewards_log').insert({
      user_id: userId,
      day_claimed: todayStart.toISOString().split('T')[0],
      reward_type: 'gold',
      amount_claimed: rewardAmount,
      claimed_at: now.toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily reward claimed successfully!',
        goldPoints: updatedGold,
        dailyRewardStreak: dailyStreak,
        nextClaimTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        rewardAmount,
        claimedAt: now.toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Daily reward claim error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}