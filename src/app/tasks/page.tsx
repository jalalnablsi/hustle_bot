
'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { TaskItem } from "@/components/tasks/TaskItem";
import type { Task } from "@/app/types";
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/contexts/UserContext';
import { Loader2, ListChecks, CheckCircle, AlertTriangle, Info, Coins, Gem } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export default function TasksPage() {
  const { currentUser, loadingUser, telegramAuthError, updateUserSession } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(null);
  const { toast } = useToast();

  const loadTasks = useCallback(async () => {
      setIsLoadingTasks(true);
      setErrorLoadingTasks(null);
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) {
            let errorMsg = `Server responded with ${res.status}`;
            try {
                const data = await res.json();
                errorMsg = data.error || errorMsg;
            } catch (e) {
                // Ignore if response is not json
            }
            throw new Error(errorMsg);
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Could not load tasks from server.');
        }
        setTasks(data.tasks);
      } catch (error: any) {
        console.error('Error loading tasks:', error.message);
        setErrorLoadingTasks(error.message);
      } finally {
        setIsLoadingTasks(false);
      }
    }, []);

  useEffect(() => {
    if (!loadingUser && currentUser) {
      loadTasks();
    } else if (!loadingUser && !currentUser) {
        setIsLoadingTasks(false);
        if (!telegramAuthError) {
          setErrorLoadingTasks("User not authenticated. Cannot load tasks.");
        }
    }
  }, [currentUser, loadingUser, telegramAuthError, loadTasks]);

  const handleCompleteTask = async (taskId: string, userInput?: string) => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "User not logged in.", variant: "destructive"});
        return;
    }
    const taskToComplete = tasks.find(t => t.id === taskId);
    if (!taskToComplete || taskToComplete.isCompleted) return;

    try {
        const res = await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, taskId, userInput }),
        });
        const data = await res.json();

        if (data.success) {
            setTasks(prev => prev.map(task => task.id === taskId ? { ...task, isCompleted: true } : task ));
            updateUserSession({
                gold_points: data.totalGold,
                diamond_points: data.totalDiamonds,
            });
            toast({
                title: "Task Completed!",
                description: `You earned ${data.reward} ${data.rewardType.toUpperCase()}`,
                icon: data.rewardType === 'gold' ? <Coins className="h-6 w-6 text-yellow-500" /> : <Gem className="h-6 w-6 text-sky-400" />,
            });
        } else {
            toast({ title: "Task Completion Failed", description: data.error || 'Could not complete this task.', variant: "destructive" });
        }
    } catch (error: any) {
        toast({ title: "Task Completion Failed", description: error.message || 'An unexpected error occurred.', variant: "destructive" });
    }
  };

  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  if (loadingUser) {
    return (
        <AppShell>
            <div className="flex justify-center items-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </AppShell>
    );
  }

  if (telegramAuthError || !currentUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-3">Authentication Error</h2>
            <p className="text-muted-foreground mb-6">{telegramAuthError || "Please launch the app via Telegram to view tasks."}</p>
            <Button onClick={() => window.location.reload()} variant="outline">Relaunch App</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
            <ListChecks className="mx-auto h-16 w-16 text-primary mb-4 filter drop-shadow-[0_2px_8px_hsl(var(--primary)/0.4)]" />
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Engage & Earn</h1>
            <p className="text-lg text-muted-foreground"> Complete social tasks to earn HustleSoul tokens. More tasks added regularly! </p>
        </div>

        <div className="mb-8 p-4 bg-card rounded-xl shadow-lg border border-border">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-medium text-foreground">Your Task Progress:</p>
            <p className="text-sm font-bold text-primary">{completedCount} / {totalTasks > 0 ? totalTasks : isLoadingTasks ? '...' : '0'}</p>
          </div>
          <Progress value={progressPercentage} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent" />
          {completedCount === totalTasks && totalTasks > 0 && (
            <p className="text-xs text-green-500 mt-1.5 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 mr-1"/> All tasks completed! Great job!
            </p>
          )}
        </div>

        {isLoadingTasks ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : errorLoadingTasks ? (
            <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-lg p-6">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
                <p className="text-destructive-foreground font-semibold text-lg">Failed to load tasks.</p>
                <p className="text-destructive-foreground/80 text-sm">{errorLoadingTasks}</p>
                 <Button onClick={loadTasks} variant="outline" className="mt-3">Try Again</Button>
          </div>
        ) : tasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} onComplete={handleCompleteTask} />
            ))}
          </div>
        ) : (
            <div className="text-center py-10">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3"/>
                <p className="text-muted-foreground text-lg">No active tasks available right now.</p>
                <p className="text-muted-foreground text-sm">Please check back later for new opportunities!</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

    
