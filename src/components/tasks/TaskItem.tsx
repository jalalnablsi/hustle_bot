
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckSquare, ExternalLink, Zap, Twitter, Youtube, MessageSquare, Send, Users, LucideIcon, HelpCircle, Check, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';

const platformIcons: { [key: string]: LucideIcon } = {
  twitter: Twitter,
  youtube: Youtube,
  discord: MessageSquare,
  telegram: Send,
  referral: Users,
  default: HelpCircle,
};

export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardCurrency: 'GOLD' | 'DIAMOND' | 'GEM_PURPLE' | 'GEM_BLUE' | 'SPIN';
  actionText: string;
  href?: string | null;
  isCompleted?: boolean;
  platform?: string;
  requires_user_input?: boolean;
  input_placeholder?: string | null;
}

interface TaskItemProps {
  task: Task;
  onComplete: (taskId: string, userInput?: string) => Promise<void> | void;
}

export function TaskItem({ task, onComplete }: TaskItemProps) {
  const IconComponent = platformIcons[task.platform?.toLowerCase() || 'default'] || platformIcons.default;
  const { toast } = useToast();
  const [userInput, setUserInput] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [needsVerificationInput, setNeedsVerificationInput] = useState(false);

  const isPlatformTaskWithInput = (task.platform?.toLowerCase() === 'twitter' || task.platform?.toLowerCase() === 'telegram') && task.requires_user_input;

  const handleActionClick = async () => {
    if (task.isCompleted || isCompleting) return;

    if (task.href && !task.href.startsWith('/') && !needsVerificationInput) {
      window.open(task.href, '_blank', 'noopener,noreferrer');
      if (isPlatformTaskWithInput || task.requires_user_input) { // Broaden condition for showing input/verify
        setNeedsVerificationInput(true);
      } else if (!task.requires_user_input) {
        // For tasks that just need an external link click and then verify
        setNeedsVerificationInput(true); // Still show "Verify Task" button
      }
      return;
    }

    if (needsVerificationInput && isPlatformTaskWithInput && !userInput.trim()) {
      toast({
        title: "Input Required",
        description: `Please enter your ${task.platform} username or required input.`,
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);
    try {
      await onComplete(task.id, (isPlatformTaskWithInput || task.requires_user_input) ? userInput.trim() : undefined);
      // Parent (TasksPage) will handle success toast and state update
    } catch (error) {
      // Parent (TasksPage) likely handles error toast
      console.error("TaskItem completion error:", error);
    } finally {
      setIsCompleting(false);
      // Do not reset needsVerificationInput here, parent will re-render with updated task.isCompleted
    }
  };

  let buttonText = task.actionText;
  let showExternalLinkIcon = task.href && !task.href.startsWith('/') && !needsVerificationInput;

  if (task.isCompleted) {
    buttonText = "Task Completed";
    showExternalLinkIcon = false;
  } else if (needsVerificationInput) {
    buttonText = "Verify Task";
    showExternalLinkIcon = false;
  }


  return (
    <Card className={cn(
        "shadow-lg hover:shadow-primary/20 transition-all duration-300 flex flex-col justify-between border",
        task.isCompleted ? "bg-green-500/5 border-green-500/40" : "bg-card hover:border-primary/30"
    )}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <IconComponent className={cn("h-8 w-8", task.isCompleted ? "text-green-500" : "text-primary")} />
            <CardTitle className="font-headline text-lg text-foreground leading-tight">{task.title}</CardTitle>
          </div>
          <div className={cn(
            "flex items-center gap-1 font-semibold text-sm whitespace-nowrap px-2 py-0.5 rounded-full",
            task.rewardCurrency === 'DIAMOND' ? "text-sky-400 bg-sky-500/10" : "text-yellow-400 bg-yellow-500/10"
          )}>
            <Zap size={14} />
            +{task.reward} {task.rewardCurrency}
          </div>
        </div>
        <CardDescription className="text-muted-foreground pt-1 text-sm">{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {needsVerificationInput && (isPlatformTaskWithInput || task.requires_user_input) && !task.isCompleted && (
          <div className="space-y-1.5 mb-3">
            <label htmlFor={`platform-input-${task.id}`} className="text-xs font-medium text-muted-foreground">
              {task.input_placeholder || `Your ${task.platform || 'input'}`}
            </label>
            <Input
              id={`platform-input-${task.id}`}
              type="text"
              placeholder={task.input_placeholder || `@your_${task.platform}_handle`}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="h-9 text-sm bg-background/70 border-border focus:border-primary"
              disabled={task.isCompleted || isCompleting}
            />
          </div>
        )}
         {needsVerificationInput && !(isPlatformTaskWithInput || task.requires_user_input) && !task.isCompleted && (
          <div className="text-xs text-primary/80 italic my-2 flex items-center gap-1.5">
            <Info size={14}/> After completing the action on {task.platform || 'the linked page'}, click "Verify Task" below.
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
            onClick={handleActionClick}
            className={cn("w-full transition-all",
                task.isCompleted ? "bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30"
                                : "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
            )}
            disabled={isCompleting || task.isCompleted || (needsVerificationInput && (isPlatformTaskWithInput || task.requires_user_input) && !userInput.trim())}
            variant={task.isCompleted ? "outline" : "default"}
            size="lg"
        >
            {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : task.isCompleted ? <CheckSquare className="mr-2 h-4 w-4" /> : null}
            {buttonText}
            {showExternalLinkIcon && <ExternalLink className="ml-2 h-4 w-4" />}
        </Button>
      </CardFooter>
    </Card>
  );
}
    