export interface Block<T = any> {
	id: string;
	type: string;
	data: T;
}

export interface TitleBlock extends Block {
	type: "title";
	data: {
		content: string;
		date: string;
		tags?: string[];
		difficulty?: "beginner" | "intermediate" | "advanced";
		author?: string;
		estimated_time?: string;
	};
}

// export interface DifficulyBlock extends Block {
//     type: 'difficuly';
//     data: {
//         level: 'beginner' | 'intermediate' | 'advanced';
//         content: string
//
//     }
// }

export interface SummaryBlock extends Block {
	type: "summary";
	data: {
		content: string;
	};
}

export interface CodeBlock extends Block {
	type: "code";
	data: {
		content: string;
		language?: string;
		filename?: string;
	};
}

export interface ImageBlock extends Block {
	type: "image";
	data: {
		alt?: string;
		caption: string;
		url: string;
	};
}

export interface DiagramBlock extends Block {
	type: "diagram";
	data: {
		// Define diagram-specific fields here
		content: string;
		//TODO : I dont know for now, Will update later
	};
}

export interface ExplanationBlock extends Block {
	type: "explanation";
	data: {
		content: string;
	};
}

export interface ExampleBlock extends Block {
	type: "example";
	data: {
		content: string;
		title?: string;
	};
}

export interface RelatedTopicsBlock extends Block {
	type: "related_topics";
	data: {
		topics: string[]; //NEED TO USE THIS FOR LATER - Array<{ topic_name: string }> //TODO :  Need to add one IMP field topic_url later
	};
}

export type AllContentBlock =
	| TitleBlock
	| SummaryBlock
	| CodeBlock
	| ImageBlock
	| DiagramBlock
	| ExplanationBlock
	| ExampleBlock
	| RelatedTopicsBlock;
