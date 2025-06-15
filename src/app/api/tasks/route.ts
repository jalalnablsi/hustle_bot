import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const tgUserStr = req.cookies.get('tgUser')?.value;

    if (!tgUserStr) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telegram ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tgUser = JSON.parse(tgUserStr);
    const telegramId = tgUser.id.toString();

    // 1. الحصول على بيانات المستخدم ← لا يمكن التلاعب
    const { data: user, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (fetchUserError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. جلب جميع المهام ← لا يمكن التلاعب
    const { data: tasks, error: fetchTasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('is_active', true);

    if (fetchTasksError) throw fetchTasksError;

    // 3. جلب المهام التي أكملها المستخدم ← لا يمكن التلاعب
    const { data: completedTasks, error: fetchCompletedTasksError } = await supabaseAdmin
      .from('user_completed_tasks')
      .select('task_id')
      .eq('user_id', user.id);

    if (fetchCompletedTasksError) throw fetchCompletedTasksError;

    const completedTaskIds = completedTasks.map(task => task.task_id);

    // 4. تنسيق المهام ← لا يمكن التلاعب
    const formattedTasks = tasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      reward: task.reward_amount,
      rewardCurrency: task.reward_type.toUpperCase(),
      actionText: task.input_placeholder,
      href: task.link,
      icon: task.platform === 'twitter' ? 'Twitter' : 
           task.platform === 'youtube' ? 'Youtube' :
           task.platform === 'discord' ? 'MessageSquare' :
           task.platform === 'telegram' ? 'Send' : 'Users',
      isCompleted: completedTaskIds.includes(task.id),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        tasks: formattedTasks,
        userId: user.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching tasks:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}