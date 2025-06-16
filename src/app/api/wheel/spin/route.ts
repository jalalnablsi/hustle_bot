
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Configuration for the prizes and their weights for weighted random selection
// originalIndex must correspond to the order of prizes in FRONTEND `BACKEND_WHEEL_PRIZES_CONFIG_FOR_PAGE`
const WHEEL_PRIZES_WITH_WEIGHTS = [
  // originalIndex 0: 50 Gold
  { prize: { type: 'gold', value: 50 }, weight: 750, originalIndex: 0 }, // 7.5% / ~98.05% pool
  // originalIndex 1: 3 Diamond (User requested 0.05%)
  { prize: { type: 'diamond', value: 3 }, weight: 5, originalIndex: 1 },   // 0.05%
  // originalIndex 2: 100 Gold
  { prize: { type: 'gold', value: 100 }, weight: 1000, originalIndex: 2 },// 10% / ~98.05% pool
  // originalIndex 3: Try Again (Nothing) (User requested 50%)
  { prize: { type: 'nothing', value: 0 }, weight: 5000, originalIndex: 3 }, // 50%
  // originalIndex 4: 25 Gold
  { prize: { type: 'gold', value: 25 }, weight: 500, originalIndex: 4 },  // 5% / ~98.05% pool
  // originalIndex 5: 1 Diamond
  { prize: { type: 'diamond', value: 1 }, weight: 1000, originalIndex: 5 }, // 10% / ~98.05% pool
  // originalIndex 6: 75 Gold
  { prize: { type: 'gold', value: 75 }, weight: 750, originalIndex: 6 },  // 7.5% / ~98.05% pool
  // originalIndex 7: 2 Diamonds
  { prize: { type: 'diamond', value: 2 }, weight: 800, originalIndex: 7 }, // 8% / ~98.05% pool
];
// Total weight approx 9805 (98.05%), which is fine for proportional selection.

function selectWeightedPrize(): { prize: { type: string; value: number }; originalIndex: number } {
  const totalWeight = WHEEL_PRIZES_WITH_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  let randomNum = Math.random() * totalWeight;

  for (const weightedPrize of WHEEL_PRIZES_WITH_WEIGHTS) {
    if (randomNum < weightedPrize.weight) {
      return weightedPrize;
    }
    randomNum -= weightedPrize.weight;
  }
  // Fallback, should ideally not be reached if weights are positive
  return WHEEL_PRIZES_WITH_WEIGHTS[WHEEL_PRIZES_WITH_WEIGHTS.length - 1];
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing user ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError || !user) {
      console.error("Wheel spin: User fetch error or user not found.", fetchUserError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found or database error.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const initialFreeSpinUsed = user.initial_free_spin_used ?? false;
    const bonusSpins = user.bonus_spins_available ?? 0;
    let spinsToUse = 0;

    if (!initialFreeSpinUsed) {
      spinsToUse = 1; // This is the free initial spin
    } else if (bonusSpins > 0) {
      spinsToUse = 1; // This is a bonus spin
    }

    if (spinsToUse <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No spins available' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { prize: selectedPrizeDetails, originalIndex: winningPrizeOriginalIndex } = selectWeightedPrize();

    let updatedGold = Number(user.gold_points);
    let updatedDiamonds = Number(user.diamond_points);

    if (selectedPrizeDetails.type === 'gold') {
      updatedGold += selectedPrizeDetails.value;
    } else if (selectedPrizeDetails.type === 'diamond') {
      updatedDiamonds += selectedPrizeDetails.value;
    }

    let updatedBonusSpins = bonusSpins;
    let updatedInitialFreeSpinUsed = initialFreeSpinUsed;

    if (!initialFreeSpinUsed) {
        updatedInitialFreeSpinUsed = true; 
        // The "free" spin doesn't consume a "bonus_spin_available"
    } else if (bonusSpins > 0) {
        updatedBonusSpins = bonusSpins - 1;
    }


    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        diamond_points: updatedDiamonds,
        bonus_spins_available: updatedBonusSpins,
        initial_free_spin_used: updatedInitialFreeSpinUsed,
      })
      .eq('id', userId);

    if (updateError) {
        console.error("Wheel spin: User update error.", updateError);
        throw updateError;
    }

    await supabaseAdmin.from('wheel_spins_log').insert({
      user_id: userId,
      prize_won_type: selectedPrizeDetails.type,
      prize_won_value: selectedPrizeDetails.value,
      spun_at: new Date().toISOString(),
      spin_type: !initialFreeSpinUsed ? 'initial_free' : 'bonus', // Or 'ad' if ad spins are distinct
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        prizeIndex: winningPrizeOriginalIndex, 
        prizeType: selectedPrizeDetails.type,
        prizeValue: selectedPrizeDetails.value,
        goldPoints: updatedGold,
        diamondPoints: updatedDiamonds,
        spinsLeft: updatedBonusSpins + (!updatedInitialFreeSpinUsed ? 1: 0), // Reflect total available for next time
        initialFreeSpinUsedNow: !initialFreeSpinUsed // To inform client if the just-used spin was the initial free one
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Wheel spin error:', error.message, error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error while spinning wheel.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
    