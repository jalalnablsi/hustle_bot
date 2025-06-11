
'use client';

import { useState } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { TaskItem, type Task } from "@/components/tasks/TaskItem";
import { Twitter, Send, Youtube, Users, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const initialTasks: Task[] = [
  { id: '1', title: "Follow on X (Twitter)", description: "Follow our official X account for updates.", reward: 100, rewardCurrency: 'GOLD', actionText: "Follow @HustleSoul", href: "https://twitter.com/example", icon: Twitter, isCompleted: false },
  { id: '2', title: "Join Telegram Channel", description: "Join our Telegram channel for announcements.", reward: 100, rewardCurrency: 'GOLD', actionText: "Join Channel", href: "https://t.me/example", icon: Send, isCompleted: false },
  { id: '3', title: "Subscribe on YouTube", description: "Subscribe to our YouTube channel for video content.", reward: 50, rewardCurrency: 'GOLD', actionText: "Subscribe", href: "https://youtube.com/example", icon: Youtube, isCompleted: false },
  { id: '4', title: "Join Discord Server", description: "Become a part of our Discord community.", reward: 75, rewardCurrency: 'GOLD', actionText: "Join Server", href: "https://discord.gg/example", icon: MessageSquare, isCompleted: false },
  { id: '5', title: "Refer a Friend", description: "Invite friends to earn bonus GOLD. Find your link in Referrals.", reward: 200, rewardCurrency: 'GOLD', actionText: "Go to Referrals", href: "/referrals", icon: Users, isCompleted: false },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const { toast } = useToast();

  const handleCompleteTask = (taskId: string) => {
    // In a real app, this would involve verification and API call
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, isCompleted: true } : task
      )
    );
    const completedTask = tasks.find(task => task.id === taskId);
    if (completedTask) {
        toast({
            title: "Task Completed!",
            description: `You've earned ${completedTask.reward} ${completedTask.rewardCurrency} for completing "${completedTask.title}".`,
        });
        // TODO: Update user balance via API
    }
  };

  const completedTasksCount = tasks.filter(task => task.isCompleted).length;
  const totalTasksCount = tasks.length;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Social Tasks</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Complete tasks to earn HustleSoul tokens. More tasks coming soon!
        </p>

        <div className="mb-6 p-4 bg-card rounded-lg shadow">
          <p className="text-foreground">Progress: {completedTasksCount} / {totalTasksCount} tasks completed</p>
          <div className="w-full bg-muted rounded-full h-2.5 mt-2">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${(completedTasksCount / totalTasksCount) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onComplete={handleCompleteTask} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
