"use client";

import { motion } from "framer-motion";
import { SummaryBlock } from "@/types/content";

type Props = SummaryBlock["data"];

export function SummaryComponent({ content }: Props) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, delay: 0.1 }}
			className="p-8 rounded-xl bg-secondary/30 border-l-4 border-primary backdrop-blur-sm mb-12"
		>
			<p className="text-lg md:text-xl leading-relaxed text-muted-foreground italic">
				{content}
			</p>
		</motion.div>
	);
}
