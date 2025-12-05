import { AllContentBlock } from "@/types/content";
import { CodeComponent } from "./code-block";
import { DifficultyComponent } from "./difficulty-block";
import { ExplainationComponent } from "./explaination-block";
import { ExampleComponent } from "./example-block";
import { ImageComponent } from "./image-block";
import React from "react";
import { RelatedTopicsComponent } from "./related-topics-block";
import { SummaryComponent } from "./summary-block";
import { TitleComponent } from "./header-block";

//Registry
const BLOCK_REGISTRY: Record<string, React.FC<any>> = {
  header: TitleComponent,
  difficulty: DifficultyComponent,
  summary: SummaryComponent,
  content: CodeComponent,
  image: ImageComponent,
  //TODO : Adding Diagram Component after completing it in content.ts.
  explaination: ExplainationComponent,
  example: ExampleComponent,
  related_topics: RelatedTopicsComponent,
};

interface BlockRendererProps {
  block: AllContentBlock[];
}
