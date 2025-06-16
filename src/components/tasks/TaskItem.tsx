
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckSquare, ExternalLink, Zap, Twitter, Youtube, MessageSquare, Send, Users, LucideIcon, HelpCircle, Check, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';

// Ensure platformIcons correctly maps platform strings to LucideIcon components
const platformIcons: { [key: string]: LucideIcon } = {
  twitter: Twitter,
  youtube: Youtube,
  discord: MessageSquare,
  telegram: Send,
  referral: Users, // Assuming 'referral' might be a platform type
  default: HelpCircle,
};

export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardCurrency: 'GOLD' | 'DIAMOND' | 'GEM_PURPLE' | 'GEM_BLUE' | 'SPIN';
  actionText: string; // Original action text like "Go to Tweet", "Join Channel"
  href?: string | null;
  isCompleted?: boolean;
  platform?: string; // e.g., "twitter", "telegram", "youtube"
  requires_user_input?: boolean; // If true, input field is needed
  input_placeholder?: string | null; // Placeholder for the input field
  // 'icon' prop is removed from Task type, it's derived from 'platform'
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
  // This state tracks if the user has clicked an external link and now needs to provide input
  const [needsVerificationInput, setNeedsVerificationInput] = useState(false);

  const isTwitterTaskWithInput = task.platform?.toLowerCase() === 'twitter' && task.requires_user_input;

  const handleActionClick = async () => {
    if (task.isCompleted || isCompleting) return;

    if (task.href && !task.href.startsWith('/') && !needsVerificationInput) {
      // User clicks the initial link (e.g., "Go to Tweet")
      window.open(task.href, '_blank', 'noopener,noreferrer');
      if (isTwitterTaskWithInput) {
        setNeedsVerificationInput(true); // Show input field after they've gone to Twitter
      } else if (!task.requires_user_input) {
        // For tasks without input that have an external link, user might need to click "Verify" separately
        // For now, we assume they click "Verify" after performing the action if no input is needed.
        // Or, a "Verify Task" button appears after this click.
        // To simplify, if no input needed, this state implies a "Verify" step is next.
        setNeedsVerificationInput(true);
      }
      return; // Don't proceed to onComplete yet
    }

    // This part handles "Verify Task" click or direct completion for tasks without external links
    if (isTwitterTaskWithInput && !userInput.trim()) {
      toast({
        title: "Input Required",
        description: `Please enter your ${task.platform} username.`,
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);
    try {
      await onComplete(task.id, isTwitterTaskWithInput ? userInput.trim() : undefined);
      // Parent (TasksPage) will handle success toast and state update
    } catch (error) {
      // Parent (TasksPage) likely handles error toast
      console.error("TaskItem completion error:", error);
    } finally {
      setIsCompleting(false);
      if (isTwitterTaskWithInput) setNeedsVerificationInput(false); // Reset for next time if needed
    }
  };

  let buttonText = task.actionText; // Default, e.g., "Join Telegram"
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
        {needsVerificationInput && isTwitterTaskWithInput && !task.isCompleted && (
          <div className="space-y-1.5 mb-3">
            <label htmlFor={`platform-input-${task.id}`} className="text-xs font-medium text-muted-foreground">Your {task.platform} Username (e.g., @username)</label>
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
         {/* Message after clicking external link for non-input tasks */}
         {needsVerificationInput && !isTwitterTaskWithInput && !task.isCompleted && (
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
            disabled={isCompleting || task.isCompleted || (needsVerificationInput && isTwitterTaskWithInput && !userInput.trim())}
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
    