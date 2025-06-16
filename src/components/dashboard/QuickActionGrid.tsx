
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Users, Gamepad2, ArrowRight, Tv, Trophy, ListChecks, Megaphone, ShoppingCart, Gift } from "lucide-react";

const actions = [
  { title: "Spin the Wheel", description: "Try your luck for big prizes!", href: "/wheel", icon: Gift, color: "text-yellow-400" },
  { title: "Watch & Earn", description: "Watch ads for DIAMOND rewards.", href: "/ads", icon: Tv, color: "text-sky-400" },
  { title: "Play Games", description: "Test your skills in Stake Builder!", href: "/games", icon: Gamepad2, color: "text-green-400" },
  { title: "Refer Friends", description: "Invite friends & earn together.", href: "/referrals", icon: Users, color: "text-pink-400" },
  { title: "View Tasks", description: "Complete tasks for rewards.", href: "/tasks", icon: ListChecks, color: "text-orange-400" },
  { title: "Leaderboard", description: "See who's on top!", href: "/leaderboard", icon: Trophy, color: "text-purple-400" },
  // { title: "Shop (Coming Soon)", description: "Spend your earnings on cool items!", href: "#", icon: ShoppingCart, color: "text-indigo-400", comingSoon: true },
];

// Ad Banner component
function AdBannerPlaceholder() {
  return (
    <Card className="md:col-span-2 lg:col-span-3 shadow-lg hover:shadow-accent/50 transition-all duration-300 hover:border-accent/60 transform hover:-translate-y-1 bg-gradient-to-r from-primary/10 via-card to-accent/10 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Megaphone className={`h-8 w-8 text-accent`} />
            <CardTitle className="font-headline text-xl text-foreground group-hover:text-accent transition-colors">Exclusive Announcements!</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="aspect-[16/3] sm:aspect-[16/2.5] md:aspect-[16/2] bg-muted/40 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-accent/30 p-4 text-center">
            <div className="mb-2">
                <Image src="https://placehold.co/600x150.png?text=Exciting+News+Here!" alt="Promotional Banner" width={600} height={150} data-ai-hint="promotion announcement" className="rounded-md object-cover" />
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              Stay tuned for major updates, new game releases, and special HustleSoul events!
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">(This is a placeholder for future promotions)</p>
          </div>
        </CardContent>
    </Card>
  );
}


export function QuickActionGrid() {
  return (
    <div className="space-y-6">
      <h2 className="font-headline text-2xl font-semibold text-foreground">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {actions.map((action) => {
          const ActionCard = (
              <Card className="h-full flex flex-col justify-between shadow-md hover:shadow-primary/40 transition-all duration-300 hover:border-primary/50 transform hover:-translate-y-1 relative bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <action.icon className={`h-7 w-7 ${action.color}`} />
                  <CardTitle className="font-headline text-md text-foreground group-hover:text-primary transition-colors">{action.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between pt-2">
                <p className="text-xs text-muted-foreground mb-3">{action.description}</p>
                {!action.comingSoon && (
                  <div className="text-primary font-semibold flex items-center group-hover:underline text-xs mt-auto">
                    Go to {action.title.split(' ')[0]} <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                )}
              </CardContent>
              {action.comingSoon && (
                <div className="absolute inset-0 bg-card/80 backdrop-blur-xs flex items-center justify-center rounded-lg">
                  <span className="text-xs font-semibold text-primary-foreground bg-primary/80 px-2.5 py-1 rounded-full">Coming Soon</span>
                </div>
              )}
            </Card>
          );

          return action.comingSoon || action.href === "#" ? (
            <div key={action.title} className="group cursor-not-allowed opacity-70">
              {ActionCard}
            </div>
          ) : (
            <Link href={action.href} key={action.title} className="group">
              {ActionCard}
            </Link>
          );
        })}
      </div>
      {/* Ad Banner placeholder added to the end of the grid actions */}
      <div className="mt-8"> {/* Add some margin before the banner */}
        <AdBannerPlaceholder />
      </div>
    </div>
  );
}
