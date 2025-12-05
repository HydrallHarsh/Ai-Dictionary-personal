import { TitleBlock } from "@/types/content";
import { motion } from "framer-motion";
import { BarChart2, Calendar, Clock, User } from "lucide-react";

type Props = TitleBlock["data"];

export function TitleComponent({
  content,
  date,
  tags,
  difficulty,
  author,
  estimated_time,
}: Props) {
  return (
    <header className="mb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
            System Design
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium border border-border">
            LLMs
          </span> */}
        {tags && (
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
          {content}
          <br className="hidden md:block" />
          {/* <span className="text-muted-foreground">
            Architecture & Implementation
          </span> */}
        </h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {author || "Recent-AI-Bot"}
              </span>
              {/* <span className="text-xs text-muted-foreground">AI Engineer</span> */}
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-border/50" />

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> {date.toUTCString().slice(4, 16)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> {estimated_time} read
            </span>
            <span className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> {difficulty || "intermediate"}
            </span>
          </div>
        </div>
      </motion.div>
    </header>
  );
}
