"use client";

import { motion } from "framer-motion";

interface Props {
	html: string;
	filename?: string;
}

export function CodeBlockClient({ html, filename }: Props) {
	return (
		<motion.div
			initial={{ opacity: 0, x: -20 }}
			whileInView={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.5, delay: 0.2 }}
			viewport={{ once: true }}
			className="rounded-xl border border-border bg-card overflow-hidden shadow-sm"
		>
			<div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
				<span className="text-xs font-mono text-muted-foreground flex items-center gap-2">
					<div className="w-2 h-2 rounded-full bg-blue-500" />
					{filename || "snippet"}
				</span>
				<div className="flex gap-1.5">
					<div className="w-2.5 h-2.5 rounded-full bg-red-500/40"></div>
					<div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"></div>
					<div className="w-2.5 h-2.5 rounded-full bg-green-500/40"></div>
				</div>
			</div>
			<div
				className="p-4 overflow-x-auto text-sm leading-relaxed"
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			<style jsx global>{`
        pre.shiki {
            background-color: transparent !important;
            margin: 0;
        }
      `}</style>
		</motion.div>
	);
}
