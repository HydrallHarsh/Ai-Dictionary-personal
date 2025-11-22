import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] relative z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-800 ease-out flex justify-center">
            <Badge
              variant="outline"
              className="px-3 py-1 text-sm font-medium rounded-full border-foreground/10 bg-secondary/50 backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-700" strokeWidth={1} />
              Daily AI Intelligence
            </Badge>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tighter leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-500 delay-100 fill-mode-backwards">
            The <span className="text-muted-foreground">Signal</span> <br />
            <span className="italic font-serif text-4xl sm:text-5xl md:text-7xl text-muted-foreground mr-2">
              in the
            </span>
            <span className="relative inline-block pl-4">
              Noise.
              <span className="absolute -bottom-1 left-0 w-full h-3 bg-indigo-500/20 -z-10 transform -rotate-1"></span>
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-backwards">
            Curated, automated, and essential. We parse thousands of AI news
            sources daily so you don't have to.
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-4 animate-in fade-in slide-in-from-bottom-10 duration-500 delay-300 fill-mode-backwards">
            <Button
              size="lg"
              className="h-12 px-6 text-base rounded-full group bg-foreground text-background hover:bg-foreground/90"
            >
              Read Today's Brief
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base rounded-full border-border hover:bg-secondary/50"
            >
              View Archive
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
