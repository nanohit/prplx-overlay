import React, { useEffect, useMemo, useRef } from "react"
import clsx from "clsx"
import DOMPurify, { type Config as DOMPurifyConfig } from "dompurify"

interface RichHtmlContentProps {
  html?: string | null
  segments?: string[] | null
  className?: string
}

const MATHML_TAGS = [
  "math",
  "mrow",
  "mi",
  "mn",
  "mo",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "msqrt",
  "mroot",
  "mstyle",
  "mtable",
  "mtr",
  "mtd",
  "menclose",
  "mspace",
  "mtext",
  "semantics",
  "annotation",
  "munderover",
  "munder",
  "mover",
  "mpadded",
  "mphantom",
  "mfenced",
  "mlabeledtr",
  "mtd"
]

const SANITIZE_OPTIONS: DOMPurifyConfig = {
  ADD_TAGS: MATHML_TAGS,
  ADD_ATTR: [
    "style",
    "aria-hidden",
    "focusable",
    "data-mode",
    "encoding",
    "xmlns",
    "data-mjx-texclass"
  ],
  KEEP_CONTENT: true
}

const RichHtmlContent: React.FC<RichHtmlContentProps> = ({ html, segments, className }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousSegmentsRef = useRef<string[]>([])
  const previousHtmlRef = useRef<string>("")

  const sanitizedSegments = useMemo(() => {
    if (!segments || segments.length === 0) return null
    return segments.map((segment) =>
      segment && segment.trim() ? DOMPurify.sanitize(segment, SANITIZE_OPTIONS) : ""
    )
  }, [segments])

  const sanitizedHtml = useMemo(() => {
    if (sanitizedSegments && sanitizedSegments.length > 0) {
      return null
    }
    if (!html) return null
    const trimmed = html.trim()
    if (!trimmed) return null
    return DOMPurify.sanitize(trimmed, SANITIZE_OPTIONS)
  }, [html, sanitizedSegments])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (sanitizedSegments && sanitizedSegments.length > 0) {
      const previous = previousSegmentsRef.current
      const currentLength = sanitizedSegments.length
      const childNodes = container.children

      for (let i = 0; i < currentLength; i += 1) {
        const segment = sanitizedSegments[i]
        const previousSegment = previous[i]
        let child = childNodes[i] as HTMLElement | undefined

        if (!child) {
          child = document.createElement("div")
          container.appendChild(child)
        }

        if (segment !== previousSegment || !child.dataset.segmentIndex) {
          child.innerHTML = segment
          child.dataset.segmentIndex = String(i)
        }
      }

      while (container.children.length > currentLength) {
        container.removeChild(container.lastChild as ChildNode)
      }

      previousSegmentsRef.current = sanitizedSegments.slice()
      previousHtmlRef.current = ""
      return
    }

    if (!sanitizedHtml) {
      if (container.innerHTML !== "") {
        container.innerHTML = ""
      }
      previousSegmentsRef.current = []
      previousHtmlRef.current = ""
      return
    }

    if (previousHtmlRef.current !== sanitizedHtml) {
      container.innerHTML = sanitizedHtml
      previousHtmlRef.current = sanitizedHtml
    }
    previousSegmentsRef.current = []
  }, [sanitizedSegments, sanitizedHtml])

  if (!sanitizedSegments && !sanitizedHtml) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={clsx(
        "prose prose-invert prose-sm max-w-none text-[13px] leading-[1.5] prose-headings:text-white prose-strong:text-white prose-a:text-blue-300 hover:prose-a:text-blue-200 prose-code:bg-white/10 prose-code:text-white prose-code:px-[3px] prose-code:py-[1px] prose-code:rounded prose-code:font-medium prose-blockquote:border-l-blue-500/50 prose-li:marker:text-blue-300",
        className
      )}
    />
  )
}

export default RichHtmlContent

