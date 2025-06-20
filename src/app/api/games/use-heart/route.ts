import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const GAME_TYPE_STAKE_BUILDER = 'stake-builder';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, gameType } = body;

    if (!userId || !gameType) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or gameType' },
        { status: 400 }
      );
    }

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('id, game_hearts, last_heart_replenished')
      .eq('id', userId)
      .single();

    if (fetchUserError || !user) {
        const errorMsg = fetchUserError ? fetchUserError.message : 'User not found.';
        console.error(`Use-heart error: Could not fetch user ${userId}.`, errorMsg);
        return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Safely access and parse game hearts
    let gameHearts = user.game_hearts && typeof user.game_hearts === 'object' ? { ...(user.game_hearts as Record<string, number>) } : {};
    const currentHeartCount = Number(gameHearts[gameType] || 0);

    if (currentHeartCount <= 0) {
      return NextResponse.json(
        { success: false, error: 'No hearts available for this game' },
        { status: 403 }
      );
    }

    // Decrement heart count
    gameHearts[gameType] = currentHeartCount - 1;

    // If this is the first time hearts are used, set the initial replenish timer
    const lastReplenishTime = user.last_heart_replenished || new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        game_hearts: gameHearts,
        last_heart_replenished: lastReplenishTime, // Ensure this is set on first use
      })
      .eq('id', userId);

    if (updateError) {
        console.error(`Use-heart error: Failed to update user ${userId} hearts.`, updateError);
        return NextResponse.json({ success: false, error: 'Failed to update user hearts.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        remainingHearts: gameHearts[gameType],
        gameHearts: gameHearts,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error in /api/games/use-heart:', error.message, { stack: error.stack });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
