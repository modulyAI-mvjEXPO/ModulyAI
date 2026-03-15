"use client";
import { WavyBackground } from "@/components/ui/wavy-background";
import { Sparkles, ArrowRight } from "lucide-react"; // Using lucide-react as specified

export function WavyBackgroundDemo() {
  return (
    <WavyBackground className="max-w-4xl mx-auto pb-40">
      <div className="flex flex-col items-center justify-center space-y-8">
        <div className="p-4 bg-primary text-primary-foreground border-4 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          <Sparkles className="w-12 h-12" />
        </div>
        <p className="text-2xl md:text-4xl lg:text-7xl text-foreground font-bold inter-var text-center">
          Hero waves are cool
        </p>
        <p className="text-base md:text-lg mt-4 text-muted-foreground font-normal inter-var text-center">
          Leverage the power of canvas to create a beautiful hero section with a Neo-brutalistic twist!
        </p>
        <div className="flex space-x-4 mt-8">
          <button className="flex items-center space-x-2 bg-accent text-accent-foreground px-8 py-4 font-bold border-4 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all">
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" alt="Abstract aesthetic" className="w-14 h-14 object-cover border-4 border-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]" />
        </div>
      </div>
    </WavyBackground>
  );
}
