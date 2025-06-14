import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, gameType } = body;

    if (!userId || !gameType) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId or gameType' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError) throw fetchUserError;

    // استخراج القلوب
    let gameHearts = user.game_hearts || {};
    const currentHeartCount = gameHearts[gameType] || 5;

    if (currentHeartCount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No hearts available for this game' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // تقليل قلب واحد
    gameHearts[gameType] = currentHeartCount - 1;

    // إذا لم يكن هناك وقت سابق، نبدأ التجديد الأول
    const lastReplenishTime = user.last_heart_replenished || new Date().toISOString();

    await supabaseAdmin
      .from('users')
      .update({
        game_hearts: gameHearts,
        last_heart_replenished: lastReplenishTime,
      })
      .eq('id', userId);

    return new Response(
      JSON.stringify({
        success: true,
        remainingHearts: gameHearts,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error using heart:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}