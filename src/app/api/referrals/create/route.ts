import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referrer_id, referred_id } = body;

    // 1. التحقق من صحة المدخلات
    if (!referrer_id || !referred_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing referrer_id or referred_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (referrer_id === referred_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'A user cannot refer themselves' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. التحقق مما إذا كانت الإحالة موجودة بالفعل
    const { data: existingReferral, error: referralError } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('referrer_id', referrer_id)
      .eq('referred_id', referred_id)
      .single();

    if (existingReferral) {
      return new Response(
        JSON.stringify({ success: false, error: 'Referral already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. جلب بيانات المحيل ← لا يمكن التلاعب
    const { data: referrer, error: fetchReferrerError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', referrer_id)
      .single();

    if (fetchReferrerError) throw fetchReferrerError;

    // 4. إضافة المكافآت للمحيل ← لا يمكن التلاعب
    const updatedGold = referrer.gold_points + 200;
    const updatedSpins = referrer.bonus_spins_available + 1;

    // 5. تحديث رصيد المحيل ← لا يمكن التلاعب
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        bonus_spins_available: updatedSpins,
        referrals_made: referrer.referrals_made + 1, // زيادة عدد الإحالات
      })
      .eq('id', referrer_id);

    if (updateUserError) throw updateUserError;

    // 6. تسجيل الإحالة ← لا يمكن التلاعب
    const { error: insertReferralError } = await supabaseAdmin
      .from('referrals')
      .insert({
        referrer_id: referrer_id,
        referred_id: referred_id,
        status: 'inactive',
        ad_views_count: 0,
        rewards_collected: false,
      });

    if (insertReferralError) throw insertReferralError;

    // 7. إرجاع استجابة ناجحة
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Referral created successfully',
        referrerGoldPoints: updatedGold,
        referrerBonusSpins: updatedSpins,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Referral creation error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}