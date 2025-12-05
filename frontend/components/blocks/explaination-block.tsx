import { ExplanationBlock } from "@/types/content";
import { motion } from "framer-motion";

type Props = ExplanationBlock["data"];

export function ExplanationComponent({ content }: Props) {
  // Note: In a real app, you would use a Markdown parser here
  // But for now, we will just render the text
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="prose prose-lg dark:prose-invert max-w-none mb-16"
    >
      <h2 className="text-3xl font-bold mb-6 tracking-tight">
        Deep Dive into Architecture
      </h2>
      <p className="text-muted-foreground leading-relaxed mb-6">
        {content}
      </p>
      <p className="text-muted-foreground leading-relaxed">
        Key components include the <strong>Memory Module</strong>, which stores
        short-term and long-term history, and the <strong>Planner</strong>,
        which breaks down complex goals into executable steps.
      </p>
    </motion.section>
  );
}
