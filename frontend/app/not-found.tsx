import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Not found.
 *
 * Lives beside the routes rather than in `global-not-found.js`, because that
 * file replaces the whole document: no navbar, no footer, and a second copy of
 * the theme provider. A reader who mistypes a URL should land somewhere that
 * still has a way back. `global-not-found.js` stays as the fallback for the
 * dev-server case where the root layout isn't mounted.
 *
 * The copy is unchanged. The presentation is rebuilt from the same devices as
 * the rest of the site — left-aligned type on one margin, a hairline rule, the
 * ambient wash, teal as the "live/status" hue, and the cat treated as a figure
 * with a numbered caption rather than a rounded card. The previous version used
 * a gradient-clipped headline, a blurred purple orb and a dotted grid, none of
 * which appear on any other page.
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
				className="ambient-wash pointer-events-none absolute inset-x-0 top-0 h-[34rem]"
				aria-hidden="true"
			/>

			<main className="relative container mx-auto max-w-[1200px] px-4 pt-16 pb-20 sm:px-6 md:pt-24">
				<div className="animate-in fade-in slide-in-from-bottom-4 grid grid-cols-1 gap-x-16 gap-y-12 duration-700 ease-out lg:grid-cols-[minmax(0,1fr)_18rem]">
					<div className="max-w-2xl">
						{/* The status dot the hero uses, in the hue the site reserves
						    for "something ran and needs attention". */}
						<p className="flex items-center gap-2.5 text-sm text-muted-foreground">
							<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-hue-4" />
							Not found
						</p>

						<h1 className="mt-5 text-7xl leading-none font-bold tracking-tighter sm:text-8xl md:text-9xl">
							404
						</h1>

						{/* A monospace line is the one place a code fragment belongs;
						    no pill, no blur. The leading rule is the same hairline the
						    archive uses to separate rows. */}
						<p className="mt-6 border-l-2 border-hue-4 pl-4 font-mono text-sm text-muted-foreground">
							&gt; error: hallucination_detected
						</p>

						{/* The headline is a quotation, so it is set as one — serif and
						    italic, like the standfirst on an article. */}
						<h2 className="mt-10 font-serif text-2xl leading-snug italic text-foreground/85 md:text-3xl">
							&quot;Your model is hallucinating now...&quot;
						</h2>

						<p className="mt-5 text-lg leading-relaxed text-muted-foreground">
							We explicitly told the AI to{" "}
							<span className="font-semibold text-foreground italic">
								&quot;stick to the context info only&quot;
							</span>
							, but it decided to dream up this page anyway.
						</p>
						<p className="mt-4 text-sm text-muted-foreground/80 italic">
							(It probably thinks this page is real. It&rsquo;s not. Please
							forgive it.)
						</p>

						<div className="mt-10 flex flex-wrap gap-3">
							<Button
								asChild
								size="lg"
								className="rounded-full bg-indigo-600 px-7 font-semibold text-white hover:bg-indigo-700"
							>
								<Link href="/">Return to Reality</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								size="lg"
								className="rounded-full border-border px-6"
							>
								<Link href="/blog">
									<ArrowLeft className="h-4 w-4" aria-hidden="true" />
									Browse the archive
								</Link>
							</Button>
						</div>
					</div>

					{/* The meme is evidence, so it sits in the margin as a figure with
					    a caption — the same slot the article page gives its contents
					    rail. Grayscale at rest and in colour on hover, which was the
					    one idea in the old version worth keeping: the joke lands when
					    the cat looks normal until you look at it properly. */}
					<figure className="lg:pt-1">
						<div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
							<Image
								src="/cat_2.png"
								alt="AI Hallucination Meme"
								fill
								sizes="(min-width: 1024px) 18rem, 100vw"
								className="object-cover grayscale transition-[filter,transform] duration-700 hover:scale-[1.03] hover:grayscale-0"
							/>
							{/* The readout is the image's caption, so it is always legible
							    rather than a hover-only overlay. */}
							<div className="absolute inset-x-3 bottom-3 rounded-md bg-black/80 p-3 font-mono text-xs text-green-400">
								<div className="flex flex-col gap-1">
									<span>
										&gt; query_context:{" "}
										<span className="text-red-400">missing</span>
									</span>
									<span>
										&gt; logic_integrity:{" "}
										<span className="text-red-400">0%</span>
									</span>
									<span>
										&gt; hallucination_status:{" "}
										<span className="animate-pulse font-extrabold text-red-400">
											CRITICAL
										</span>
									</span>
								</div>
							</div>
						</div>
						<figcaption className="mt-3 flex items-baseline justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
							<span>Fig. 1 — A model, very confident, entirely wrong.</span>
							<span className="tabular-nums">02 / 02</span>
						</figcaption>
					</figure>
				</div>
			</main>
		</div>
	);
}
