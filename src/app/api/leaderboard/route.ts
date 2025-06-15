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
    const currentTelegramId = tgUser.id.toString();

    // 1. الحصول على بيانات المستخدم ← لا يمكن التلاعب
    const { data: currentUserData, error: fetchCurrentUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', currentTelegramId)
      .single();

    if (fetchCurrentUserError || !currentUserData) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const currentUserId = currentUserData.id;
    const GAME_TYPE_IDENTIFIER = 'stake-builder';

    // 2. جلب أعلى سكور ← لا يمكن التلاعب
    const { data: highScoresData, error: scoreError } = await supabaseAdmin
      .from('user_high_scores')
      .select(`
        user_id,
        high_score,
        users!inner (
          username,
          telegram_id
        )
      `)
      .eq('game_type', GAME_TYPE_IDENTIFIER)
      .order('high_score', { ascending: false })
      .limit(100);

    if (scoreError) throw scoreError;

    // 3. جلب أعلى رصيد ذهب ← لا يمكن التلاعب
    const { data: topGoldUsers, error: goldError } = await supabaseAdmin
      .from('users')
      .select('id, username, gold_points, telegram_id')
      .gt('gold_points', 0)
      .order('gold_points', { ascending: false })
      .limit(100);

    if (goldError) throw goldError;

    // 4. جلب أعلى إحالات نشطة ← لا يمكن التلاعب
    const { data: activeReferrals, error: referralsError } = await supabaseAdmin
      .from('referrals')
      .select('referrer_id')
      .eq('status', 'active');

    if (referralsError) throw referralsError;

    // 5. حساب عدد الإحالات لكل مستخدم ← لا يمكن التلاعب
    const referralCounts: Record<string, number> = {};
    activeReferrals.forEach(referral => {
      referralCounts[referral.referrer_id] = (referralCounts[referral.referrer_id] || 0) + 1;
    });

    // تحويل إلى مصفوفة ← لا يمكن التلاعب
    const referralArray = Object.entries(referralCounts).map(([id, count]) => ({
      id,
      count,
      username: topGoldUsers.find(u => u.id === id)?.username || `User ${id.slice(-4)}`,
    }));

    // ترتيب الإحالات ← لا يمكن التلاعب
    referralArray.sort((a, b) => b.count - a.count).splice(100);

    // 6. حساب رتبة المستخدم ← لا يمكن التلاعب
    const calculateRank = async (table: string, column: string, value: number) => {
      const { count } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .gt(column, value);

      return count ? count + 1 : 1;
    };

    const userScoreRes = await supabaseAdmin
      .from('user_high_scores')
      .select('high_score')
      .eq('user_id', currentUserId)
      .eq('game_type', GAME_TYPE_IDENTIFIER)
      .maybeSingle();

    const userHighScore = userScoreRes.data?.high_score || 0;

    const userGoldRank = await calculateRank('users', 'gold_points', currentUserData.gold_points);
    const userReferralRank = await calculateRank('referrals', 'referrer_id', currentUserId);

    const userScoreRank = await calculateRank('user_high_scores', 'high_score', userHighScore);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          top_scores: highScoresData.map((entry, index) => ({
            rank: index + 1,
            username: entry.users?.username || `Player ${entry.user_id.slice(-4)}`,
            points: entry.high_score,
          })),
          top_gold: topGoldUsers.map((user, index) => ({
            rank: index + 1,
            username: user.username || `User ${user.telegram_id.slice(-4)}`,
            points: Number(user.gold_points).toFixed(0),
          })),
          top_referrals: referralArray.map((referral, index) => ({
            rank: index + 1,
            username: referral.username,
            points: referral.count,
          })),
          user_rank: {
            gold: userGoldRank,
            referrals: userReferralRank,
            scores: userScoreRank,
            scoreValue: userHighScore,
          },
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