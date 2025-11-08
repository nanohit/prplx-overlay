import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useQuery } from "react-query"
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastVariant,
  ToastMessage
} from "../components/ui/toast"
import RichHtmlContent from "../components/ui/RichHtmlContent"

interface QueueProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

type ChatMessage = {
  role: "user" | "assistant" | "system"
  text: string
  html?: string | null
  htmlSegments?: string[] | null
  attachments?: Array<{ preview: string }>
  streaming?: boolean
  requestId?: string
}

type PerplexityModelKey = "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"

const PERPLEXITY_MODEL_LABELS: Record<PerplexityModelKey, string> = {
  sonar: "Sonar",
  "gpt-5": "GPT-5",
  "gpt-5-reasoning": "GPT-5 + Reasoning",
  "claude-sonnet-4.5-reasoning": "Claude Sonnet 4.5 + Reasoning"
}

const PERPLEXITY_MODEL_SHORTCUTS: Record<PerplexityModelKey, string> = {
  sonar: "⌘M",
  "gpt-5": "⌘,",
  "gpt-5-reasoning": "⌘.",
  "claude-sonnet-4.5-reasoning": "⌘/"
}

const INLINE_CODE_REGEX = /(`[^`]+`)/g

const THINK_SUFFIX = " Think longer and harder."

const renderMessageBlocks = (
  text: string,
  bodyTextClass: string,
  onCopy: (value: string) => void
) => {
  const blocks: Array<
    | { type: "code"; language: string; content: string }
    | { type: "list"; items: string[] }
    | { type: "paragraph"; content: string }
    | { type: "heading"; level: number; content: string }
  > = []

  const lines = text.split(/\r?\n/)
  let index = 0

  const flushParagraph = (buffer: string[]) => {
    if (buffer.length === 0) return
    blocks.push({ type: "paragraph", content: buffer.join("\n") })
    buffer.length = 0
  }

  const isListLine = (line: string) => /^[-*•]\s+/.test(line.trim())
  const isHeadingLine = (line: string) => /^(#{1,6})\s+/.test(line.trim())

  const paragraphBuffer: string[] = []

  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine ?? ""
    const trimmed = line.trim()

    if (trimmed.startsWith("```")) {
      flushParagraph(paragraphBuffer)
      const language = trimmed.slice(3).trim()
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !lines[index].trim().startsWith("```") ) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length && lines[index].trim().startsWith("```")) {
        index += 1
      }
      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n")
      })
      continue
    }

    if (trimmed === "") {
      flushParagraph(paragraphBuffer)
      index += 1
      continue
    }

    if (isHeadingLine(trimmed)) {
      flushParagraph(paragraphBuffer)
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/)
      if (match) {
        blocks.push({
          type: "heading",
          level: match[1].length,
          content: match[2]
        })
      }
      index += 1
      continue
    }

    if (isListLine(trimmed)) {
      flushParagraph(paragraphBuffer)
      const items: string[] = []
      while (index < lines.length && isListLine(lines[index])) {
        items.push(lines[index].trim().replace(/^[-*•]\s+/, ""))
        index += 1
      }
      blocks.push({ type: "list", items })
      continue
    }

    paragraphBuffer.push(line)
    index += 1
  }

  flushParagraph(paragraphBuffer)

  if (blocks.length === 0) {
    return [
      <p key="single" className={`text-xs leading-relaxed ${bodyTextClass}`}>
        {text}
      </p>
    ]
  }

  const renderInline = (content: string) => {
    const parts = content.split(INLINE_CODE_REGEX)
    return parts.map((part, idx) => {
      const isCode = part.startsWith("`") && part.endsWith("`") && part.length >= 2
      if (isCode) {
        return (
          <code
            key={`inline-${idx}`}
            className="font-mono text-[11px]"
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      return <React.Fragment key={`txt-${idx}`}>{part}</React.Fragment>
    })
  }

  return blocks.map((block, idx) => {
    if (block.type === "code") {
      const codeKey = `code-${idx}`
      return (
        <div key={codeKey} className="mt-1">
          <pre className="text-[11px] leading-5 font-mono whitespace-pre-wrap break-words">
            {block.content}
          </pre>
          <button
            type="button"
            className="overlay-code-copy mt-1 text-[10px] leading-none"
            onClick={() => onCopy(block.content)}
            title="Copy code"
          >
            Copy
          </button>
        </div>
      )
    }

    if (block.type === "list") {
      return (
        <ul key={`list-${idx}`} className={`list-disc pl-4 space-y-1 text-xs leading-relaxed ${bodyTextClass}`}>
          {block.items.map((item, itemIdx) => (
            <li key={`item-${idx}-${itemIdx}`} className="marker:text-gray-500">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
    }

    if (block.type === "heading") {
      const Tag = `h${Math.min(block.level, 6)}` as keyof JSX.IntrinsicElements
      return (
        <Tag
          key={`heading-${idx}`}
          className={`text-sm font-semibold mt-2 ${bodyTextClass}`}
        >
          {block.content}
        </Tag>
      )
    }

    return (
      <p key={`para-${idx}`} className={`text-xs leading-relaxed ${bodyTextClass}`}>
        {block.content.split(/\n+/).map((line, lineIdx, arr) => (
          <React.Fragment key={`line-${idx}-${lineIdx}`}>
            {renderInline(line)}
            {lineIdx < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    )
  })
}

const Queue: React.FC<QueueProps> = ({ setView }) => {
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  })

  const contentRef = useRef<HTMLDivElement>(null)
  const pendingDimensionsRef = useRef<{ width: number; height: number } | null>(null)

  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const streamingHtmlRef = useRef<Record<string, string[]>>({})
  const [chatLoading, setChatLoading] = useState(false)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const [shouldStartNewChat, setShouldStartNewChat] = useState(true)
  const [isThinkAppended, setIsThinkAppended] = useState(false)
  const [activeModelLabel, setActiveModelLabel] = useState<string | null>(null)
  const [perplexityModel, setPerplexityModel] = useState<PerplexityModelKey>("sonar")
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{ path: string; preview: string } | null>(null)
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false)
  const [attachedMessageIndexes, setAttachedMessageIndexes] = useState<number[]>([])
  const [attachmentSubmitting, setAttachmentSubmitting] = useState(false)
  const isStreaming = useMemo(() => chatMessages.some((msg) => msg.streaming), [chatMessages])

  const { data: screenshots = [], refetch } = useQuery<Array<{ path: string; preview: string }>, Error>(
    ["screenshots"],
    async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        return existing
      } catch (error) {
        console.error("Error loading screenshots:", error)
        showToast("Error", "Failed to load existing screenshots", "error")
        return []
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnWindowFocus: true,
      refetchOnMount: true
    }
  )

  useEffect(() => {
    void window.electronAPI.updatePerplexityPreferences({
      model: perplexityModel,
      webSearch: webSearchEnabled,
      shouldStartNewChat
    })
  }, [perplexityModel, webSearchEnabled, shouldStartNewChat])

  const showToast = useCallback(
    (title: string, description: string, variant: ToastVariant) => {
    if (variant === "neutral") {
      return
    }
    setToastMessage({ title, description, variant })
    setToastOpen(true)
    },
    []
  )

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch()
      } else {
        console.error("Failed to delete screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot file", "error")
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error)
    }
  }

  const handleChatSend = async () => {
    const trimmedInput = chatInput.trim()
    if (!trimmedInput && !pendingAttachment) return

    const requestModel = perplexityModel
    const modelLabel = PERPLEXITY_MODEL_LABELS[requestModel]

    const hasAttachment = Boolean(pendingAttachment)

    setChatMessages((msgs) => [
      ...msgs,
      {
        role: "user",
        text: trimmedInput,
        attachments: hasAttachment && pendingAttachment ? [{ preview: pendingAttachment.preview }] : undefined
      }
    ])
    if (hasAttachment) {
      const newIndex = chatMessages.length
      setAttachedMessageIndexes((prev) => (prev.includes(newIndex) ? prev : [...prev, newIndex]))
      setAttachmentSubmitting(true)
    }

    setChatLoading(true)
    setActiveModelLabel(modelLabel)
    setChatInput("")

    let activeRequestId: string | null = null

    try {
      if (pendingAttachment) {
        const result = await window.electronAPI.perplexitySendPending(trimmedInput, {})
        streamingHtmlRef.current = {}
        setPendingAttachment(null)
        setShowAttachmentPreview(false)
        setAttachmentSubmitting(false)
        void window.electronAPI.clearPendingAttachment()
        setChatMessages((msgs) => [
          ...msgs,
          {
            role: "assistant",
            text: result.response,
            html: result.responseHtml ?? null,
            htmlSegments: result.responsesHtml ?? null
          }
        ])
        setShouldStartNewChat(false)
        void window.electronAPI.updatePerplexityPreferences({ shouldStartNewChat: false })
        void refetch()
      } else {
        const requestId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
        activeRequestId = requestId
        streamingHtmlRef.current[requestId] = []

        setChatMessages((msgs) => [
          ...msgs,
          {
            role: "assistant",
            text: "",
            htmlSegments: [],
            requestId,
            streaming: true
          }
        ])

        const result = await window.electronAPI.perplexityChat(trimmedInput, {
          newChat: shouldStartNewChat,
          model: shouldStartNewChat ? requestModel : undefined,
          webSearch: webSearchEnabled,
          requestId
        })

        streamingHtmlRef.current[requestId] = result.responsesHtml ?? streamingHtmlRef.current[requestId] ?? []

        setChatMessages((msgs) =>
          msgs.map((msg) =>
            msg.requestId === requestId
              ? {
                  ...msg,
                  text: result.response,
                  html: result.responseHtml ?? msg.html ?? null,
                  htmlSegments: streamingHtmlRef.current[requestId] ?? msg.htmlSegments ?? null,
                  streaming: false
                }
              : msg
          )
        )
        setChatInput("")
        setShouldStartNewChat(false)
        void window.electronAPI.updatePerplexityPreferences({ shouldStartNewChat: false })
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err)
      if (activeRequestId) {
        setChatMessages((msgs) =>
          msgs.map((msg) =>
            msg.requestId === activeRequestId
              ? { ...msg, text: `Error: ${errorText}`, streaming: false }
              : msg
          )
        )
      } else {
        setChatMessages((msgs) => [...msgs, { role: "assistant", text: `Error: ${errorText}` }])
      }
      showToast("Perplexity Error", errorText, "error")
      setAttachmentSubmitting(false)
    } finally {
      setChatLoading(false)
      setActiveModelLabel(null)
      chatInputRef.current?.focus()
    }
    setIsThinkAppended(false)
  }

  const handlePerplexityNewChat = useCallback(() => {
    setChatMessages([])
    setShouldStartNewChat(true)
    setChatInput("")
    setIsThinkAppended(false)
    setPendingAttachment(null)
    setShowAttachmentPreview(false)
    setAttachedMessageIndexes([])
    setAttachmentSubmitting(false)
    streamingHtmlRef.current = {}
    void window.electronAPI.clearPendingAttachment()
    void window.electronAPI.updatePerplexityPreferences({ shouldStartNewChat: true })
    chatInputRef.current?.focus()
  }, [])

  const handleRemoveAttachment = useCallback(() => {
    setPendingAttachment(null)
    setShowAttachmentPreview(false)
    setAttachmentSubmitting(false)
    void window.electronAPI.clearPendingAttachment()
  }, [])

  const handleWebSearchToggle = useCallback(() => {
    setWebSearchEnabled((prev) => {
      const next = !prev
      setShouldStartNewChat(true)
      return next
    })
    setTimeout(() => chatInputRef.current?.focus(), 50)
  }, [])

  const handleModelSelect = useCallback(
    (model: PerplexityModelKey) => {
      if (perplexityModel === model && !shouldStartNewChat) return
      setPerplexityModel(model)
      setShouldStartNewChat(true)
    },
    [perplexityModel, shouldStartNewChat]
  )

  const handleForceConnect = useCallback(async () => {
    try {
      await window.electronAPI.invoke("force-open-perplexity")
      setToastMessage({
        title: "Opening Safari",
        description: "Connecting to perplexity.ai…",
        variant: "neutral"
      })
      setToastOpen(true)
    } catch (error) {
      console.error("Failed to open Perplexity in Safari:", error)
      setToastMessage({
        title: "Safari error",
        description: "Не удалось открыть perplexity.ai в Safari",
        variant: "error"
      })
      setToastOpen(true)
    }
  }, [])

  const handleCopyMessage = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        showToast("Copied", "Message copied to clipboard.", "neutral")
      } catch (error) {
        console.error("Clipboard copy failed:", error)
        showToast("Clipboard Error", "Could not copy message.", "error")
      }
    },
    [showToast]
  )

  useEffect(() => {
    const unsubscribe = window.electronAPI.onPerplexityStreamUpdate((update) => {
      if (!update) return
      setChatMessages((messages) => {
        if (messages.length === 0) return messages

        let targetIndex = -1
        if (update.requestId) {
          targetIndex = messages.findIndex((msg) => msg.requestId === update.requestId)
        }
        if (targetIndex === -1) {
          for (let idx = messages.length - 1; idx >= 0; idx--) {
            if (messages[idx].role === "assistant") {
              targetIndex = idx
              break
            }
          }
        }
        if (targetIndex === -1) return messages

        const target = messages[targetIndex]
        if (target.role !== "assistant") return messages
        const requestId = update.requestId ?? target.requestId ?? "__default"
        const store = streamingHtmlRef.current
        const previousSegments = store[requestId] ?? target.htmlSegments ?? []
        const incomingSegments = Array.isArray(update.responsesHtml) ? update.responsesHtml : []

        if (incomingSegments.length === 0 && (!update.responseHtml || !update.responseHtml.trim())) {
          return messages
        }

        let mergedSegments: string[] = previousSegments.slice()

        for (let i = 0; i < incomingSegments.length; i++) {
          const nextSegment = incomingSegments[i] ?? ""
          if (!nextSegment) continue
          if (!mergedSegments[i]) {
            mergedSegments.push(nextSegment)
            continue
          }
          if (mergedSegments[i] !== nextSegment) {
            mergedSegments = mergedSegments.slice(0, i)
            mergedSegments.push(nextSegment)
            for (let j = i + 1; j < incomingSegments.length; j++) {
              const candidate = incomingSegments[j]
              if (candidate && candidate.trim()) {
                mergedSegments.push(candidate)
              }
            }
            break
          }
        }

        store[requestId] = mergedSegments

        const next = messages.slice()
        next[targetIndex] = {
          ...target,
          text: update.response,
          html: update.responseHtml ?? target.html ?? null,
          htmlSegments: mergedSegments,
          streaming: true
        }
        return next
      })
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const updateDimensions = () => {
      if (!contentRef.current) return
      const contentHeight = contentRef.current.scrollHeight
      const contentWidth = contentRef.current.scrollWidth
      const dimensions = { width: contentWidth, height: contentHeight }

      if (isStreaming) {
        pendingDimensionsRef.current = dimensions
        return
      }

      pendingDimensionsRef.current = null
      void window.electronAPI.updateContentDimensions(dimensions)
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your screenshots.",
          "error"
        )
        setView("queue")
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no screenshots to process.",
          "neutral"
        )
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [refetch, showToast, setView, isStreaming])

  useEffect(() => {
    if (!isStreaming && pendingDimensionsRef.current) {
      void window.electronAPI.updateContentDimensions(pendingDimensionsRef.current)
      pendingDimensionsRef.current = null
    }
  }, [isStreaming])

  useEffect(() => {
    const unsubscribeReady = window.electronAPI.onPerplexityAttachmentReady((data) => {
      setPendingAttachment(data)
      setChatInput((prev) => prev)
      setChatLoading(false)
      setActiveModelLabel(null)
      setShowAttachmentPreview(false)
      setAttachmentSubmitting(false)
      setTimeout(() => chatInputRef.current?.focus(), 80)
      void refetch()
    })

    const unsubscribeError = window.electronAPI.onPerplexityAttachmentError((error) => {
      setPendingAttachment(null)
      setShowAttachmentPreview(false)
      setAttachmentSubmitting(false)
      showToast("Attachment Failed", error || "Could not attach screenshot", "error")
      setChatLoading(false)
      setActiveModelLabel(null)
      setTimeout(() => chatInputRef.current?.focus(), 80)
    })

    const unsubscribeNewChatStarted = window.electronAPI.onPerplexityNewChatStarted(() => {
      setShouldStartNewChat(false)
      void window.electronAPI.updatePerplexityPreferences({ shouldStartNewChat: false })
    })

    return () => {
      unsubscribeReady && unsubscribeReady()
      unsubscribeError && unsubscribeError()
      unsubscribeNewChatStarted && unsubscribeNewChatStarted()
    }
  }, [refetch, showToast])

  // Seamless screenshot-to-LLM flow
  useEffect(() => {
    const unsubscribe = window.electronAPI.onScreenshotTaken(async (data) => {
      await refetch()

      if (data?.source === "cut-selection") {
        return
      }

      setChatLoading(true)
      try {
        const latest = data?.path || (Array.isArray(data) && data.length > 0 && data[data.length - 1]?.path)
        if (latest) {
          const response = await window.electronAPI.invoke("analyze-image-file", latest)
          setChatMessages((msgs) => [...msgs, { role: "assistant", text: response.text }])
        }
      } catch (err) {
        setChatMessages((msgs) => [...msgs, { role: "assistant", text: "Error: " + String(err) }])
      } finally {
        setChatLoading(false)
      }
    })
    return () => {
      unsubscribe && unsubscribe()
    }
  }, [refetch])

  useEffect(() => {
    if (!pendingAttachment) {
      setShowAttachmentPreview(false)
    }
  }, [pendingAttachment])

  const handleToggleThink = useCallback(() => {
    setChatInput((prev) => {
      const suffixIndex = prev.lastIndexOf(THINK_SUFFIX)
      if (isThinkAppended) {
        if (suffixIndex === -1) {
          setIsThinkAppended(false)
          return prev
        }
        const before = prev.slice(0, suffixIndex)
        const after = prev.slice(suffixIndex + THINK_SUFFIX.length)
        setIsThinkAppended(false)
        return `${before}${after}`
      }
      const base =
        suffixIndex !== -1
          ? prev.slice(0, suffixIndex) + prev.slice(suffixIndex + THINK_SUFFIX.length)
          : prev
      const nextValue = `${base}${THINK_SUFFIX}`
      setIsThinkAppended(true)
      return nextValue
    })
    setTimeout(() => chatInputRef.current?.focus(), 50)
  }, [isThinkAppended])

  const handleChatInputChange = useCallback(
    (value: string) => {
      setChatInput(value)
      const hasSuffixAtEnd = value.endsWith(THINK_SUFFIX)
      if (hasSuffixAtEnd !== isThinkAppended) {
        setIsThinkAppended(hasSuffixAtEnd)
      }
    },
    [isThinkAppended]
  )

  const chatPlaceholder = pendingAttachment
    ? "Screenshot captured — add context or press Enter to send"
    : "Input field..."

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const metaPressed = event.metaKey || event.ctrlKey
      if (!metaPressed) {
        return
      }

      if (event.shiftKey && event.code === "KeyN") {
        event.preventDefault()
        handlePerplexityNewChat()
        return
      }

      if (event.shiftKey && event.code === "ArrowDown") {
        event.preventDefault()
        return
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault()
        return
      }

      if (event.code === "ArrowRight") {
        event.preventDefault()
        return
      }

      if (event.code === "ArrowDown") {
        event.preventDefault()
        return
      }

      if (event.code === "ArrowUp") {
        event.preventDefault()
        return
      }

      if (event.code === "KeyM") {
        event.preventDefault()
        handleModelSelect("sonar")
        return
      }

      if (event.code === "Comma") {
        event.preventDefault()
        handleModelSelect("gpt-5")
        return
      }

      if (event.code === "Period") {
        event.preventDefault()
        handleModelSelect("gpt-5-reasoning")
        return
      }

      if (event.code === "Slash") {
        event.preventDefault()
        handleModelSelect("claude-sonnet-4.5-reasoning")
        return
      }

      if (event.code === "KeyW") {
        event.preventDefault()
        handleWebSearchToggle()
      }

      if (event.code === "KeyL") {
        event.preventDefault()
        handleToggleThink()
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handlePerplexityNewChat, handleModelSelect, handleWebSearchToggle, handleToggleThink])

  useEffect(() => {
    const timer = setTimeout(() => {
      chatInputRef.current?.focus()
    }, 120)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const unsubscribeFocus = window.electronAPI.onFocusChatInput(() => {
      setTimeout(() => chatInputRef.current?.focus(), 50)
    })

    const unsubscribeModel = window.electronAPI.onModelShortcut((model) => {
      handleModelSelect(model)
    })

    const unsubscribeWeb = window.electronAPI.onWebSearchToggle(() => {
      handleWebSearchToggle()
    })

    return () => {
      unsubscribeFocus && unsubscribeFocus()
      unsubscribeModel && unsubscribeModel()
      unsubscribeWeb && unsubscribeWeb()
  }
  }, [handleModelSelect, handleWebSearchToggle])

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        pointerEvents: "auto"
      }}
      className="select-none"
    >
      <div className="bg-transparent w-full">
        <div ref={contentRef} className="px-3 py-2">
          <Toast
            open={toastOpen}
            onOpenChange={setToastOpen}
            variant={toastMessage.variant}
            duration={3000}
          >
            <ToastTitle>{toastMessage.title}</ToastTitle>
            <ToastDescription>{toastMessage.description}</ToastDescription>
          </Toast>

          <div className="liquid-glass chat-container text-white mt-2 pb-3">
            <div className="sticky top-0 z-10 overlay-header px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(Object.keys(PERPLEXITY_MODEL_LABELS) as PerplexityModelKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleModelSelect(key)}
                      className={`overlay-button h-6 rounded-md px-1.5 text-[10px] leading-none tracking-wide ${
                        perplexityModel === key ? "overlay-button-active" : ""
                      }`}
                      title={`Select ${PERPLEXITY_MODEL_LABELS[key]} (${PERPLEXITY_MODEL_SHORTCUTS[key]})`}
                    >
                      {PERPLEXITY_MODEL_LABELS[key]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleToggleThink}
                    className={`overlay-button h-6 rounded-md px-2 text-[10px] ${
                      isThinkAppended ? "overlay-toggle-active" : ""
                    }`}
                    title="Toggle think prompt (⌘L)"
                  >
                    Think
                  </button>
                  <button
                    type="button"
                    onClick={handlePerplexityNewChat}
                    className="overlay-button h-6 w-6 flex items-center justify-center rounded-md text-sm font-medium leading-none"
                    title="Start a new chat (⌘⇧N)"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={handleForceConnect}
                    className="overlay-button h-6 rounded-md px-2 text-[10px]"
                    title="Open perplexity.ai in Safari"
                  >
                    Force Connect
                  </button>
                  <button
                    type="button"
                    onClick={handleWebSearchToggle}
                    className={`overlay-button h-6 rounded-md px-2 text-[10px] ${
                      webSearchEnabled ? "overlay-toggle-active" : ""
                    }`}
                    title="Toggle web search (⌘W)"
                  >
                    {webSearchEnabled ? "Web On" : "Web Off"}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-3 pt-3">
              {pendingAttachment && !attachmentSubmitting && (
                <div className="mb-2 w-full flex justify-start">
                  <div
                    className="relative chat-bubble flex items-center gap-2 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-white/40"
                    onMouseEnter={() => setShowAttachmentPreview(true)}
                    onMouseLeave={() => setShowAttachmentPreview(false)}
                    onFocus={() => setShowAttachmentPreview(true)}
                    onBlur={() => setShowAttachmentPreview(false)}
                    tabIndex={0}
                    style={{ wordBreak: "break-word" }}
                  >
                    <span className="font-medium text-white">[image attached]</span>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="overlay-button h-5 w-5 flex items-center justify-center rounded-md text-xs leading-none"
                      title="Remove attachment"
                    >
                      ×
                    </button>
                    {showAttachmentPreview && (
                      <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border border-white/20 bg-black/80 p-2 shadow-lg">
                        <img src={pendingAttachment.preview} alt="Screenshot preview" className="w-full rounded" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {chatMessages.length > 0 && (
                <div className="space-y-2">
                  {chatMessages.map((msg, idx) => {
                    const isUser = msg.role === "user"
                    const isSystem = msg.role === "system"
                    const isAssistant = !isUser && !isSystem
                    const alignmentClass = isUser ? "ml-auto text-right" : "mr-auto text-left"
                    const bodyTextClass = isUser
                      ? "text-white text-right"
                      : isSystem
                        ? "text-amber-200 text-left"
                        : "text-white text-left"
                    const showUserAttachmentBadge = Boolean(
                      msg.attachments && msg.attachments.length > 0 && isUser && attachedMessageIndexes.includes(idx)
                    )
                    const hasAssistantHtml = Boolean(isAssistant && msg.html)
                    const textBlocks =
                      !hasAssistantHtml && msg.text
                        ? renderMessageBlocks(msg.text, bodyTextClass, handleCopyMessage)
                        : null
                    const messageContent = hasAssistantHtml ? (
                      <RichHtmlContent
                        html={msg.html ?? ""}
                        segments={msg.htmlSegments}
                        className={bodyTextClass}
                      />
                    ) : (
                      textBlocks
                    )

                    return (
                      <div key={idx} className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`chat-bubble ${alignmentClass} w-full space-y-1 text-xs leading-relaxed select-text`}
                          style={{ wordBreak: "break-word", lineHeight: "1.45" }}
                        >
                          {showUserAttachmentBadge ? (
                            <div className="flex items-start gap-2">
                              <div
                                className="relative inline-flex cursor-pointer select-none rounded-sm bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white"
                                onMouseEnter={() => setShowAttachmentPreview(true)}
                                onMouseLeave={() => setShowAttachmentPreview(false)}
                              >
                                [image attached]
                                {showAttachmentPreview && (
                                  <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-white/20 bg-black/85 p-2 shadow-lg">
                                    <img
                                      src={msg.attachments![0].preview}
                                      alt="Attached screenshot"
                                      className="w-full rounded"
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 text-left">{messageContent}</div>
                            </div>
                          ) : (
                            <>{messageContent}</>
                          )}
                          {msg.attachments && msg.attachments.length > 0 && !isUser && (
                            <div className={`mt-2 grid gap-2 ${msg.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                              {msg.attachments.map((attachment, attIdx) => (
                                <div
                                  key={`${idx}-att-${attIdx}`}
                                  className="overflow-hidden rounded-md border border-white/15 bg-white/5"
                                >
                                  <img
                                    src={attachment.preview}
                                    alt="Attached screenshot"
                                    className="w-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {isAssistant && !msg.streaming && (
                            <button
                              type="button"
                              className="chat-copy-button text-[10px] leading-none"
                              onClick={() => handleCopyMessage(msg.text)}
                              title="Copy full answer"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {chatLoading && (
                <p className="mt-2 text-xs text-white/70">
                  {activeModelLabel || PERPLEXITY_MODEL_LABELS[perplexityModel]} typing...
                </p>
              )}
            </div>

            <div className="mt-3 px-4 pt-2">
              <form
                className="flex items-center gap-2 border-t overlay-divider pt-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleChatSend()
                }}
              >
                <input
                  ref={chatInputRef}
                  className="overlay-input flex-1 text-xs"
                  placeholder={chatPlaceholder}
                  value={chatInput}
                  onChange={(e) => handleChatInputChange(e.target.value)}
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  className="overlay-send flex h-8 w-8 items-center justify-center rounded-md"
                  disabled={chatLoading || (!chatInput.trim() && !pendingAttachment)}
                  tabIndex={-1}
                  aria-label="Send"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="white"
                    className="h-4 w-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Queue
