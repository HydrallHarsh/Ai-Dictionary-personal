"use client";

import { ImageBlock } from "@/types/content";
import { motion } from "framer-motion";
import Image from "next/image";

type Props = ImageBlock["data"];

export function ImageComponent({ alt, caption, url }: Props) {
	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.5, delay: 0.2 }}
			className="rounded-xl border border-border bg-card p-8 flex flex-col justify-center items-center text-center space-y-6 hover:bg-secondary/20 transition-colors"
		>
			<div className="w-full h-56 bg-secondary/50 rounded-lg flex items-center justify-center border border-dashed border-muted-foreground/30 relative group overflow-hidden">
				<div className="absolute inset-0 bg-grid-white/5 mask-[linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
				<span className="text-muted-foreground relative z-10 group-hover:scale-105 transition-transform duration-300">
					<Image
						src={url}
						alt={alt || ""}
						className="max-h-full max-w-full object-contain"
						fill
					/>
				</span>
			</div>
			<div className="text-sm text-muted-foreground text-left w-full px-4">
				<p className="font-medium text-foreground mb-2">{caption}</p>
				{/* <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Perception
            Layer
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Reasoning
            Engine
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Action
            Interface
          </li>
        </ul> */}
			</div>
		</motion.div>
	);
}
