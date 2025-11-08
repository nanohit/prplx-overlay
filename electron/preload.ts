import { contextBridge, ipcRenderer } from "electron"

interface PerplexityResult {
  prompt: string
  response: string
  responses: string[]
}

interface PerplexityStreamUpdate {
  requestId: string | null
  response: string
  responses: string[]
  responseHtml: string | null
  responsesHtml: string[] | null
  timestamp: number
}

// Types for the exposed Electron API
interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string; source?: string }) => void
  ) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onFocusChatInput: (callback: () => void) => () => void
  onPerplexityAttachmentReady: (callback: (data: { path: string; preview: string }) => void) => () => void
  onPerplexityAttachmentError: (callback: (error: string) => void) => () => void
  onPerplexityNewChatStarted: (callback: () => void) => () => void
  onPerplexityStreamUpdate: (callback: (update: PerplexityStreamUpdate) => void) => () => void
  onModelShortcut: (
    callback: (model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning") => void
  ) => () => void
  onWebSearchToggle: (callback: () => void) => () => void
  takeScreenshot: () => Promise<void>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  forceOpenPerplexity: () => Promise<void>
  analyzeAudioFromBase64: (
    data: string,
    mimeType: string
  ) => Promise<{ text: string; timestamp: number }>
  analyzeAudioFile: (path: string) => Promise<{ text: string; timestamp: number }>
  analyzeImageFile: (path: string) => Promise<void>
  quitApp: () => Promise<void>

  perplexityChat: (
    prompt: string,
    options?: {
      newChat?: boolean
      model?: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"
      webSearch?: boolean
      requestId?: string
    }
  ) => Promise<PerplexityResult>
  perplexitySendPending: (message: string, options?: { timeoutSeconds?: number }) => Promise<PerplexityResult>
  
  // LLM Model Management
  getCurrentLlmConfig: () => Promise<{
    provider: "ollama" | "gemini"
    model: string
    isOllama: boolean
  }>
  getAvailableOllamaModels: () => Promise<string[]>
  switchToOllama: (model?: string, url?: string) => Promise<{ success: boolean; error?: string }>
  switchToGemini: (apiKey?: string) => Promise<{ success: boolean; error?: string }>
  testLlmConnection: () => Promise<{ success: boolean; error?: string }>
  updatePerplexityPreferences: (
    preferences: Partial<{
      model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"
      webSearch: boolean
      shouldStartNewChat: boolean
    }>
  ) => Promise<void>
  clearPendingAttachment: () => Promise<{ success: boolean }>
  
  invoke: (channel: string, ...args: any[]) => Promise<any>
}

export const PROCESSING_EVENTS = {
  //global states
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",

  //states for generating the initial solution
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",

  //states for processing the debugging
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

// Expose the Electron API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),

  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string; source?: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string; source?: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onSolutionsReady: (callback: (solutions: string) => void) => {
    const subscription = (_: any, solutions: string) => callback(solutions)
    ipcRenderer.on("solutions-ready", subscription)
    return () => {
      ipcRenderer.removeListener("solutions-ready", subscription)
    }
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onSolutionStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription)
    }
  },
  onDebugStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription)
    }
  },

  onDebugSuccess: (callback: (data: any) => void) => {
    ipcRenderer.on("debug-success", (_event, data) => callback(data))
    return () => {
      ipcRenderer.removeListener("debug-success", (_event, data) =>
        callback(data)
      )
    }
  },
  onDebugError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    }
  },
  onSolutionError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      )
    }
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  },

  onProblemExtracted: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      )
    }
  },
  onSolutionSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      )
    }
  },
  onUnauthorized: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    }
  },
  onFocusChatInput: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("focus-chat-input", subscription)
    return () => {
      ipcRenderer.removeListener("focus-chat-input", subscription)
    }
  },
  onPerplexityAttachmentReady: (callback: (data: { path: string; preview: string }) => void) => {
    const subscription = (_: any, data: { path: string; preview: string }) => callback(data)
    ipcRenderer.on("perplexity-attachment-ready", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-attachment-ready", subscription)
    }
  },
  onPerplexityAttachmentError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on("perplexity-attachment-error", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-attachment-error", subscription)
    }
  },
  onPerplexityNewChatStarted: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("perplexity-new-chat-started", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-new-chat-started", subscription)
    }
  },
  onPerplexityStreamUpdate: (callback: (update: PerplexityStreamUpdate) => void) => {
    const subscription = (_: any, update: PerplexityStreamUpdate) => callback(update)
    ipcRenderer.on("perplexity-stream-update", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-stream-update", subscription)
    }
  },
  onModelShortcut: (
    callback: (model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning") => void
  ) => {
    const subscription = (_: unknown, model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning") => callback(model)
    ipcRenderer.on("perplexity-model-shortcut", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-model-shortcut", subscription)
    }
  },
  onWebSearchToggle: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("perplexity-web-search-toggle", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-web-search-toggle", subscription)
    }
  },
  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),
  forceOpenPerplexity: () => ipcRenderer.invoke("force-open-perplexity"),
  analyzeAudioFromBase64: (data: string, mimeType: string) => ipcRenderer.invoke("analyze-audio-base64", data, mimeType),
  analyzeAudioFile: (path: string) => ipcRenderer.invoke("analyze-audio-file", path),
  analyzeImageFile: (path: string) => ipcRenderer.invoke("analyze-image-file", path),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  perplexityChat: (
    prompt: string,
    options?: {
      newChat?: boolean
      model?: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"
      webSearch?: boolean
      requestId?: string
    }
  ) => ipcRenderer.invoke("perplexity-chat", prompt, options),
  perplexitySendPending: (message: string, options?: { timeoutSeconds?: number }) => ipcRenderer.invoke("perplexity-send-pending", message, options),
  
  // LLM Model Management
  getCurrentLlmConfig: () => ipcRenderer.invoke("get-current-llm-config"),
  getAvailableOllamaModels: () => ipcRenderer.invoke("get-available-ollama-models"),
  switchToOllama: (model?: string, url?: string) => ipcRenderer.invoke("switch-to-ollama", model, url),
  switchToGemini: (apiKey?: string) => ipcRenderer.invoke("switch-to-gemini", apiKey),
  testLlmConnection: () => ipcRenderer.invoke("test-llm-connection"),
  updatePerplexityPreferences: (preferences: Partial<{ model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"; webSearch: boolean; shouldStartNewChat: boolean }>) => ipcRenderer.invoke("update-perplexity-preferences", preferences),
  clearPendingAttachment: () => ipcRenderer.invoke("clear-pending-attachment"),
  
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
} as ElectronAPI)
