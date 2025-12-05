export interface Block<T = any> {
    id: string;
    type: string;
    data: T
}

export interface TitleBlock extends Block {
    type: 'title';
    data: {
        content: string,
    }
}

export interface DifficulyBlock extends Block {
    type: 'difficuly';
    data: {
        level: 'beginner' | 'intermediate' | 'advanced';
        content: string
        estimated_time?: string
    }
}

export interface SummaryBlock extends Block {
    type: 'summary';
    data: {
        content: string
    }
}

export interface CodeBlock extends Block {
    type: 'code';
    data: {
        content: string
        language?: string
    }
}

export interface ImageBlock extends Block {
    type: 'image';
    data: {
        alt?: string
        caption: string
        url: string
    }
}

export interface DiagramBlock extends Block {
    type: 'diagram',
    data: {
        //TODO : I dont know for now, Will update later
    }
}

export interface ExplainationBlock extends Block {
    type: 'explaination';
    data: {
        content: string
    }
}

export interface ExampleBlock extends Block {
    type: 'example';
    data: {
        content: string,
        title?: string
    }
}

export interface RelatedTopicsBlock extends Block {
    type: 'related_topics';
    data: {
        topics: Array<{ topic_name: string, link: string }>
    }
}

export type AllContentBlock =
    TitleBlock | SummaryBlock | CodeBlock | ImageBlock | DiagramBlock | ExplainationBlock | ExampleBlock | RelatedTopicsBlock | DifficulyBlock;