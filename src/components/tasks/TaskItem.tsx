
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, ExternalLink, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardCurrency: 'GOLD' | 'DIAMOND'; // Specify currency type
  actionText: string;
  href?: string; 
  isCompleted?: boolean;
  icon: LucideIcon; 
}

interface TaskItemProps {
  task: Task;
  onComplete: (taskId: string) => void;
}

export function TaskItem({ task, onComplete }: TaskItemProps) {
  const IconComponent = task.icon;

  return (
    <Card className="shadow-md hover:shadow-primary/30 transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconComponent className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-lg text-foreground">{task.title}</CardTitle>
          </div>
          <div className="flex items-center gap-1 text-yellow-400 font-semibold">
            <Zap size={18} /> +{task.reward} {task.rewardCurrency}
          </div>
        </div>
        <CardDescription className="text-muted-foreground pt-1">{task.description}</CardDescription>
      </CardHeader>
      <CardFooter>
        {task.isCompleted ? (
          <Button variant="outline" disabled className="w-full">
            <CheckSquare className="mr-2 h-4 w-4" />
            Completed
          </Button>
        ) : task.href && !task.href.startsWith('/') ? ( // External links
          <Button
            asChild
            className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity"
            onClick={() => onComplete(task.id)} // Simulate completion, actual logic might differ for external
          >
            <a href={task.href} target="_blank" rel="noopener noreferrer">
              {task.actionText}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        ) : ( // Internal links or actions without href
          <Button 
            onClick={() => {
              if (task.href && task.href.startsWith('/')) {
                 // Potentially navigate using Next Router if it's an internal app path
                 // For now, still call onComplete, router.push(task.href) could be added
                 window.location.href = task.href; // Simple navigation for now
              }
              onComplete(task.id);
            }}
            className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {task.actionText}
            {task.href && task.href.startsWith('/') && <ExternalLink className="ml-2 h-4 w-4" />}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
