
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // 1. Fetch user data
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, ad_spins_used_today_count, daily_ad_views_limit, bonus_spins_available')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user for ad view reward:', fetchError);
      return NextResponse.json({ success: false, error: 'User not found or database error' }, { status: 404 });
    }

    if (!user) {
         return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const adsWatchedToday = user.ad_spins_used_today_count || 0;
    const dailyLimit = user.daily_ad_views_limit || 3; // Default from wheel page, ensure DB has similar default or is set

    // 2. Check ad view limit for spins
    if (adsWatchedToday >= dailyLimit) {
      return NextResponse.json({ success: false, error: `Ad limit for spins reached for today (${adsWatchedToday}/${dailyLimit})` }, { status: 429 });
    }

    // 3. Update user's spin counts
    const updatedBonusSpins = (user.bonus_spins_available || 0) + 1;
    const updatedAdsWatchedCount = adsWatchedToday + 1;

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        bonus_spins_available: updatedBonusSpins,
        ad_spins_used_today_count: updatedAdsWatchedCount,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user for ad view reward:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update user spin counts' }, { status: 500 });
    }

    // 4. Log the ad view for spin
    // Assuming 'ad_id' can be null if it's a generic "watch ad for spin" action not tied to a specific ad campaign.
    const { error: logError } = await supabaseAdmin
        .from('ad_views_log')
        .insert({
            user_id: userId,
            rewarded: true,
            reward_type: 'spin', // Specific reward type for this context
            reward_amount: 1,      // 1 spin awarded
            purpose: 'wheel_ad_for_spin', // Specific purpose
            viewed_at: new Date().toISOString(),
            // ad_id: null, // Can be null if not tied to a specific ad from 'ads' table
        });

    if (logError) {
        console.error('Error logging ad view for spin:', logError);
        // Non-critical, so we can still return success to the user for the spin
    }

    return NextResponse.json({ 
        success: true, 
        message: 'Ad viewed successfully, spin awarded.',
        spinsAvailable: updatedBonusSpins,
        adsWatchedToday: updatedAdsWatchedCount
    });

  } catch (error: any) {
    console.error('Error in /api/ads/view:', error);
    return NextResponse.json({ success: false, error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
