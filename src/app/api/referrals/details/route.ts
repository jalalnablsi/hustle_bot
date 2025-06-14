import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const referrer_id = req.nextUrl.searchParams.get('referrer_id');

    if (!referrer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing referrer_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Fetch referrals data with specific relationship name
    const { data: referrals, error: fetchReferralsError } = await supabaseAdmin
      .from('referrals')
      .select(`
        id,
        referred_id,
        status,
        last_rewarded_gold,
        last_rewarded_diamond,
        ad_views_count,
        created_at,

        users:referrals_referred_id_fkey (
          first_name,
          last_name,
          username,
          gold_points,
          diamond_points,
          created_at
        )
      `)
      .eq('referrer_id', referrer_id);

    if (fetchReferralsError) {
      console.error('Supabase error:', fetchReferralsError.message);
      throw new Error(fetchReferralsError.message || 'Database query failed.');
    }

    // Step 2: Format the referral data
    const formattedReferrals = referrals.map((referral) => ({
      id: referral.id,
      name: `${referral.users?.first_name || ''} ${referral.users?.last_name || ''}`.trim() || 'No Name',
      username: referral.users?.username || 'No username',
      joined: referral.users?.created_at?.split('T')[0] || 'Unknown date',
      status: referral.status || 'inactive',
      ad_views_count: referral.ad_views_count || 0,
      earningsFrom: referral.users?.gold_points || 0,
      last_rewarded_gold: referral.last_rewarded_gold || 0,
      last_rewarded_diamond: referral.last_rewarded_diamond || 0,
    }));

    // Step 3: Return the response
    return new Response(
      JSON.stringify({
        success: true,
        referrals: formattedReferrals,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching referral details:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}