"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Newspaper } from "lucide-react";
import { motion } from "framer-motion";

export function LatestInsights() {
	return (
		<section className="py-20 border-t border-border/40">
			<div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex items-end justify-between mb-10"
				>
					<div>
						<h2 className="text-3xl font-bold tracking-tight mb-2">
							Latest Insights
						</h2>
						<p className="text-muted-foreground">
							Fresh perspectives on artificial intelligence.
						</p>
					</div>
					<Button
						variant="ghost"
						className="hidden md:flex gap-2 hover:bg-secondary/50"
					>
						View Archive <ArrowRight className="h-4 w-4" />
					</Button>
				</motion.div>

				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
					{[1, 2, 3, 4, 5, 6].map((_, i) => (
						<motion.div
							key={i}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: "-50px" }}
							transition={{ delay: i * 0.05, duration: 0.4 }}
							className="group cursor-pointer flex flex-col h-full"
						>
							<div className="relative aspect-4/3 mb-4 overflow-hidden rounded-2xl bg-secondary border border-border/50 group-hover:border-indigo-500/20 transition-colors duration-300">
								<div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
								<div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
									<Newspaper className="h-10 w-10" />
								</div>
								<div className="absolute top-3 left-3">
									<Badge
										variant="secondary"
										className="bg-background/80 backdrop-blur-sm text-xs"
									>
										Technology
									</Badge>
								</div>
							</div>
							<div className="space-y-2 flex-1 flex flex-col">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									{/* Placeholder/mockup date for demo purposes */}
									<span>Nov 21, 2025</span>
									<span>•</span>
									<span>5 min read</span>
								</div>
								<h3 className="text-lg font-bold group-hover:text-indigo-500 transition-colors duration-300 leading-snug">
									The Rise of Multimodal Models in 2025
								</h3>
								<p className="text-muted-foreground line-clamp-2 text-sm">
									Exploring how new architectures are reshaping the way AI
									understands and generates content.
								</p>
							</div>
						</motion.div>
					))}
				</div>

				<div className="mt-10 text-center md:hidden">
					<Button variant="outline" className="w-full rounded-full">
						View Archive <ArrowRight className="ml-2 h-4 w-4" />
					</Button>
				</div>
			</div>
		</section>
	);
}
