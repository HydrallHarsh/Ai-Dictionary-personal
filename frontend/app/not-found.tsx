import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Not found.
 *
 * This page renders inside the root layout, so the site navbar remains
 * available when a reader reaches an unknown route.
 *
 * The composition is the earlier one: copy on the left, the cat in its own
 * panel on the right, the two of them the same height. What changed is the
 * dressing — the gradient-clipped heading, the blurred purple orb and the
 * dotted grid are gone in favour of the ambient wash and hairlines the rest of
 * the site uses.
 */
export const metadata = {
	title: "404 - Hallucination Detected",
	description: "The AI made this up.",
};

export default function NotFound() {
	return (
		<div className="relative min-h-screen bg-background text-foreground">
			{/* Same opening temperature as the landing and about pages. */}
			<div
				className="ambient-wash pointer-events-none absolute inset-x-0 top-0 h-[34rem] opacity-70"
				aria-hidden="true"
			/>

			{/* Fills the viewport below the 64px navbar, so the pair sits centred
			    rather than hugging the top of an otherwise empty page. */}
			<main className="relative container mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1200px] items-center px-4 py-16 sm:px-6">
				<div className="animate-in fade-in zoom-in grid w-full grid-cols-1 items-center justify-items-center gap-10 duration-500 md:grid-cols-2 md:gap-16">
					{/* Copy first in the DOM, second on screen — the headline is what
					    you read, the image is what you look at. */}
					<div className="order-2 flex flex-col items-center space-y-6 text-center md:order-1 md:items-start md:space-y-7 md:text-left">
						<div className="flex flex-col items-center md:items-start">
							<h1 className="text-8xl leading-none font-black tracking-tighter select-none md:text-9xl lg:text-[10rem]">
								404
							</h1>
							<p className="mt-3 rounded-full border border-border bg-muted/50 px-4 py-2 font-mono text-sm text-muted-foreground">
								&gt; error: hallucination_detected
							</p>
						</div>

						<div className="max-w-lg space-y-4">
							<h2 className="text-2xl leading-tight font-bold tracking-tight md:text-4xl">
								&quot;Your model is hallucinating now...&quot;
							</h2>
							<p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
								We explicitly told the AI to{" "}
								<span className="font-semibold text-foreground italic">
									&quot;stick to the context info only&quot;
								</span>
								, but it decided to dream up this page anyway.
							</p>
							<p className="text-sm text-muted-foreground/80 italic">
								(It probably thinks this page is real. It&rsquo;s not. Please
								forgive it.)
							</p>
						</div>

						<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
							<Button
								asChild
								size="lg"
								className="h-14 rounded-full bg-indigo-600 px-10 text-lg font-bold text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl"
							>
								<Link href="/">Return to Reality</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								size="lg"
								className="h-14 rounded-full border-border px-7"
							>
								<Link href="/blog">Browse the archive</Link>
							</Button>
						</div>
					</div>

					{/* The cat panel, as it was: a bordered, rounded, shadowed frame.
					    `object-contain` rather than `object-cover` — the meme carries
					    its own caption, and cropping it cut the punchline off. It stays
					    upright art at rest and colourises on hover, which was the one
					    good idea in the old version. */}
					<div className="group relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-muted shadow-2xl md:h-[500px] md:max-w-full">
						<div className="relative aspect-square md:aspect-auto md:h-full">
							<Image
								src="/cat_2.png"
								alt="AI Hallucination Meme"
								fill
								sizes="(min-width: 768px) 50vw, 100vw"
								className="object-contain grayscale transition-[filter] duration-700 group-hover:grayscale-0"
							/>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
