
'use client';

import { useEffect, useState } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { TaskItem, type Task } from "@/components/tasks/TaskItem"; // Task type is now exported from TaskItem
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/contexts/UserContext';
import { Loader2, ListChecks, CheckCircle, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function TasksPage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadTasks = async () => {
      if (!currentUser?.id && !contextLoadingUser) { // Don't fetch if no user and not loading user
        setIsLoadingTasks(false);
        // setErrorLoadingTasks("User not identified. Cannot load tasks."); // Optional: show error if user is a hard requirement
        return;
      }
      setIsLoadingTasks(true);
      setErrorLoadingTasks(null);
      try {
        const res = await fetch('/api/tasks'); // API should use cookie or UserContext for userId if needed
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Could not load tasks from server.');
        }
        // Map icon string from API to actual Lucide components if needed, or TaskItem handles it
        setTasks(data.tasks.map((task: any) => ({
            ...task,
            // Example: platform: task.platform (TaskItem can map this to an icon)
        })));
      } catch (error: any) {
        console.error('Error loading tasks:', error.message);
        setErrorLoadingTasks(error.message);
        toast({ title: 'Error Loading Tasks', description: error.message, variant: 'destructive' });
      } finally {
        setIsLoadingTasks(false);
      }
    };
    // Only load tasks if user is available or context is done loading (and might set a user)
    if (!contextLoadingUser) {
        loadTasks();
    }
  }, [currentUser?.id, contextLoadingUser, toast]);

  const handleCompleteTask = async (taskId: string, userInput?: string) => {
    if (!currentUser?.id) {
        toast({ title: "Error", description: "User not logged in.", variant: "destructive"});
        return;
    }
    const taskToComplete = tasks.find(t => t.id === taskId);
    if (!taskToComplete || taskToComplete.isCompleted) return;

    setIsLoadingTasks(true); // Indicate task submission attempt
    try {
        const payload: { userId: string; taskId: string; userInput?: string } = {
            userId: currentUser.id,
            taskId,
        };
        if (userInput) {
            payload.userInput = userInput;
        }

        const res = await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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
            throw new Error(data.error || 'Could not complete this task.');
        }
    } catch (error: any) {
        toast({ title: "Task Completion Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsLoadingTasks(false);
    }
  };

  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  if (contextLoadingUser) {
    return (
        <AppShell>
            <div className="flex justify-center items-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
            <ListChecks className="mx-auto h-16 w-16 text-primary mb-4" />
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Engage & Earn</h1>
            <p className="text-lg text-muted-foreground"> Complete social tasks to earn HustleSoul tokens. More tasks added regularly! </p>
        </div>

        <div className="mb-8 p-4 bg-card rounded-xl shadow-lg border border-border">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-medium text-foreground">Your Task Progress:</p>
            <p className="text-sm font-bold text-primary">{completedCount} / {totalTasks} Tasks</p>
          </div>
          <Progress value={progressPercentage} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent" />
          {completedCount === totalTasks && totalTasks > 0 && (
            <p className="text-xs text-green-500 mt-1.5 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 mr-1"/> All tasks completed! Great job!
            </p>
          )}
        </div>

        {isLoadingTasks && !errorLoadingTasks && (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        )}
        {errorLoadingTasks && !isLoadingTasks && (
            <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-lg p-6">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
                <p className="text-destructive-foreground font-semibold text-lg">Failed to load tasks.</p>
                <p className="text-destructive-foreground/80 text-sm">{errorLoadingTasks}</p>
          </div>
        )}
        {!isLoadingTasks && !errorLoadingTasks && tasks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} onComplete={handleCompleteTask} disabled={isLoadingTasks} />
            ))}
          </div>
        )}
        {!isLoadingTasks && !errorLoadingTasks && tasks.length === 0 && (
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
