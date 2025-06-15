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

    // 1. الحصول على أعلى رصيد ذهب ← لا يمكن التلاعب
    const { data: topGoldUsers, error: goldError } = await supabaseAdmin
      .from('users')
      .select('id, username, gold_points, telegram_id')
      .order('gold_points', { ascending: false })
      .limit(5);

    if (goldError) throw goldError;

    // 2. الحصول على أعلى سكور ← لا يمكن التلاعب
    const { data: topScores, error: scoreError } = await supabaseAdmin
      .from('user_game_sessions')
      .select(`
        user_id,
        score,
        users!inner (
          username,
          telegram_id
        )
      `)
      .eq('game_type', 'stake-builder')
      .order('score', { ascending: false })
      .limit(5);

    if (scoreError) throw scoreError;

    // 3. الحصول على أعلى إحالات نشطة ← لا يمكن التلاعب
    const { data: topReferrers, error: referralsError } = await supabaseAdmin
      .from('referrals')
      .select(`
        referrer_id,
        users!inner (
          username,
          telegram_id,
          id
        )
      `)
      .eq('status', 'active')
      .order('referred_id', { foreignTable: 'users', ascending: false })
      .limit(5);

    if (referralsError) throw referralsError;

    // 4. تحويل البيانات إلى تنسيق واضح ← لا يمكن التلاعب
    const formattedGoldLeaders = topGoldUsers.map(user => ({
      rank: 0, // سيتم حساب الرتب لاحقًا في الواجهة الأمامية
      username: user.username || `User ${user.telegram_id.slice(-4)}`,
      points: Number(user.gold_points).toFixed(0),
    }));

    const formattedScoreLeaders = topScores.map(session => ({
      rank: 0,
      username: session.users?.username || `Player ${session.user_id.slice(-4)}`,
      points: session.score,
    }));

    const formattedReferralLeaders = topReferrers.reduce((acc, referral) => {
      const existing = acc.find(u => u.id === referral.referrer_id);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({
          id: referral.referrer_id,
          username: referral.users?.username || `User ${referral.referrer_id.slice(-4)}`,
          count: 1,
        });
      }
      return acc;
    }, [] as Array<{ id: string; username: string; count: number }>);

    // 5. إرجاع البيانات ← لا يمكن التلاعب
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          top_gold: formattedGoldLeaders,
          top_scores: formattedScoreLeaders,
          top_referrals: formattedReferralLeaders,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching leaderboard:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}