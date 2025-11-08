import React from "react"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import clsx from "clsx"

interface MarkdownContentProps {
  content: string
  className?: string
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className
}) => {
  if (!content?.trim()) {
    return null
  }

  const components: Components = {
    code({ inline, className, children, ...props }: any) {
      const languageMatch = /language-(\w+)/.exec(className ?? "")
      if (!inline && languageMatch) {
        return (
          <SyntaxHighlighter
            language={languageMatch[1]}
            style={dracula as any}
            wrapLongLines
            customStyle={{
              margin: "0.5rem 0",
              background: "rgba(15, 21, 38, 0.55)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.8rem"
            }}
            {...props}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        )
      }

      return (
        <code className="rounded bg-white/10 px-[4px] py-[1px]" {...props}>
          {children}
        </code>
      )
    },
    table({ children, ...props }) {
      return (
        <div className="my-3 overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-sm text-gray-100" {...props}>
            {children}
          </table>
        </div>
      )
    },
    th({ children, ...props }) {
      return (
        <th
          className="bg-white/5 px-3 py-2 font-medium text-gray-50"
          {...props}
        >
          {children}
        </th>
      )
    },
    td({ children, ...props }) {
      return (
        <td className="px-3 py-2 text-gray-100/90" {...props}>
          {children}
        </td>
      )
    },
    p({ children, ...props }) {
      return (
        <p className="mb-3 last:mb-0 text-gray-100/90" {...props}>
          {children}
        </p>
      )
    },
    ul({ children, ...props }) {
      return (
        <ul
          className="mb-3 ml-5 list-disc space-y-1 text-gray-100/90"
          {...props}
        >
          {children}
        </ul>
      )
    },
    ol({ children, ...props }) {
      return (
        <ol
          className="mb-3 ml-5 list-decimal space-y-1 text-gray-100/90"
          {...props}
        >
          {children}
        </ol>
      )
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="border-l-2 border-blue-400/40 pl-4 text-gray-100/80"
          {...props}
        >
          {children}
        </blockquote>
      )
    }
  }

  return (
    <ReactMarkdown
      className={clsx(
        "prose prose-invert prose-sm max-w-none text-[13px] leading-[1.5] prose-headings:text-white prose-strong:text-white prose-a:text-blue-300 hover:prose-a:text-blue-200 prose-code:bg-white/10 prose-code:text-white prose-code:px-[3px] prose-code:py-[1px] prose-code:rounded prose-code:font-medium prose-blockquote:border-l-blue-500/50 prose-li:marker:text-blue-300",
        className
      )}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}

export default MarkdownContent

