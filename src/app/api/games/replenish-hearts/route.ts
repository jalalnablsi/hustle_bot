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

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError) throw fetchUserError;

    const now = new Date();
    const lastReplenish = user.last_heart_replenished ? new Date(user.last_heart_replenished) : now;
    const gameHearts = user.game_hearts || {};

    // تجديد القلوب فقط إذا كان آخر تجديد مضى عليه أكثر من 3 ساعات
    if (now.getTime() - lastReplenish.getTime() >= 3 * 60 * 60 * 1000) {
      const updatedGameHearts = Object.entries(gameHearts).reduce((acc, [key, value]) => {
        acc[key] = Math.min(5, value + 1); // الحد الأقصى هو 5
        return acc;
      }, {} as Record<string, number>);

      await supabaseAdmin
        .from('users')
        .update({
          game_hearts: updatedGameHearts,
          last_heart_replenished: now.toISOString(),
        })
        .eq('id', userId);

      return new Response(
        JSON.stringify({
          success: true,
          hearts: updatedGameHearts,
          nextReplenish: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Not ready to replenish hearts yet.',
        nextReplenish: lastReplenish.toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error replenishing hearts:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}