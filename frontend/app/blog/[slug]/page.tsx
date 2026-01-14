import { AllContentBlock } from "@/types/content";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { ScrollProgress } from "@/components/scroll-progress";

export const BLOG_DATABASE: Record<string, AllContentBlock[]> = {
	"introduction-to-deep-learning": [
		{
			id: "1",
			type: "title",
			data: {
				content:
					"Introduction to Deep Learning: Foundations & Modern Techniques",
				level: 1,
				tags: ["Deep Learning", "Neural Networks", "AI"],
				author: "Harsh (You)",
				date: "July 10, 2024",
				estimated_time: "8 min read",
				difficulty: "Beginner",
			} as any,
		},
		{
			id: "2",
			type: "summary",
			data: {
				content:
					"This guide explains the fundamentals of deep learning, neural network structures, and training techniques. Perfect for beginners looking to understand the core ideas behind modern AI.",
			},
		},
		{
			id: "3",
			type: "code",
			data: {
				language: "python",
				filename: "neural_net.py",
				content: `import numpy as np

class SimpleNeuralNet:
    def __init__(self, input_size, hidden_size, output_size):
        self.W1 = np.random.randn(input_size, hidden_size)
        self.W2 = np.random.randn(hidden_size, output_size)

    def forward(self, x):
        hidden = np.tanh(np.dot(x, self.W1))
        return np.dot(hidden, self.W2)

model = SimpleNeuralNet(3, 5, 1)
print(model.forward(np.array([1, 0.5, -1])))`,
			},
		},
		{
			id: "5",
			type: "image",
			data: {
				url: "/deep_learning.svg",
				caption: "Figure 1: Typical Neural Network Architecture",
				alt: "Diagram of a multi-layer neural network",
			},
		},
		{
			id: "4",
			type: "explanation",
			data: {
				content: `
        Deep learning models simulate how the human brain processes information. By stacking multiple layers, neural networks learn hierarchical representations, enabling them to excel at tasks like vision, speech, and language understanding.
        `,
			},
		},
		{
			id: "6",
			type: "related_topics",
			data: {
				topics: [
					"Neural Networks",
					"Activation Functions",
					"Gradient Descent",
					"Backpropagation",
				],
			},
		},
	],

	"cloud-architecture-basics": [
		{
			id: "1",
			type: "title",
			data: {
				content:
					"Cloud Architecture Basics: Understanding Compute, Storage & Networking",
				level: 1,
				tags: ["Cloud Computing", "AWS", "Azure", "GCP"],
				author: "Harsh (You)",
				date: "June 18, 2024",
				estimated_time: "7 min read",
				difficulty: "Beginner",
			} as any,
		},
		{
			id: "2",
			type: "summary",
			data: {
				content:
					"Learn the foundational components of cloud computing including compute services, storage solutions, and networking models across platforms like AWS, Azure, and GCP.",
			},
		},
		{
			id: "3",
			type: "code",
			data: {
				language: "yaml",
				filename: "aws_ec2.yaml",
				content: `Resources:
  MyEC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: t2.micro
      ImageId: ami-0abcdef1234567890`,
			},
		},
		{
			id: "5",
			type: "image",
			data: {
				url: "/cloud.svg",
				caption: "Figure 1: Cloud Infrastructure Overview",
				alt: "Illustration of cloud servers and networking",
			},
		},
		{
			id: "4",
			type: "explanation",
			data: {
				content: `
        Cloud architecture is built on a combination of compute power, scalable storage, and reliable networking. Understanding each component helps in designing resilient and efficient cloud systems.
        `,
			},
		},
		{
			id: "6",
			type: "related_topics",
			data: {
				topics: ["AWS EC2", "Load Balancers", "Containerization", "Kubernetes"],
			},
		},
	],

	"react-performance-optimizations": [
		{
			id: "1",
			type: "title",
			data: {
				content:
					"React Performance Optimizations: Boosting Speed & Reducing Renders",
				level: 1,
				tags: ["React", "Frontend", "Performance"],
				author: "Harsh (You)",
				date: "September 1, 2024",
				estimated_time: "9 min read",
				difficulty: "Intermediate",
			} as any,
		},
		{
			id: "2",
			type: "summary",
			data: {
				content:
					"A deep dive into improving React performance using memoization, virtualization, code-splitting, and intelligent state management.",
			},
		},
		{
			id: "3",
			type: "code",
			data: {
				language: "javascript",
				filename: "memo_example.js",
				content: `import React, { memo } from 'react';

const Card = memo(({ title }) => {
  console.log("Rendered");
  return <h3>{title}</h3>;
});

export default Card;`,
			},
		},
		{
			id: "5",
			type: "image",
			data: {
				url: "/react.svg",
				caption: "Figure 1: Frontend Code & Performance Concept",
				alt: "Coding on a laptop, representing frontend development",
			},
		},
		{
			id: "4",
			type: "explanation",
			data: {
				content: `
        React apps slow down when unnecessary renders occur. Tools like memo, useCallback, and dynamic imports help reduce overhead and ensure smoother user experiences.
        `,
			},
		},
		{
			id: "6",
			type: "related_topics",
			data: {
				topics: [
					"Virtual DOM",
					"React Hooks",
					"Code Splitting",
					"State Management",
				],
			},
		},
	],

	"sql-database-design-fundamentals": [
		{
			id: "1",
			type: "title",
			data: {
				content:
					"SQL Database Design Fundamentals: Schemas, Indexing & Normalization",
				level: 1,
				tags: ["SQL", "Databases", "Backend"],
				author: "Harsh (You)",
				date: "May 20, 2024",
				estimated_time: "12 min read",
				difficulty: "Intermediate",
			} as any,
		},
		{
			id: "2",
			type: "summary",
			data: {
				content:
					"A beginner-friendly explanation of how to design relational databases, including table structures, normalization, indexing, and query optimization.",
			},
		},
		{
			id: "3",
			type: "code",
			data: {
				language: "sql",
				filename: "schema.sql",
				content: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);`,
			},
		},
		{
			id: "5",
			type: "image",
			data: {
				url: "/sql.svg",
				caption: "Figure 1: Sample Relational Database Schema Visualization",
				alt: "Conceptual illustration of database tables and relationships",
			},
		},
		{
			id: "4",
			type: "explanation",
			data: {
				content: `
        Good database design improves performance and prevents data inconsistencies. Normalization reduces redundancy, while indexes allow faster query execution.
        `,
			},
		},
		{
			id: "6",
			type: "related_topics",
			data: {
				topics: [
					"Normalization",
					"SQL Joins",
					"Query Optimization",
					"Transactions",
				],
			},
		},
	],

	"foundations-of-cybersecurity": [
		{
			id: "1",
			type: "title",
			data: {
				content:
					"Foundations of Cybersecurity: Threats, Attacks & Defense Strategies",
				level: 1,
				tags: ["Cybersecurity", "Networking", "Ethical Hacking"],
				author: "Harsh (You)",
				date: "April 11, 2024",
				estimated_time: "11 min read",
				difficulty: "Intermediate",
			} as any,
		},
		{
			id: "2",
			type: "summary",
			data: {
				content:
					"A complete overview of modern cybersecurity: common attack types, prevention techniques, and security best practices for individuals and organizations.",
			},
		},
		{
			id: "3",
			type: "code",
			data: {
				language: "bash",
				filename: "nmap_scan.sh",
				content: `# Basic network scan using nmap
nmap -sV 192.168.1.0/24`,
			},
		},
		{
			id: "5",
			type: "image",
			data: {
				url: "/cybersecurity.svg",
				caption: "Figure 1: Cybersecurity Threat and Defense Concept",
				alt: "Illustration representing cybersecurity, locks, shields, and code",
			},
		},
		{
			id: "4",
			type: "explanation",
			data: {
				content: `
        Cybersecurity is the practice of protecting systems from attacks. Understanding threats like malware, phishing, and DoS attacks enables better defensive strategies.
        `,
			},
		},
		{
			id: "6",
			type: "related_topics",
			data: {
				topics: [
					"Encryption",
					"Firewalls",
					"Penetration Testing",
					"Zero Trust Architecture",
				],
			},
		},
	],
};

/**
 * Props for the BlogPostPage component.
 *
 * @property params - A Promise that resolves to route parameters for the dynamic blog post page.params are asynchronous to support streaming and server-side rendering optimizations.
 * @property params.slug - The URL slug that identifies which blog post to display.This value is extracted from the route path `/blog/[slug]`.
 */
interface PageProps {
	params: Promise<{
		slug: string;
	}>;
}
/**
 * Render the blog post page for a given route slug.
 *
 * @param params - Promise resolving to an object containing the route `slug`
 * @returns A React element that renders the post content for the specified `slug`, or a centered "404 - Blog Post Not Found" message when no post is found
 */
export default async function BlogPostPage({ params }: PageProps) {
	const { slug } = await params;
	const MOCK_DATA = BLOG_DATABASE[slug] || [];

	//Extracting title block for breadcrumbs
	const titleBlock = MOCK_DATA.find((b) => b.type === "title");
	const postTitle = titleBlock?.data.content ?? "Blog Post";

	return (
		<div className="min-h-screen bg-background text-foreground selection:bg-primary/10 selection:text-primary relative">
			<ScrollProgress />
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
					<span className="text-foreground font-medium max-w-[250px] truncate">
						{postTitle}
					</span>
				</nav>
				{/* Passing an empty array triggers the "No content" if-statement */}
				<BlockRenderer blocks={MOCK_DATA} />
			</main>
		</div>
	);
}
