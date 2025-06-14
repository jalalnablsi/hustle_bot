import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const gameType = req.nextUrl.searchParams.get('gameType');

    if (!userId || !gameType) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId or gameType' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: highScoreRecord, error } = await supabaseAdmin
      .from('user_high_scores')
      .select('high_score')
      .eq('user_id', userId)
      .eq('game_type', gameType)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        highScore: highScoreRecord?.high_score || 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching high score:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}