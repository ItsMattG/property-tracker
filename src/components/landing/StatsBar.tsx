import { Home, Users, Lock, Globe } from "lucide-react";

interface StatsBarProps {
  propertyCount: number;
  userCount: number;
}

export function StatsBar({ propertyCount, userCount }: StatsBarProps) {
  return (
    <section className="py-6 px-4 bg-muted border-y">
      <div className="container mx-auto max-w-4xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col items-center text-center">
            <Home className="w-5 h-5 text-primary mb-1" />
            <span className="text-2xl font-bold">{propertyCount}+</span>
            <span className="text-sm text-muted-foreground">Properties Tracked</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Users className="w-5 h-5 text-primary mb-1" />
            <span className="text-2xl font-bold">{userCount}+</span>
            <span className="text-sm text-muted-foreground">Investors</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Lock className="w-5 h-5 text-primary mb-1" />
            <span className="text-2xl font-bold">Secure</span>
            <span className="text-sm text-muted-foreground">Bank-Grade Security</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Globe className="w-5 h-5 text-primary mb-1" />
            <span className="text-2xl font-bold">100%</span>
            <span className="text-sm text-muted-foreground">Australian</span>
          </div>
        </div>
      </div>
    </section>
  );
}
