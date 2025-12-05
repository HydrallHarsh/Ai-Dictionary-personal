import { ExampleBlock } from "@/types/content";
import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";

type Props = ExampleBlock["data"];

export function ExampleComponent({ content }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="mb-16"
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold flex items-center gap-3">
          <span className="bg-primary/10 p-2 rounded-lg text-primary">
            <Bookmark className="w-5 h-5" />
          </span>
          Cookbook & Examples
        </h3>
        <button className="text-sm font-medium text-primary hover:underline">
          View All
        </button>
      </div>
    </motion.section>
  );
}
