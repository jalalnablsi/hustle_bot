
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckSquare, ExternalLink, Zap, Twitter, Youtube, MessageSquare, Send, Users, LucideIcon, HelpCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';

// Define specific platform icons or use a mapping
const platformIcons: { [key: string]: LucideIcon } = {
  twitter: Twitter,
  youtube: Youtube,
  discord: MessageSquare,
  telegram: Send,
  referral: Users,
  default: HelpCircle,
};

// Make Task type exportable
export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardCurrency: 'GOLD' | 'DIAMOND' | 'GEM_PURPLE' | 'GEM_BLUE' | 'SPIN';
  actionText: string;
  href?: string | null;
  isCompleted?: boolean;
  platform?: string; // e.g., "twitter", "telegram"
  requires_user_input?: boolean; // If true, might imply specific input field
  input_placeholder?: string | null;
  // icon string from API can be mapped to component if needed, or TaskItem handles it
  icon?: string; // This could be 'Twitter', 'Youtube', etc. string
}

interface TaskItemProps {
  task: Task;
  onComplete: (taskId: string, userInput?: string) => Promise<void> | void; // Can be async
  disabled?: boolean; // To disable button during global loading
}

export function TaskItem({ task, onComplete, disabled }: TaskItemProps) {
  const IconComponent = platformIcons[task.platform?.toLowerCase() || 'default'] || platformIcons.default;
  const { toast } = useToast();
  const [userInput, setUserInput] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // Determine if this task specifically requires Twitter username input
  const requiresTwitterUsername = task.platform?.toLowerCase() === 'twitter' && task.requires_user_input;

  const handleCompletion = async () => {
    if (requiresTwitterUsername && !userInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter your Twitter username.",
        variant: "destructive",
      });
      return;
    }
    setIsCompleting(true);
    try {
      await onComplete(task.id, requiresTwitterUsername ? userInput.trim() : undefined);
      // Success toast is handled by parent TasksPage after API call
    } catch (error) {
      // Error toast is handled by parent TasksPage
      console.error("TaskItem completion error caught by item itself (should be parent):", error);
    } finally {
      setIsCompleting(false);
    }
  };


  return (
    <Card className={cn(
        "shadow-lg hover:shadow-primary/20 transition-all duration-300 flex flex-col justify-between",
        task.isCompleted ? "bg-muted/30 border-green-500/30" : "bg-card"
    )}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <IconComponent className={cn("h-8 w-8", task.isCompleted ? "text-green-500" : "text-primary")} />
            <CardTitle className="font-headline text-lg text-foreground leading-tight">{task.title}</CardTitle>
          </div>
          <div className="flex items-center gap-1 text-yellow-400 font-semibold text-sm whitespace-nowrap">
            <Zap size={16} className={task.rewardCurrency === 'DIAMOND' ? "text-sky-400" : "text-yellow-400"}/>
            +{task.reward} {task.rewardCurrency}
          </div>
        </div>
        <CardDescription className="text-muted-foreground pt-1 text-sm">{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {requiresTwitterUsername && !task.isCompleted && (
          <div className="space-y-1.5 mb-3">
            <label htmlFor={`twitter-input-${task.id}`} className="text-xs font-medium text-muted-foreground">Your Twitter Username (e.g., @username)</label>
            <Input
              id={`twitter-input-${task.id}`}
              type="text"
              placeholder={task.input_placeholder || "@your_twitter_handle"}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="h-9 text-sm"
              disabled={task.isCompleted || isCompleting || disabled}
            />
          </div>
        )}
      </CardContent>
      <CardFooter>
        {task.isCompleted ? (
          <Button variant="outline" disabled className="w-full bg-green-500/10 text-green-500 border-green-500/50 hover:bg-green-500/20">
            <CheckSquare className="mr-2 h-4 w-4" />
            Task Completed
          </Button>
        ) : task.href && !task.href.startsWith('/') ? (
          <Button
            asChild
            className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity"
            // onClick={handleCompletion} // For external, completion might be verified differently or on return
            disabled={isCompleting || disabled}
          >
            <a href={task.href} target="_blank" rel="noopener noreferrer" onClick={() => {
              // Mark as potentially completed or trigger a check after user returns
              // For now, simple click means they are doing it. Actual completion is via API call.
              // If task requires input, button changes to 'Submit' or similar after filling.
              if (!requiresTwitterUsername) { // If it's just a link click without input, trigger completion logic
                  setTimeout(()=> handleCompletion(), 300); // Small delay to allow link to open
              } else {
                  // For Twitter, the handleCompletion will be triggered by a separate button or the main button.
                  // This main button could become a "Verify" button after link click, or handleCompletion is tied to specific UI.
                  // For simplicity: if it's a link, assume they'll do it. For input, rely on the main button.
              }
            }}>
              {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {task.actionText}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        ) : (
          <Button
            onClick={handleCompletion}
            className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity"
            disabled={isCompleting || disabled || (requiresTwitterUsername && !userInput.trim())}
          >
            {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (requiresTwitterUsername ? <Check className="mr-2 h-4 w-4"/> : null)}
            {requiresTwitterUsername ? 'Submit & Verify' : task.actionText}
            {task.href && task.href.startsWith('/') && <ExternalLink className="ml-2 h-4 w-4" />}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

