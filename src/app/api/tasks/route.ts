
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const tgUserCookie = req.cookies.get('tgUser');

    if (!tgUserCookie || !tgUserCookie.value) {
      return NextResponse.json({ success: false, error: 'Authentication cookie not found.' }, { status: 401 });
    }
    
    let tgUser;
    try {
        tgUser = JSON.parse(tgUserCookie.value);
    } catch (e) {
        return NextResponse.json({ success: false, error: 'Invalid authentication cookie.' }, { status: 400 });
    }

    if (!tgUser || !tgUser.id) {
        return NextResponse.json({ success: false, error: 'Invalid user data in cookie.' }, { status: 400 });
    }
    
    const userId = tgUser.id;

    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (fetchUserError || !user) {
      console.error('API Tasks: User not found for ID:', userId, fetchUserError?.message);
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const { data: tasks, error: fetchTasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('is_active', true);

    if (fetchTasksError) {
      console.error('API Tasks: Error fetching tasks table:', fetchTasksError.message);
      throw fetchTasksError;
    }

    const { data: completedTasks, error: fetchCompletedTasksError } = await supabaseAdmin
      .from('user_completed_tasks')
      .select('task_id')
      .eq('user_id', user.id);

    if (fetchCompletedTasksError) {
      console.error('API Tasks: Error fetching completed tasks:', fetchCompletedTasksError.message);
      throw fetchCompletedTasksError;
    }

    const completedTaskIds = new Set(completedTasks.map(task => task.task_id));

    const formattedTasks = tasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      reward: task.reward_amount,
      rewardCurrency: task.reward_type?.toUpperCase() || 'GOLD',
      actionText: task.input_placeholder || 'Go to Task',
      href: task.link,
      platform: task.platform,
      requires_user_input: task.requires_user_input,
      input_placeholder: task.input_placeholder,
      isCompleted: completedTaskIds.has(task.id),
    }));

    return NextResponse.json({
        success: true,
        tasks: formattedTasks,
        userId: user.id,
    });

  } catch (error: any) {
    console.error('API Tasks: General error:', error.message, {stack: error.stack});
    return NextResponse.json({ success: false, error: 'Internal server error while fetching tasks.' }, { status: 500 });
  }
}

    
