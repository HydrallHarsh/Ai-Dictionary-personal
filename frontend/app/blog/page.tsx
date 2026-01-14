import { BLOG_DATABASE } from "./[slug]/page";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, BookOpen } from "lucide-react";
import Image from "next/image";
import { AllContentBlock } from "@/types/content";
import { SignalBackground } from "@/components/ui/signal-background";
import { AnimatedBackground } from "@/components/ui/animated-background";

// Helper to extract metadata from blocks
const getPostMetadata = (slug: string, blocks: AllContentBlock[]) => {
  const titleBlock = blocks.find((b) => b.type === "title");
  const summaryBlock = blocks.find((b) => b.type === "summary");
  const imageBlock = blocks.find((b) => b.type === "image");

  return {
    slug,
    title: titleBlock?.data.content || "Untitled Post",
    summary: summaryBlock?.data.content || "No summary available.",
    coverImage: imageBlock?.data.url || null,
    tags: titleBlock?.data.tags || [],
    author: titleBlock?.data.author || "Unknown",
    date: titleBlock?.data.date || "Unknown Date",
    readTime: titleBlock?.data.estimated_time || "5 min read",
    difficulty: titleBlock?.data.difficulty || "Beginner",
  };
};

export default function BlogListingPage() {
  const allPosts = Object.keys(BLOG_DATABASE).map((slug) =>
    getPostMetadata(slug, BLOG_DATABASE[slug])
  );

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden pb-20">
      {/* Hero / Spotlight Section - Refined & Professional */}
      <section className="relative z-10 w-full py-12 md:py-16 px-6 md:px-12 border-b border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row gap-6 md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-linear-to-b from-foreground via-foreground/90 to-foreground/30 bg-clip-text text-transparent font-sans pb-2">
                The Knowledge Base
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed font-medium">
                The definitive archive for the architects of the new era.
              </p>
            </div>
          </div>
        </div>
      </section>
      <main className="container mx-auto px-6 md:px-12 z-10 relative mt-12">
        {allPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group outline-none"
              >
                <Card className="h-full flex flex-col border-border/40 bg-card/10 backdrop-blur-md overflow-hidden hover:bg-card/20 transition-all duration-500 hover:shadow-[0_0_30px_-5px_rgba(0,0,0,0)] hover:shadow-primary/20 group-hover:-translate-y-1 hover:border-primary/40 relative">
                  {/* Glow Effect on Hover */}
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative h-56 overflow-hidden">
                    {post.coverImage ? (
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full bg-muted/20">
                        <BookOpen className="w-12 h-12 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-background/80 to-transparent opacity-60" />
                    <div className="absolute top-3 right-3">
                      <Badge
                        variant="secondary"
                        className="bg-background/40 backdrop-blur-md border-white/10 text-foreground/80 hover:bg-background/60 transition-colors"
                      >
                        {post.difficulty}
                      </Badge>
                    </div>
                  </div>

                  <CardHeader className="space-y-3 relative">
                    <div className="flex flex-wrap gap-2">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-bold uppercase tracking-widest text-primary/70 group-hover:text-primary transition-colors"
                        >
                          [{tag}]
                        </span>
                      ))}
                    </div>
                    <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors duration-300">
                      {post.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="grow text-muted-foreground text-sm line-clamp-2 leading-relaxed relative">
                    {post.summary}
                  </CardContent>

                  <CardFooter className="flex items-center justify-between border-t border-border/10 pt-4 mt-auto text-xs text-muted-foreground relative">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium group-hover:text-primary transition-colors">
                      Read Protocol{" "}
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-50">
            <div className="bg-muted/10 p-8 rounded-full mb-6 backdrop-blur-sm">
              <BookOpen className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2 tracking-tight">
              Signal Lost
            </h3>
            <p className="text-muted-foreground text-sm font-mono">
              [FATAL_ERROR]: Database empty. Reinitializing...
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
