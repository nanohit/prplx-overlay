import { app, BrowserWindow, systemPreferences } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"
import { attachPerplexityImage, sendPerplexityPromptWithAttachments } from "./PerplexityHelper"
import { SelectionHelper } from "./SelectionHelper"

type PerplexityModelKey = "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"

interface PerplexityPreferences {
  model: PerplexityModelKey
  webSearch: boolean
  shouldStartNewChat: boolean
}

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  private selectionHelper: SelectionHelper
  private hasShownScreenPermissionWarning: boolean = false

  // View management
  private view: "queue" | "solutions" = "queue"

  private problemInfo: {
    problem_statement: string
    input_format: Record<string, any>
    output_format: Record<string, any>
    constraints: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  } | null = null // Allow null

  private hasDebugged: boolean = false

  private pendingAttachment: { path: string; preview: string } | null = null

  private perplexityPreferences: PerplexityPreferences = {
    model: "sonar",
    webSearch: false,
    shouldStartNewChat: true
  }

  // Processing events
  public readonly PROCESSING_EVENTS = {
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

  constructor() {
    // Initialize WindowHelper with this
    this.windowHelper = new WindowHelper(this)

    // Initialize ScreenshotHelper
    this.screenshotHelper = new ScreenshotHelper(this.view)

    // Initialize ProcessingHelper
    this.processingHelper = new ProcessingHelper(this)

    // Initialize ShortcutsHelper
    this.shortcutsHelper = new ShortcutsHelper(this)

    // Initialize SelectionHelper
    this.selectionHelper = new SelectionHelper()
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  // Getters and Setters
  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow()
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible()
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper
  }

  public getProblemInfo(): any {
    return this.problemInfo
  }

  public setProblemInfo(problemInfo: any): void {
    this.problemInfo = problemInfo
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue()
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue()
  }

  // Window management methods
  public createWindow(): void {
    this.windowHelper.createWindow()
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow()
  }

  public showMainWindow(options?: { capture?: boolean }): void {
    this.windowHelper.showMainWindow(options ?? {})
  }

  public showPassiveOverlay(): void {
    this.windowHelper.showPassiveOverlay()
  }

  public triggerAutoSend(
    message: string,
    options: { model: PerplexityModelKey; shouldStartNewChat?: boolean; preservePreferences?: boolean }
  ): void {
    const mainWindow = this.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    this.updatePerplexityPreferences({
      model: options.model,
      shouldStartNewChat: options.shouldStartNewChat ?? true
    })

    mainWindow.webContents.send("perplexity-auto-send", {
      prompt: message,
      model: options.model,
      shouldStartNewChat: options.shouldStartNewChat,
      preservePreferences: options.preservePreferences ?? false
    })
  }

  public toggleMainWindow(): void {
    console.log(
      "Screenshots: ",
      this.screenshotHelper.getScreenshotQueue().length,
      "Extra screenshots: ",
      this.screenshotHelper.getExtraScreenshotQueue().length
    )
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()

    // Clear problem info
    this.problemInfo = null

    // Reset view to initial state
    this.setView("queue")

    this.pendingAttachment = null
  }

  public updatePerplexityPreferences(preferences: Partial<PerplexityPreferences>): void {
    this.perplexityPreferences = {
      ...this.perplexityPreferences,
      ...preferences
    }
  }

  public getPerplexityPreferences(): PerplexityPreferences {
    return { ...this.perplexityPreferences }
  }

  public getPendingAttachment(): { path: string; preview: string } | null {
    return this.pendingAttachment ? { ...this.pendingAttachment } : null
  }

  public clearPendingAttachment(): void {
    this.pendingAttachment = null
  }

  private async ensureScreenCapturePermission(): Promise<void> {
    if (process.platform !== "darwin") {
      return
    }

    const getMediaStatus = (systemPreferences as any).getMediaAccessStatus?.bind(systemPreferences)
    const askForMediaAccess = (systemPreferences as any).askForMediaAccess?.bind(systemPreferences)

    if (typeof getMediaStatus !== "function") {
      return
    }

    let status: string
    try {
      status = getMediaStatus("screen")
    } catch (error) {
      console.warn("Unable to query screen capture permission status:", error)
      return
    }

    if (status === "granted") {
      return
    }

    if (status === "not-determined" && typeof askForMediaAccess === "function") {
      try {
        const granted = await askForMediaAccess("screen")
        if (granted) {
          return
        }
        status = getMediaStatus("screen")
      } catch (error) {
        console.warn("Failed to request screen capture permission:", error)
        status = getMediaStatus("screen")
      }
    }

    if (status !== "granted") {
      const message =
        "Screen recording permission is required. Open System Settings → Privacy & Security → Screen Recording and enable \"Interview Coder\" (then restart the app)."

      const mainWindow = this.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("perplexity-attachment-error", message)
      }

      if (!this.hasShownScreenPermissionWarning) {
        this.hasShownScreenPermissionWarning = true
        console.warn(message)
      }

      throw new Error(message)
    }
  }

  // Screenshot management methods
  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    await this.ensureScreenCapturePermission()

    const screenshotPath = await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    )

    return screenshotPath
  }

  public async startCutScreenshotFlow(): Promise<{
    screenshotPath: string
    preview: string
  } | null> {
    const mainWindow = this.getMainWindow()
    if (!mainWindow) {
      console.warn("No main window for cut screenshot flow")
      return null
    }

    await this.ensureScreenCapturePermission()

    try {
      const selection = await this.selectionHelper.startSelection()
      if (!selection) {
        return null
      }

      // Small delay to ensure overlay windows are fully removed
      await this.delay(50)

      const screenshotPath = await this.screenshotHelper.captureRegion(selection)
      const preview = await this.getImagePreview(screenshotPath)

      this.pendingAttachment = { path: screenshotPath, preview }

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("perplexity-attachment-ready", {
          path: screenshotPath,
          preview
        })
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview,
          source: "cut-selection"
        })
      }

      await attachPerplexityImage(screenshotPath, {
        newChat: this.perplexityPreferences.shouldStartNewChat
      })

      if (this.perplexityPreferences.shouldStartNewChat) {
        this.perplexityPreferences.shouldStartNewChat = false
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send("perplexity-new-chat-started")
        }
      }

      return { screenshotPath, preview }

    } catch (error: any) {
      console.error("Cut screenshot flow failed:", error)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "perplexity-attachment-error",
          error?.message ?? String(error)
        )
      }
      throw error
    } finally {
    }
    return null
  }

  public async sendPendingAttachment(
    message: string,
    options?: { timeoutSeconds?: number }
  ): Promise<{ prompt: string; response: string; responses: string[] }> {
    const mainWindow = this.getMainWindow()
    if (!mainWindow) {
      throw new Error("Main window not available")
    }

    if (!this.pendingAttachment) {
      throw new Error("No pending attachment to send")
    }

    try {
      const normalizedMessage = message && message.trim().length > 0 ? message : "[image attached]"
      const result = await sendPerplexityPromptWithAttachments(normalizedMessage, {
        newChat: this.perplexityPreferences.shouldStartNewChat,
        model: this.perplexityPreferences.model,
        webSearch: this.perplexityPreferences.webSearch,
        timeoutSeconds: options?.timeoutSeconds
      })

      this.pendingAttachment = null
      if (this.perplexityPreferences.shouldStartNewChat) {
        this.perplexityPreferences.shouldStartNewChat = false
      }

      return result
    } catch (error) {
      throw error
    }
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path)
  }

  // New methods to move the window
  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft()
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight()
  }
  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown()
  }
  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp()
  }

  public centerAndShowWindow(): void {
    this.windowHelper.centerAndShowWindow()
  }

  public enterCaptureMode(): void {
    this.windowHelper.enterCaptureMode()
  }

  public exitCaptureMode(options?: {
    refocusSafari?: boolean
    keepVisible?: boolean
  }): void {
    this.windowHelper.exitCaptureMode(options ?? {})
  }

  public toggleCaptureMode(): void {
    this.windowHelper.togglePassiveMode()
  }

  public isCaptureModeActive(): boolean {
    return this.windowHelper.isCaptureModeActive()
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged
  }
}

// Application initialization
async function initializeApp() {
  const appState = AppState.getInstance()

  // Initialize IPC handlers before window creation
  initializeIpcHandlers(appState)

  app.whenReady().then(() => {
    console.log("App is ready")
    appState.createWindow()
    // Register global shortcuts using ShortcutsHelper
    appState.shortcutsHelper.registerGlobalShortcuts()
  })

  app.on("activate", () => {
    console.log("App activated")
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    }
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  // Keep the app visible in the Dock so users can relaunch/quit easily.
  if (process.platform === "darwin") {
    try {
      app.setActivationPolicy("regular")
      app.dock?.show()
    } catch (error) {
      console.warn("Failed to set macOS activation policy:", error)
    }
  }
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

// Start the application
initializeApp().catch(console.error)
