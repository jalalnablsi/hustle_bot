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

    // Step 1: جلب بيانات المستخدم ← لا يمكن التلاعب
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: التحقق من الحد الأقصى للمشاهدات ← لا يمكن التلاعب
    const dailyLimit = user.daily_ad_views_limit || 50;
    const todayViews = user.ad_views_today_count || 0;
    const updatedTotalAdsViews = Number(user.total_ads_views) + 1;

    if (todayViews >= dailyLimit) {
      return new Response(
        JSON.stringify({ success: false, error: 'Daily ad views limit reached' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: حساب الجواهر ← لا يمكن التلاعب
    const diamondRewardAmount = 1; // 1 DIAMOND لكل إعلان
    const updatedDiamondBalance = Number(user.diamond_points) + diamondRewardAmount;

    // Step 4: زيادة عدد المشاهدات ← لا يمكن التلاعب
    const updatedAdViewsCount = todayViews + 1;

    // Step 5: تحديث رصيد المستخدم ← لا يمكن التلاعب
    await supabaseAdmin
      .from('users')
      .update({
        diamond_points: updatedDiamondBalance,
        ad_views_today_count: updatedAdViewsCount,
        total_ads_views:updatedAdViewsCount,
      })
      .eq('id', userId);

    // Step 6: تسجيل المشاهدة ← لا يمكن التلاعب
    await supabaseAdmin.from('ad_views_log').insert({
      purpose: 'diamond_reward',
      user_id: userId,
      reward_type: 'diamond',
      reward_amount: diamondRewardAmount,
      viewed_at: new Date().toISOString(),
      rewarded: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'You earned a diamond by watching an ad.',
        diamondEarned: diamondRewardAmount,
        totalDiamonds: updatedDiamondBalance,
        adViewsToday: updatedAdViewsCount,
        adViewsRemaining: Math.max(0, dailyLimit - updatedAdViewsCount),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error watching ad:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}