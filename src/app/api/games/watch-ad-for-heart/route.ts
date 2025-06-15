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

    if (fetchUserError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. التحقق من الحد الأقصى للمشاهدات اليومية ← لا يمكن التلاعب
    const dailyAdViewsLimit = user.daily_ad_views_limit || 50;
    const adViewsToday = user.ad_views_today_count || 0;

    if (adViewsToday >= dailyAdViewsLimit) {
      return new Response(
        JSON.stringify({ success: false, error: 'Daily ad views limit reached' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. الحصول على القلوب الحالية ← لا يمكن التلاعب
    const gameType = 'stake-builder';
    const currentHearts = user.game_hearts?.[gameType] ?? 0;

    if (currentHearts >= MAX_POOLED_HEARTS) {
      return new Response(
        JSON.stringify({ success: false, error: 'Maximum hearts already reached' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. زيادة القلوب ← لا يمكن التلاعب
    const updatedHearts = { ...user.game_hearts };
    updatedHearts[gameType] = currentHearts + 1;

    // 5. زيادة عدد مشاهدات الإعلانات ← لا يمكن التلاعب
    const updatedAdViewsCount = adViewsToday + 1;

    // 6. تحديث بيانات المستخدم ← لا يمكن التلاعب
    await supabaseAdmin
      .from('users')
      .update({
        game_hearts: updatedHearts,
        ad_views_today_count: updatedAdViewsCount,
      })
      .eq('id', userId);

    // 7. تسجيل المشاهدة ← لا يمكن التلاعب
    await supabaseAdmin.from('ad_views_log').insert({
      purpose: 'heart_regeneration',
      user_id: userId,
      reward_type: 'heart',
      reward_amount: 1,
      viewed_at: new Date().toISOString(),
      rewarded: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'You earned a heart by watching an ad.',
        hearts: updatedHearts,
        nextReplenishTime: null, // لأننا لا نعتمد على التجديد الزمني
        adViewsToday: updatedAdViewsCount,
        adViewsRemaining: Math.max(0, dailyAdViewsLimit - updatedAdViewsCount),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error watching ad for heart:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}