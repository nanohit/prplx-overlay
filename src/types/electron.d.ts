export interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (callback: (data: { path: string; preview: string; source?: string }) => void) => () => void
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
  onDebugError: (callback: (error: string) => void) => () => void
  takeScreenshot: () => Promise<void>
  onOverlayCaptureModeChange: (callback: (active: boolean) => void) => () => void
  onPerplexityAttachmentReady: (callback: (data: { path: string; preview: string }) => void) => () => void
  onPerplexityAttachmentError: (callback: (error: string) => void) => () => void
  onPerplexityNewChatStarted: (callback: () => void) => () => void
  onPerplexityStreamUpdate: (
    callback: (
      update: {
        requestId: string | null
        response: string
        responses: string[]
        responseHtml: string | null
        responsesHtml: string[] | null
        timestamp: number
      }
    ) => void
  ) => () => void
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  forceOpenPerplexity: () => Promise<void>
  onFocusChatInput: (callback: () => void) => () => void
  onModelShortcut: (
    callback: (model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning") => void
  ) => () => void
  onWebSearchToggle: (callback: () => void) => () => void
  onPerplexityAutoSend: (
    callback: (payload: {
      prompt: string
      model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"
      shouldStartNewChat?: boolean
      preservePreferences?: boolean
    }) => void
  ) => () => void
  analyzeAudioFromBase64: (data: string, mimeType: string) => Promise<{ text: string; timestamp: number }>
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
  ) => Promise<{
    prompt: string
    response: string
    responses: string[]
    responseHtml?: string | null
    responsesHtml?: string[]
  }>
  perplexitySendPending: (message: string, options?: { timeoutSeconds?: number }) => Promise<{
    prompt: string
    response: string
    responses: string[]
    responseHtml?: string | null
    responsesHtml?: string[]
  }>
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

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
} 