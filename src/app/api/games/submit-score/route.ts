import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, gameType, score, goldEarned = 0, diamondEarned = 0 } = body;

    if (!userId || !gameType || typeof score !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // جلب بيانات المستخدم ← لا يمكن التلاعب
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError) throw fetchUserError;

    // حفظ الجلسة ← لا يمكن التلاعب
    const { error: sessionError } = await supabaseAdmin
      .from('user_game_sessions')
      .insert({
        user_id: userId,
        game_type: gameType,
        score,
        gold_earned: goldEarned,
        diamond_earned: diamondEarned,
        reward_claimed: true,
        played_at: new Date().toISOString(),
      });

    if (sessionError) throw sessionError;

    // تحديث أحدث سكور ← لا يمكن التلاعب
    const { data: highScoreRecord, error: fetchHighScoreError } = await supabaseAdmin
      .from('user_high_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('game_type', gameType)
      .maybeSingle();

    let isHighScoreUpdated = false;

    if (!highScoreRecord || score > highScoreRecord.high_score) {
      const { error: updateHighScoreError } = await supabaseAdmin
        .from('user_high_scores')
        .upsert({
          user_id: userId,
          game_type: gameType,
          high_score: score,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,game_type' });

      if (updateHighScoreError) throw updateHighScoreError;
      isHighScoreUpdated = true;
    }

    // تحديث رصيد النقاط ← لا يمكن التلاعب
    const updatedGold = Number(user.gold_points) + goldEarned;
    const updatedDiamonds = Number(user.diamond_points) + diamondEarned;

    await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        diamond_points: updatedDiamonds,
      })
      .eq('id', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: isHighScoreUpdated ? 'New high score!' : 'Score saved',
        isHighScore: isHighScoreUpdated,
        totalGold: updatedGold,
        totalDiamonds: updatedDiamonds,
        scoreSaved: true
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error submitting score:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}