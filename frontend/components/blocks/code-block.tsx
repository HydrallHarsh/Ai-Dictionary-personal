import { CodeBlock } from "@/types/content";
import { codeToHtml } from "shiki";
import { CodeBlockClient } from "./code-block-client";

type Props = CodeBlock["data"];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function CodeComponent({ content, language, filename }: Props) {
  try {
    const html = await codeToHtml(content, {
      lang: language || "text",
      theme: "one-dark-pro",
    });
    return <CodeBlockClient html={html} filename={filename} />;
  } catch (e) {
    console.error("Error generating code block HTML:", e);
    const escapedContent = escapeHtml(content);
    // Very rare case when shiki fails, fallback to escaped content
    return (
      <CodeBlockClient
        html={`<pre><code>${escapedContent}</code></pre>`}
        filename={filename}
      />
    );
  }
}
