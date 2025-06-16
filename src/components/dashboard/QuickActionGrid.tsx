
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Users, Gamepad2, ArrowRight, Tv, Trophy, ListChecks } from "lucide-react";

const actions = [
  { title: "Spin the Wheel", description: "Try your luck for big prizes!", href: "/wheel", icon: Zap, color: "text-yellow-400" },
  { title: "Watch Ads", description: "Earn Diamonds by watching short ads.", href: "/ads", icon: Tv, color: "text-sky-400" },
  { title: "Play Games", description: "Test your skills in Stake Builder!", href: "/games", icon: Gamepad2, color: "text-green-400" },
  { title: "Refer Friends", description: "Invite friends & earn together.", href: "/referrals", icon: Users, color: "text-pink-400" },
  { title: "View Tasks", description: "Complete tasks for rewards.", href: "/tasks", icon: ListChecks, color: "text-orange-400" },
  { title: "Leaderboard", description: "See who's on top!", href: "/leaderboard", icon: Trophy, color: "text-purple-400" },
];

export function QuickActionGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {actions.map((action) => (
        <Link href={action.href} key={action.title} className="group">
          <Card className="h-full flex flex-col justify-between shadow-md hover:shadow-primary/40 transition-all duration-300 hover:border-primary/50 transform hover:-translate-y-1">
            <CardHeader>
              <div className="flex items-center gap-3">
                <action.icon className={`h-8 w-8 ${action.color}`} />
                <CardTitle className="font-headline text-lg text-foreground group-hover:text-primary transition-colors">{action.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
              <div className="text-primary font-semibold flex items-center group-hover:underline">
                Go to {action.title.split(' ')[0]} <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
    