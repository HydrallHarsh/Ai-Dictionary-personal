import Image from "next/image";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isOptimizableImageSrc } from "@/lib/image-hosts";
import {
	createSlugger,
	nodeText,
	sanitizeArticleMarkdown,
} from "@/lib/markdown";

/**
 * The article body.
 *
 * Server-rendered. This was previously wrapped in a framer-motion section that
 * faded the whole article in on mount, which meant the text existed only after
 * hydration and arrived as one 20px lurch — an animation applied to a wall of
 * prose, where it costs legibility and buys nothing.
 *
 * Headings get anchor ids here rather than through `rehype-slug`, which isn't a
 * dependency. The slugger is the same one `extractHeadings` uses, created fresh
 * per render and walked in document order, so duplicate headings de-duplicate
 * identically in the contents rail and in the body.
 */

/** ~68 characters at this size — the measure prose is comfortable at. */
export const PROSE_CLASS = [
	"prose prose-neutral dark:prose-invert max-w-none",
	// Headings: tighter than the plugin's default, to match the rest of the site.
	"prose-headings:font-bold prose-headings:tracking-tight prose-headings:scroll-mt-24",
	"prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-2xl md:prose-h2:text-3xl",
	"prose-h3:mt-10 prose-h3:mb-3 prose-h3:text-lg md:prose-h3:text-xl",
	"prose-p:leading-relaxed prose-li:leading-relaxed",
	// Links carry the accent; underlined so they're not colour-only. `indigo-600`
	// rather than the `--brand` step: this is body-copy-sized text, which needs
	// 4.5:1, and indigo-500 on white is 4.4. The dark step is the token's.
	"prose-a:font-medium prose-a:text-indigo-600 prose-a:underline prose-a:underline-offset-4 dark:prose-a:text-indigo-400",
	"prose-strong:font-semibold",
	"prose-code:rounded prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal",
	"prose-code:before:content-none prose-code:after:content-none",
	"prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-secondary/50 prose-pre:text-foreground",
	"prose-blockquote:border-l-2 prose-blockquote:border-brand prose-blockquote:not-italic prose-blockquote:text-muted-foreground",
	"prose-hr:border-border",
	"prose-img:rounded-xl prose-img:border prose-img:border-border",
].join(" ");

function headingRenderer(level: 2 | 3, slugify: (text: string) => string) {
	return function MarkdownHeading({
		node,
		children,
		...props
	}: ComponentPropsWithoutRef<"h2"> & { node?: unknown }) {
		const id = slugify(nodeText(node));
		const Tag = level === 2 ? "h2" : "h3";

		return (
			<Tag id={id} {...props}>
				{/* A hover-revealed link so a section can be cited without hunting
				    for its id in the contents rail. */}
				<a
					href={`#${id}`}
					aria-label="Link to this section"
					className="float-left -ml-6 hidden w-6 text-muted-foreground no-underline opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 lg:block"
				>
					#
				</a>
				{children as ReactNode}
			</Tag>
		);
	};
}

export function ArticleBody({ markdown }: { markdown: string }) {
	const source = sanitizeArticleMarkdown(markdown);
	const slugify = createSlugger();

	return (
		<div className={PROSE_CLASS}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					h1: headingRenderer(2, slugify),
					h2: headingRenderer(2, slugify),
					h3: headingRenderer(3, slugify),
					// Tables in this corpus are wide enough to push the page sideways
					// on a phone; scroll them in their own box instead.
					table: ({ children, ...props }) => (
						<div className="not-prose my-8 overflow-x-auto rounded-xl border border-border">
							<table className="w-full text-left text-sm" {...props}>
								{children}
							</table>
						</div>
					),
					th: ({ children, ...props }) => (
						<th
							className="border-b border-border bg-secondary/40 px-4 py-2.5 font-medium"
							{...props}
						>
							{children}
						</th>
					),
					td: ({ children, ...props }) => (
						<td
							className="border-b border-border/60 px-4 py-2.5 align-top"
							{...props}
						>
							{children}
						</td>
					),
					a: ({ href, children, ...props }) => {
						const external = Boolean(href && /^https?:/i.test(href));
						return (
							<a
								href={href}
								// Untrusted outbound links from generated text.
								{...(external
									? { target: "_blank", rel: "noopener noreferrer nofollow" }
									: {})}
								{...props}
							>
								{children}
							</a>
						);
					},
					img: ({ src, alt }) => {
						if (!src || typeof src !== "string") {
							return null;
						}
						// The optimizer *throws at render* for a host it wasn't
						// configured with, so an arbitrary URL in generated markdown
						// would 500 the whole article. Anything off the allowlist gets
						// a plain tag: a worse image, but a page.
						if (!isOptimizableImageSrc(src)) {
							return (
								// biome-ignore lint/performance/noImgElement: deliberate fallback for un-allowlisted hosts
								<img
									src={src}
									alt={alt ?? ""}
									loading="lazy"
									className="my-8 h-auto w-full rounded-xl border border-border"
								/>
							);
						}
						return (
							<Image
								src={src}
								alt={alt ?? ""}
								width={1200}
								height={630}
								className="my-8 h-auto w-full rounded-xl border border-border"
							/>
						);
					},
				}}
			>
				{source}
			</ReactMarkdown>
		</div>
	);
}
