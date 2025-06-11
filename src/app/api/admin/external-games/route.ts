
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminToken } from '@/lib/jwtAdmin';
import { z } from 'zod';
import type { ExternalGame } from '@/types';

// Zod schema for external game creation
const externalGameSchema = z.object({
  title: z.string().min(3).max(100),
  iframe_url: z.string().url(),
  thumbnail_url: z.string().url(),
  category: z.string().min(3).max(50),
  tags: z.array(z.string().max(30)).optional().default([]),
  description: z.string().min(10).max(1000).optional().nullable(),
  instructions: z.string().min(10).max(1000).optional().nullable(),
  data_ai_hint: z.string().max(50).optional().nullable(),
  is_active: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
  }
  const token = authHeader.split(' ')[1];
  const adminPayload = verifyAdminToken(token);

  if (!adminPayload) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validationResult = externalGameSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ success: false, error: 'Invalid game data', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const newGameDataFromForm = validationResult.data;
    
    const gameToInsert: Omit<ExternalGame, 'id' | 'created_at'> & {created_by: string} = {
        ...newGameDataFromForm,
        tags: newGameDataFromForm.tags?.length ? newGameDataFromForm.tags : undefined, // Ensure tags is array or undefined
        description: newGameDataFromForm.description || undefined,
        instructions: newGameDataFromForm.instructions || undefined,
        data_ai_hint: newGameDataFromForm.data_ai_hint || undefined,
        created_by: adminPayload.id, // Add admin ID who created the game
    };


    const { data: createdGame, error: insertError } = await supabaseAdmin
      .from('external_games') // Assumes 'external_games' table exists
      .insert(gameToInsert)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating external game:', insertError);
      return NextResponse.json({ success: false, error: 'Failed to create external game', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, game: createdGame, message: 'External game created successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Server error creating external game:', error);
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// TODO: Implement GET for listing games, PUT for updating, DELETE for removing
// For now, only POST is implemented.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
  }
  const token = authHeader.split(' ')[1];
  const adminPayload = verifyAdminToken(token);

  if (!adminPayload) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
  }

  try {
    const { data: games, error } = await supabaseAdmin
      .from('external_games')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching external games:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch external games', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, games: games || [] });
  } catch (error: any) {
    console.error('Server error fetching external games:', error);
    return NextResponse.json({ success: false, error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
