import { RelatedTopicsBlock } from "@/types/content";
import { motion } from "framer-motion";

type Props = RelatedTopicsBlock["data"];

export function RelatedTopicsComponent({ topics }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="border-t border-border pt-12"
    >
      <h3 className="text-xl font-semibold mb-6">Related Topics</h3>
      <div className="flex flex-wrap gap-3">
        {
        topics.map((tag) => (
          <span
            key={tag}
            className="px-5 py-2 rounded-full bg-secondary/50 border border-border text-sm hover:bg-secondary hover:border-primary/30 transition-all cursor-pointer"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.section>
  );
}
