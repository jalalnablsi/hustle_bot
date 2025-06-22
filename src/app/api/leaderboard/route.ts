
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const GAME_TYPE_IDENTIFIER = 'stake-builder';

    // Fetch top 100 users based on high scores for 'stake-builder'
    const { data: highScoresData, error: highScoresError } = await supabaseAdmin
      .from('user_high_scores')
      .select(`
        user_id,
        high_score,
        users (
          username,
          telegram_id,
        )
      `)
      .eq('game_type', GAME_TYPE_IDENTIFIER)
      .order('high_score', { ascending: false })
      .limit(100);

    if (highScoresError) {
      console.error('Error fetching high scores:', highScoresError.message);
      // We don't throw an error here, we can return partial data if other queries succeed
    }

    // Fetch top 100 users based on gold points
    const { data: topGoldUsers, error: topGoldError } = await supabaseAdmin
      .from('users')
      .select('id, username, gold_points, telegram_id, photo_url')
      .gt('gold_points', 0)
      .order('gold_points', { ascending: false })
      .limit(100);

    if (topGoldError) {
      console.error('Error fetching top gold users:', topGoldError.message);
    }

    // Fetch top 100 users based on referrals made
    const { data: topReferralUsers, error: topReferralError } = await supabaseAdmin
      .from('users')
      .select('id, username, referrals_made, photo_url, telegram_id')
      .gt('referrals_made', 0)
      .order('referrals_made', { ascending: false })
      .limit(100);

    if (topReferralError) {
      console.error('Error fetching top referral users:', topReferralError.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        top_scores: (highScoresData || []).map((entry: any, index: number) => ({
          rank: index + 1,
          username: entry.users?.username || `Player ${entry.user_id.slice(-4)}`,
          points: entry.high_score,
          avatarUrl: entry.users?.photo_url,
        })),
        top_gold: (topGoldUsers || []).map((user: any, index: number) => ({
          rank: index + 1,
          username: user.username || `User ${user.telegram_id?.slice(-4)}`,
          points: Number(user.gold_points).toFixed(0),
          avatarUrl: user.photo_url,
        })),
        top_referrals: (topReferralUsers || []).map((user: any, index: number) => ({
            rank: index + 1,
            username: user.username || `User ${user.telegram_id?.slice(-4)}`,
            points: user.referrals_made,
            avatarUrl: user.photo_url,
        })),
      },
    });

  } catch (error: any) {
    console.error('Error fetching leaderboard:', error.message, error.stack);
    return NextResponse.json({ success: false, error: 'Internal server error while fetching leaderboard.' }, { status: 500 });
  }
}
