import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, taskId } = body;

    if (!userId || !taskId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId or taskId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: التحقق مما إذا تم إكمال المهمة من قبل ← لا يمكن التلاعب
    const { data: existingTask, error: fetchError } = await supabaseAdmin
      .from('user_completed_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingTask) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'You have already completed this task.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: جلب بيانات المهمة ← لا يمكن التلاعب
    const { data: task, error: fetchTaskError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchTaskError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Task not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: تسجيل إتمام المهمة ← لا يمكن التلاعب
    await supabaseAdmin.from('user_completed_tasks').insert({
      user_id: userId,
      task_id: taskId,
      times_completed: 1,
    });

    // Step 4: تحديث رصيد المستخدم ← لا يمكن التلاعب
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchUserError) throw fetchUserError;

    let updatedGold = user.gold_points;
    let updatedDiamonds = user.diamond_points;

    if (task.reward_type === 'gold') {
      updatedGold += Number(task.reward_amount);
    } else if (task.reward_type === 'diamond') {
      updatedDiamonds += Number(task.reward_amount);
    }

    await supabaseAdmin
      .from('users')
      .update({
        gold_points: updatedGold,
        diamond_points: updatedDiamonds,
      })
      .eq('id', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Task completed successfully!',
        reward: task.reward_amount,
        rewardType: task.reward_type,
        totalGold: updatedGold,
        totalDiamonds: updatedDiamonds,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error completing task:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}