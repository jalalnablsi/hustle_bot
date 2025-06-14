import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referrer_id } = body;

    if (!referrer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing referrer_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. جلب الإحالات النشطة ← لا يمكن التلاعب
    const { data: referrals, error: fetchReferralsError } = await supabaseAdmin
      .from('referrals')
      .select(`
        id,
        referred_id,
        last_rewarded_gold,
        last_rewarded_diamond,
         users:referrals_referred_id_fkey (
          gold_points,
          diamond_points
        )
      `)
      .eq('referrer_id', referrer_id)
      .eq('status', 'active');

    if (fetchReferralsError) throw fetchReferralsError;

    if (!referrals || referrals.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active referrals found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let totalGoldReward = 0;
    let totalDiamondReward = 0;

    // 2. حساب المكافآت ← لا يمكن التلاعب
    for (const referral of referrals) {
      const referredUser = referral.users;
      const lastGold = referral.last_rewarded_gold;
      const lastDiamond = referral.last_rewarded_diamond;

      const goldDiff = Math.max(0, referredUser.gold_points - lastGold);
      const diamondDiff = Math.max(0, referredUser.diamond_points - lastDiamond);

      totalGoldReward += goldDiff * 0.05; // 5%
      totalDiamondReward += diamondDiff * 0.05;
    }

    // 3. تحديث بيانات الإحالات ← لا يمكن التلاعب
    for (const referral of referrals) {
      const referredUser = referral.users;

      await supabaseAdmin
        .from('referrals')
        .update({
          last_rewarded_gold: referredUser.gold_points,
          last_rewarded_diamond: referredUser.diamond_points,
          rewards_collected: true,
        })
        .eq('id', referral.id);
    }

    // 4. تحديث رصيد المحيل ← لا يمكن التلاعب
    const { data: referrer, error: fetchReferrerError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', referrer_id)
      .single();

    if (fetchReferrerError) throw fetchReferrerError;

    const updatedGold = Number(referrer.gold_points) + totalGoldReward;
    const updatedDiamonds = Number(referrer.diamond_points) + totalDiamondReward;

    const updatedReferralGold = Number(referrer.referral_gold_earned) + totalGoldReward;
    const updatedReferralDiamond = Number(referrer.referral_diamond_earned) + totalDiamondReward;

    await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        diamond_points: updatedDiamonds,
        referral_gold_earned: updatedReferralGold,
        referral_diamond_earned: updatedReferralDiamond,
      })
      .eq('id', referrer_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Rewards collected successfully!',
        goldEarned: totalGoldReward,
        diamondEarned: totalDiamondReward,
        totalGold: updatedGold,
        totalDiamonds: updatedDiamonds,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error collecting referral rewards:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}