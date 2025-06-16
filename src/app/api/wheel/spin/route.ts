
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Prize configuration: Original Index must match the frontend's display order.
// Target Probabilities:
// - 3 Diamonds (originalIndex 7): 0.05%
// - Try Again (originalIndex 3): 50%
// - All Gold (0, 2, 4, 6): ~30% total
// - 1 & 2 Diamonds (originalIndex 5 & 1): ~18% total
// - Remaining ~1.95% to be distributed (or adjust others slightly)

const WHEEL_PRIZES_WITH_WEIGHTS = [
  // originalIndex 0: 50 Gold (Part of ~30% for Gold)
  { prize: { type: 'gold', value: 50 }, weight: 750, originalIndex: 0 },  // Approx 7.5%

  // originalIndex 1: 2 Diamonds (Part of ~18% for 1D/2D)
  { prize: { type: 'diamond', value: 2 }, weight: 900, originalIndex: 1 }, // Approx 9%

  // originalIndex 2: 100 Gold (Part of ~30% for Gold)
  { prize: { type: 'gold', value: 100 }, weight: 1000, originalIndex: 2 }, // Approx 10%

  // originalIndex 3: Try Again (Target: 50%)
  { prize: { type: 'nothing', value: 0 }, weight: 5000, originalIndex: 3 },// 50%

  // originalIndex 4: 25 Gold (Part of ~30% for Gold)
  { prize: { type: 'gold', value: 25 }, weight: 500, originalIndex: 4 },   // Approx 5%

  // originalIndex 5: 1 Diamond (Part of ~18% for 1D/2D)
  { prize: { type: 'diamond', value: 1 }, weight: 900, originalIndex: 5 }, // Approx 9%

  // originalIndex 6: 75 Gold (Part of ~30% for Gold)
  { prize: { type: 'gold', value: 75 }, weight: 750, originalIndex: 6 },   // Approx 7.5%

  // originalIndex 7: 3 Diamonds (Target: 0.05%)
  { prize: { type: 'diamond', value: 3 }, weight: 5, originalIndex: 7 },    // 0.05%
];
// Total Gold Weight: 750+1000+500+750 = 3000 (target ~3000 for 30%)
// Total 1D/2D Weight: 900+900 = 1800 (target ~1800 for 18%)
// Total Weight: 3000 (Gold) + 1800 (1D/2D) + 5 (3D) + 5000 (Nothing) = 9805.
// This means roughly:
// Gold: 3000/9805 = ~30.6%
// 1D/2D: 1800/9805 = ~18.35%
// 3D: 5/9805 = ~0.05%
// Nothing: 5000/9805 = ~51% (Slightly higher than 50%, can adjust others down if strict 50% is needed)

function selectWeightedPrize(): { prize: { type: string; value: number }; originalIndex: number } {
  const totalWeight = WHEEL_PRIZES_WITH_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  let randomNum = Math.random() * totalWeight;

  for (const weightedPrize of WHEEL_PRIZES_WITH_WEIGHTS) {
    if (randomNum < weightedPrize.weight) {
      return weightedPrize;
    }
    randomNum -= weightedPrize.weight;
  }
  // Fallback, should ideally not be reached if weights are positive and sum correctly
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
    let spinsToUse = 0; // This variable is not actually used to decrement spins; spin consumption is handled below.

    const canUseInitialFreeSpin = !initialFreeSpinUsed;
    const canUseBonusSpin = bonusSpins > 0;

    if (!canUseInitialFreeSpin && !canUseBonusSpin) {
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
    let spinTypeUsed : 'initial_free' | 'bonus' = 'bonus'; // default

    if (canUseInitialFreeSpin) {
        updatedInitialFreeSpinUsed = true; 
        spinTypeUsed = 'initial_free';
    } else if (canUseBonusSpin) {
        updatedBonusSpins = bonusSpins - 1;
        spinTypeUsed = 'bonus';
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
        // Potentially revert client-side changes if this fails, though client already optimistic.
        // For now, just throw to return 500.
        throw updateError;
    }

    // Log the spin
    await supabaseAdmin.from('wheel_spins_log').insert({
      user_id: userId,
      prize_won_type: selectedPrizeDetails.type,
      prize_won_value: selectedPrizeDetails.value,
      spun_at: new Date().toISOString(),
      spin_type: spinTypeUsed,
    });
    
    // Calculate remaining spins for client display
    const remainingSpinsForClient = (!updatedInitialFreeSpinUsed ? 1 : 0) + updatedBonusSpins;

    return new Response(
      JSON.stringify({
        success: true,
        prizeIndex: winningPrizeOriginalIndex, 
        prizeType: selectedPrizeDetails.type,
        prizeValue: selectedPrizeDetails.value,
        goldPoints: updatedGold,
        diamondPoints: updatedDiamonds,
        spinsLeft: remainingSpinsForClient, 
        initialFreeSpinUsedNow: canUseInitialFreeSpin // To inform client if the just-used spin was the initial free one
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
    