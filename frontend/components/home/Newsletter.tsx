"use client";

import { Button } from "@/components/ui/button";

export function Newsletter() {
	return (
		<section className="py-20 border-t border-border/40">
			<div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
				<div className="bg-foreground text-background rounded-4xl p-8 md:p-12 text-center relative overflow-hidden">
					<div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff20_1.5px,transparent_1px)] bg-size-[24px_24px] opacity-100"></div>
					<div className="relative z-10 max-w-xl mx-auto space-y-6">
						<h2 className="text-3xl md:text-4xl font-bold tracking-tight">
							Join the Inner Circle
						</h2>
						<p className="text-lg text-background/80">
							Get the most important AI news delivered to your inbox every
							morning.
						</p>
						<form className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
							<input
								type="email"
								placeholder="Enter your email"
								className="flex-1 h-12 px-5 rounded-full border-0 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-muted-foreground"
							/>
							<Button
								size="lg"
								variant="secondary"
								className="h-12 rounded-full px-8 font-semibold hover:bg-indigo-500 hover:text-white transition-colors"
							>
								Subscribe
							</Button>
						</form>
						<p className="text-xs text-background/60">
							No spam, unsubscribe at any time.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
