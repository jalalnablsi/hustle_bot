import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, diamondsToSpend } = body;

    if (!userId || typeof diamondsToSpend !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: جلب بيانات المستخدم ← لا يمكن التلاعب
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError) throw fetchUserError;

    if (user.diamond_points < diamondsToSpend) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not enough diamonds.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: خصم الجواهر ← لا يمكن التلاعب
    const newDiamondBalance = Number(user.diamond_points) - diamondsToSpend;

    await supabaseAdmin
      .from('users')
      .update({ diamond_points: newDiamondBalance })
      .eq('id', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Diamonds spent successfully.',
        newDiamondBalance,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error spending diamonds:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}