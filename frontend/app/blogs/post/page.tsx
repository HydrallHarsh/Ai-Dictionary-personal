"use client";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import Navbar from "@/components/Navbar";
import { AllContentBlock } from "@/types/content";
import { motion, useScroll, useSpring } from "framer-motion";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

const MOCK_DATA: AllContentBlock[] = [
  {
    id: "1",
    type: "title", // Maps to TitleComponent
    data: {
      content: "Understanding Advanced AI Agents: Architecture & Implementation",
      level: 1,
      tags: ["System Design", "LLMs", "AI Agents"],
      author: "Harsh (You)",
      date: new Date("2024-08-15"),
      readTime: "10 min read",
      difficulty: "Intermediate"
    } as any // Cast because our base type is strict, but we extended the component
  },
  {
    id: "2",
    type: "summary", // Maps to SummaryComponent
    data: {
      content: "A comprehensive guide to building, deploying, and optimizing autonomous AI agents. We'll explore the architecture, decision-making processes, and real-world applications that make these systems powerful tools for automation."
    }
  },
  {
    id: "3",
    type: "code", // Maps to CodeComponent
    data: {
      language: "python",
      // filename: "agent_config.py",
      content: `class Agent:
    def __init__(self, name, model):
        self.name = name
        self.model = model
        self.memory = []

    def think(self, context):
        # Process context
        plan = self.model.generate(context)
        return plan`
    }
  },
  
  {
    id: "5",
    type: "image", // Maps to ImageComponent
    data: {
      url: "/ai_logo_page_1.svg",
      caption: "Figure 1: AI Agent Architecture Overview",
      alt: "Diagram showing the architecture of an AI agent"
    }
  },
  {
    id: "4",
    type: "explanation", // Maps to ExplanationComponent
    data: {
      content: `
      The Agent class serves as the blueprint for creating autonomous AI agents. Each agent is initialized with a name and a language model that drives its decision-making process. The think method allows the agent to process contextual information and generate a plan of action using its underlying model. This modular design enables flexibility in defining various types of agents with different capabilities and behaviors.`
    }
  },
  {
    id: "6",
    type: "related_topics", // Maps to RelatedTopicsComponent
    data: {
      topics: ["Reinforcement Learning", "Natural Language Processing", "Computer Vision", "Robotics"]
    }
  }
];


export default function Page() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 20,
    restDelta: 0.001,
  });
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10 selection:text-primary relative">
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-60"
        style={{ scaleX }}
      />

      <Navbar />
      <main className="container mx-auto px-4 pb-20 max-w-4xl">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground py-8 overflow-x-auto whitespace-nowrap">
          <Link
            href="/"
            className="hover:text-primary transition-colors flex items-center gap-1"
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/blog" className="hover:text-primary transition-colors">
            Blog
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">
            Understanding Advanced AI Agents
          </span>
        </nav>
        {/* Passing an empty array triggers the "No content" if-statement */}
        <BlockRenderer blocks={MOCK_DATA} />
      </main>
    </div>
  );
}
