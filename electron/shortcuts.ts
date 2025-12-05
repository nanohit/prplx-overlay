import { globalShortcut, app } from "electron"
import { AppState } from "./main" // Adjust the import path if necessary

export class ShortcutsHelper {
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  private emitWhenVisible(channel: string, payload?: any): void {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow || !this.appState.isVisible()) {
      return
    }
    mainWindow.webContents.send(channel, payload)
  }

  public registerGlobalShortcuts(): void {
    // Add global shortcut to show/center window
    globalShortcut.register("CommandOrControl+Shift+Space", () => {
      console.log("Show/Center window shortcut pressed...")
      this.appState.centerAndShowWindow()
    })

    globalShortcut.register("CommandOrControl+'", () => {
      const isVisible = this.appState.isVisible()
      const isCaptureMode = this.appState.isCaptureModeActive()

      if (!isVisible) {
        console.log("Overlay not visible. Entering active mode.")
        this.appState.showMainWindow({ capture: true })
        return
      }

      if (isCaptureMode) {
        console.log("Overlay active. Switching to passive mode.")
        this.appState.showPassiveOverlay()
      } else {
        console.log("Overlay passive. Entering active mode.")
        this.appState.enterCaptureMode()
      }
    })

    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow) {
        console.log("Taking screenshot...")
        try {
          const screenshotPath = await this.appState.takeScreenshot()
          const preview = await this.appState.getImagePreview(screenshotPath)
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        } catch (error) {
          console.error("Error capturing screenshot:", error)
        }
      }
    })

    globalShortcut.register("CommandOrControl+Enter", async () => {
      try {
        await this.appState.startCutScreenshotFlow()
      } catch (error) {
        console.error("Cut screenshot flow error:", error)
      }
    })

    const captureAndAutoSend = async (
      description: string,
      prompt: string,
      model: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"
    ) => {
      try {
        console.log(description)
        const capture = await this.appState.startCutScreenshotFlow()
        if (capture) {
          this.appState.triggerAutoSend(prompt, {
            model,
            shouldStartNewChat: true,
            preservePreferences: true
          })
        }
      } catch (error) {
        console.error(`${description} failed:`, error)
      } finally {
        this.appState.showPassiveOverlay()
      }
    }

    globalShortcut.register("CommandOrControl+Shift+Enter", async () => {
      await captureAndAutoSend(
        "Cmd+Shift+Enter pressed: capturing and sending via GPT-5.",
        "",
        "gpt-5"
      )
    })

    globalShortcut.register("CommandOrControl+'+Enter", async () => {
      await captureAndAutoSend(
        "Cmd+' then Enter pressed: capturing and sending via GPT-5 Reasoning.",
        "Реши. Think longer and harder.",
        "gpt-5-reasoning"
      )
    })

    globalShortcut.register("CommandOrControl+1", async () => {
      await captureAndAutoSend(
        "Cmd+1 pressed: quick capture to GPT-5.",
        "",
        "gpt-5"
      )
    })

    globalShortcut.register("CommandOrControl+2", async () => {
      await captureAndAutoSend(
        "Cmd+2 pressed: quick capture to GPT-5 Reasoning with think prompt.",
        "Реши. Think longer and harder.",
        "gpt-5-reasoning"
      )
    })

    globalShortcut.register("CommandOrControl+R", () => {
      console.log(
        "Command + R pressed. Canceling requests and resetting queues..."
      )

      // Cancel ongoing API requests
      this.appState.processingHelper.cancelOngoingRequests()

      // Clear both screenshot queues
      this.appState.clearQueues()

      console.log("Cleared queues.")

      // Update the view state to 'queue'
      this.appState.setView("queue")

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
      }
    })

    // New shortcuts for moving the window
    globalShortcut.register("CommandOrControl+Left", () => {
      if (!this.appState.isVisible()) return
      console.log("Command/Ctrl + Left pressed. Moving window left.")
      this.appState.moveWindowLeft()
    })

    globalShortcut.register("CommandOrControl+Right", () => {
      if (!this.appState.isVisible()) return
      console.log("Command/Ctrl + Right pressed. Moving window right.")
      this.appState.moveWindowRight()
    })

    globalShortcut.register("CommandOrControl+Shift+Down", () => {
      if (!this.appState.isVisible()) return
      console.log("Command/Ctrl + Shift + Down pressed. Moving window down.")
      this.appState.moveWindowDown()
    })

    globalShortcut.register("CommandOrControl+Up", () => {
      if (!this.appState.isVisible()) return
      console.log("Command/Ctrl + Up pressed. Moving window Up.")
      this.appState.moveWindowUp()
    })

    globalShortcut.register("CommandOrControl+Down", () => {
      console.log("Command/Ctrl + Down pressed. Toggling window visibility.")
      this.appState.toggleMainWindow()
    })

    // Model selection shortcuts
    globalShortcut.register("CommandOrControl+M", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "sonar")
    })

    globalShortcut.register("CommandOrControl+,", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "gpt-5")
    })

    globalShortcut.register("CommandOrControl+.", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "gpt-5-reasoning")
    })

    globalShortcut.register("CommandOrControl+/", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "claude-sonnet-4.5-reasoning")
    })

    globalShortcut.register("CommandOrControl+W", () => {
      this.emitWhenVisible("perplexity-web-search-toggle")
    })

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
