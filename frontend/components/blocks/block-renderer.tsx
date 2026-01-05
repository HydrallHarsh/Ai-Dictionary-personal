import { AllContentBlock } from "@/types/content";
import { CodeComponent } from "./code-block";
// import { DifficultyComponent } from "./difficulty-block";
import { ExplanationComponent } from "./explanation-block";
import { ExampleComponent } from "./example-block";
import { ImageComponent } from "./image-block";
import React from "react";
import { RelatedTopicsComponent } from "./related-topics-block";
import { SummaryComponent } from "./summary-block";
import { TitleComponent } from "./header-block";
import Image from "next/image";

//Registry
const BLOCK_REGISTRY: Record<string, React.FC<any>> = {
	title: TitleComponent,
	// difficulty: DifficultyComponent,
	summary: SummaryComponent,
	code: CodeComponent,
	image: ImageComponent,
	//TODO : Adding Diagram Component after completing it in content.ts.
	explanation: ExplanationComponent,
	example: ExampleComponent,
	related_topics: RelatedTopicsComponent,
};

interface BlockRendererProps {
	blocks: AllContentBlock[];
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
	// Check if block is present or not
	if (!blocks || blocks.length === 0) {
		return (
			<main className="min-h-screen flex items-center justify-center">
				<div className="flex flex-col text-center">
					<h1 className="pb-8 text-2xl">
						No content available right now. Check back soon😓!
					</h1>
					<h2 className="text-xl">Working on it</h2>
					<Image
						src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZTB4ZDVvcWllaTl5czV5Zzh2azg5aDAyeTQxaWc3a2xjN3Bzb3NkciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif"
						alt="Cat working"
						className="mx-auto"
						width={400}
						height={400}
					/>
				</div>
			</main>
		);
	}

	return (
		<div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
			{blocks.map((block) => {
				const Component = BLOCK_REGISTRY[block.type];
				if (!Component) {
					// In Dev: Warn us so we can fix it
					if (process.env.NODE_ENV === "development") {
						return (
							<div
								key={block.id}
								className="p-4 border border-red-500 bg-red-500/10 text-red-500 rounded my-4"
							>
								⚠️ Unknown Block Type: <strong>{block.type}</strong>
							</div>
						);
					}
					// In Prod: Hide it gracefully
					return null;
				}
				return <Component key={block.id} {...block.data} />;
			})}
		</div>
	);
}
