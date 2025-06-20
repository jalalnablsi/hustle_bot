
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const tgUserStr = req.cookies.get('tgUser')?.value;
    let currentUserId: string | null = null;

    if (tgUserStr) {
      try {
        const tgUser = JSON.parse(tgUserStr);
        if (tgUser.id) {
          currentUserId = tgUser.id.toString();
        }
      } catch (e) {
        console.warn("Could not parse tgUser cookie in leaderboard API:", e);
      }
    }
    
    const GAME_TYPE_IDENTIFIER = 'stake-builder';

    const [highScoresData, topGoldUsers, activeReferrals] = await Promise.all([
      supabaseAdmin
        .from('user_high_scores')
        .select(`
          user_id,
          high_score,
          users!inner (
            username,
            telegram_id,
            photo_url
          )
        `)
        .eq('game_type', GAME_TYPE_IDENTIFIER)
        .order('high_score', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('users')
        .select('id, username, gold_points, telegram_id, photo_url')
        .gt('gold_points', 0)
        .order('gold_points', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('referrals')
        .select('referrer_id')
        .eq('status', 'active')
    ]);

    if (highScoresData.error) throw highScoresData.error;
    if (topGoldUsers.error) throw topGoldUsers.error;
    if (activeReferrals.error) throw activeReferrals.error;

    const referralCounts: Record<string, number> = {};
    activeReferrals.data.forEach(referral => {
      referralCounts[referral.referrer_id] = (referralCounts[referral.referrer_id] || 0) + 1;
    });
    
    const { data: referralUsers, error: referralUsersError } = await supabaseAdmin
        .from('users')
        .select('id, username, photo_url')
        .in('id', Object.keys(referralCounts));

    if (referralUsersError) throw referralUsersError;

    const referralUsersMap = new Map(referralUsers.map(u => [u.id, { username: u.username, photo_url: u.photo_url }]));

    const referralArray = Object.entries(referralCounts).map(([id, count]) => ({
      id,
      count,
      username: referralUsersMap.get(id)?.username || `User ${id.slice(-4)}`,
      photo_url: referralUsersMap.get(id)?.photo_url
    })).sort((a, b) => b.count - a.count).slice(0, 100);

    let userRankData = null;
    if (currentUserId) {
        const { data: currentUserData, error: fetchCurrentUserError } = await supabaseAdmin
          .from('users')
          .select('id, gold_points, referrals_made')
          .eq('id', currentUserId)
          .single();
        
        if (currentUserData && !fetchCurrentUserError) {
             const calculateRank = async (table: string, column: string, value: number, extra_filters?: any) => {
                const { count, error } = await supabaseAdmin
                  .from(table)
                  .select('*', { count: 'exact', head: true })
                  .gt(column, value)
                  .match(extra_filters || {});
                if (error) { console.warn(`Rank calculation error for ${table}:`, error); return null; }
                return count !== null ? count + 1 : null;
            };
            
            const userScoreRes = await supabaseAdmin
              .from('user_high_scores')
              .select('high_score')
              .eq('user_id', currentUserId)
              .eq('game_type', GAME_TYPE_IDENTIFIER)
              .maybeSingle();

            const userHighScore = userScoreRes?.data?.high_score || 0;
            
            const [userGoldRank, userScoreRank] = await Promise.all([
                calculateRank('users', 'gold_points', currentUserData.gold_points || 0),
                calculateRank('user_high_scores', 'high_score', userHighScore, { game_type: GAME_TYPE_IDENTIFIER })
            ]);
            
            // Referral rank is simpler: just find index in sorted array.
            const userReferralRank = referralArray.findIndex(r => r.id === currentUserId) + 1;

            userRankData = {
                gold: userGoldRank,
                referrals: userReferralRank > 0 ? userReferralRank : null,
                scores: userScoreRank,
                scoreValue: userHighScore,
            };
        }
    }

    return NextResponse.json({
        success: true,
        data: {
          top_scores: highScoresData.data.map((entry: any, index: number) => ({
            rank: index + 1,
            username: entry.users?.username || `Player ${entry.user_id.slice(-4)}`,
            points: entry.high_score,
            avatarUrl: entry.users?.photo_url,
          })),
          top_gold: topGoldUsers.data.map((user: any, index: number) => ({
            rank: index + 1,
            username: user.username || `User ${user.telegram_id.slice(-4)}`,
            points: Number(user.gold_points).toFixed(0),
            avatarUrl: user.photo_url,
          })),
          top_referrals: referralArray.map((referral, index) => ({
            rank: index + 1,
            username: referral.username,
            points: referral.count,
            avatarUrl: referral.photo_url,
          })),
          user_rank: userRankData,
        },
      });

  } catch (error: any) {
    console.error('Error fetching leaderboard:', error.message, error.stack);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
