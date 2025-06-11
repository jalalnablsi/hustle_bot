import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// 💰 الجوائز ← سيتم استبدالها لاحقًا بناءً على بيانات من الخادم
const WHEEL_PRIZES = [
  { type: 'gold', value: 50 },
  { type: 'diamond', value: 3 },
  { type: 'gold', value: 100 },
  { type: 'nothing', value: 0 },
  { type: 'gold', value: 25 },
  { type: 'diamond', value: 1 },
  { type: 'gold', value: 75 },
  { type: 'diamond', value: 2 },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing user ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. جلب بيانات المستخدم ← من الخادم ← لا يمكن التلاعب
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError) throw fetchUserError;

    // 2. التحقق مما إذا كان لديه Free Spin ← لا يمكن التلاعب
    if (user.bonus_spins_available <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No spins available' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 3. اختيار الجائزة ← من الخادم ← لا يمكن التلاعب
    const prizeIndex = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const prize = WHEEL_PRIZES[prizeIndex];

    let updatedGold = user.gold_points;
    let updatedDiamonds = user.diamond_points;

    if (prize.type === 'gold') {
      updatedGold += prize.value;
    } else if (prize.type === 'diamond') {
      updatedDiamonds += prize.value;
    }

    // 4. خصم دورة واحدة ← من الخادم ← لا يمكن التلاعب
    const updatedSpins = user.bonus_spins_available - 1;

    // 5. تحديث رصيد المستخدم ← من الخادم ← لا يمكن التلاعب
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        diamond_points: updatedDiamonds,
        bonus_spins_available: updatedSpins,
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 6. تسجيل الدورة ← من الخادم ← لا يمكن التلاعب
    await supabaseAdmin.from('wheel_spins_log').insert({
      user_id: userId,
      prize_won_type: prize.type,
      prize_won_value: prize.value,
      spun_at: new Date().toISOString(),
      spin_type: 'ad',
    });

    // ✅ الآن ← نُرجع `prizeIndex` ← ليتم استخدامه في الصفحة
    return new Response(
      JSON.stringify({
        success: true,
        prizeIndex: prizeIndex, // ✅ تم إضافته ← مهم للواجهة الأمامية
        prizeType: prize.type,
        prizeValue: prize.value,
        goldPoints: updatedGold,
        diamondPoints: updatedDiamonds,
        spinsLeft: updatedSpins,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Wheel spin error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}