import { Github, Linkedin, Twitter } from "lucide-react";

export function Footer() {
	return (
		<footer className="border-t border-border/40 bg-secondary/20 py-10 pl-2">
			<div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
				<div className="flex flex-col md:flex-row justify-between items-center gap-6">
					<div className="flex items-center gap-2">
						<span className="font-bold text-lg tracking-tight">
							AI Dictionary
						</span>
					</div>
					<div className="flex gap-16 text-sm text-muted-foreground">
						<Twitter
							href="#"
							className="hover:text-foreground transition-colors"
						>
							Twitter
						</Twitter>
						<Linkedin
							href="#"
							className="hover:text-foreground transition-colors"
						>
							LinkedIn
						</Linkedin>
						<Github
							href="https://github.com/recent-ai/Ai-Dictionary"
							className="hover:text-foreground transition-colors"
						>
							GitHub
						</Github>
					</div>
					<p className="text-xs text-muted-foreground">
						© 2025 AI Dictionary. All rights reserved.
					</p>
				</div>
			</div>
		</footer>
	);
}
