import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const tgUserStr = req.cookies.get('tgUser')?.value;
    
    if (!tgUserStr) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telegram ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tgUser = JSON.parse(tgUserStr);
    const telegramId = tgUser.id.toString();

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const gameHearts = user.game_hearts || {};
    const nextReplenishTime = user.last_heart_replenished;

    // حساب الوقت المتبقي حتى التجديد
    let nextHeartAvailableIn = null;
    if (nextReplenishTime) {
      const now = new Date();
      const replenishDate = new Date(nextReplenishTime);
      const diffMs = replenishDate.getTime() - now.getTime();
      if (diffMs > 0) {
        nextHeartAvailableIn = Math.floor(diffMs / 1000); // بالثواني
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        hearts: gameHearts,
        nextReplenishTime: nextHeartAvailableIn ? new Date(now.getTime() + nextHeartAvailableIn * 1000).toISOString() : null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching hearts:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}