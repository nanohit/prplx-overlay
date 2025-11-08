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

    globalShortcut.register("CommandOrControl+Shift+Enter", async () => {
      await this.appState.processingHelper.processScreenshots()
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

    globalShortcut.register("CommandOrControl+B", () => {
      this.appState.toggleMainWindow()
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !this.appState.isVisible()) {
        if (process.platform === "darwin") {
          mainWindow.setAlwaysOnTop(true, "normal")
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setAlwaysOnTop(true, "floating")
            }
          }, 100)
        }
      }
    })

    // Model selection shortcuts
    globalShortcut.register("CommandOrControl+M", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "sonar")
    })

    globalShortcut.register("CommandOrControl+Comma", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "gpt-5")
    })

    globalShortcut.register("CommandOrControl+Period", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "gpt-5-reasoning")
    })

    globalShortcut.register("CommandOrControl+Slash", () => {
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
