import { BrowserWindow, BrowserWindowConstructorOptions, Display, ipcMain, screen } from "electron"

export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

interface SelectionDebugInfo {
  devicePixelRatio: number
  firstPointClient: { x: number; y: number }
  secondPointClient: { x: number; y: number } | null
  firstPointScreen: { x: number; y: number }
  secondPointScreen: { x: number; y: number } | null
  selectionBoxClientRect: { x: number; y: number; width: number; height: number }
}

export interface SelectionResult {
  displayId: number
  displayIndex: number
  scaleFactor: number
  rect: SelectionRect
  displaySize: { width: number; height: number }
  displayBounds: { x: number; y: number; width: number; height: number }
  debug?: SelectionDebugInfo
}

type SelectionCompletePayload = {
  displayId: number
  displayIndex: number
  scaleFactor: number
  rect: SelectionRect
  displaySize: { width: number; height: number }
  displayBounds: { x: number; y: number; width: number; height: number }
  debug?: SelectionDebugInfo
}

type SelectionMode = "idle" | "active"

export class SelectionHelper {
  private windows: BrowserWindow[] = []
  private mode: SelectionMode = "idle"
  private completion: { resolve: (value: SelectionResult | null) => void; reject: (reason?: any) => void } | null = null
  private activeDisplays: Display[] = []
  private isClosing = false

  private handleSelectionComplete = (_event: Electron.IpcMainEvent, payload: SelectionCompletePayload) => {
    if (this.mode !== "active") return

    const displayIndex = typeof payload.displayIndex === "number" ? payload.displayIndex : this.activeDisplays.findIndex((display) => display.id === payload.displayId)

    const result: SelectionResult = {
      displayId: payload.displayId,
      displayIndex: displayIndex >= 0 ? displayIndex : 0,
      scaleFactor: payload.scaleFactor,
      rect: payload.rect,
      displaySize: payload.displaySize,
      displayBounds: payload.displayBounds,
      debug: payload.debug
    }

    if (payload.debug) {
      console.debug("[SelectionHelper] selection debug payload", {
        displayId: payload.displayId,
        displayIndex,
        debug: payload.debug
      })
    }

    void this.finishSelection(result)
  }

  private handleSelectionCancel = () => {
    if (this.mode !== "active") return
    void this.finishSelection(null)
  }

  public async startSelection(): Promise<SelectionResult | null> {
    if (this.mode === "active") {
      return Promise.reject(new Error("Selection already in progress"))
    }

    const displays = screen.getAllDisplays()
    if (!displays.length) {
      return null
    }

    this.mode = "active"
    this.activeDisplays = displays

    return new Promise<SelectionResult | null>((resolve, reject) => {
      this.completion = { resolve, reject }

      ipcMain.on("selection-complete", this.handleSelectionComplete)
      ipcMain.on("selection-cancel", this.handleSelectionCancel)

      try {
        this.createSelectionWindows(displays)
      } catch (error) {
        void this.finishSelection(null, error)
      }
    })
  }

  private createSelectionWindows(displays: Display[]): void {
    const windowOptions: Omit<BrowserWindowConstructorOptions, "x" | "y" | "width" | "height"> = {
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      fullscreenable: false,
      show: true,
      focusable: true,
      hasShadow: false,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    }

    displays.forEach((display, index) => {
      const bounds = display.bounds
      const config = {
        displayId: display.id,
        displayIndex: index,
        scaleFactor: display.scaleFactor ?? 1,
        width: bounds.width,
        height: bounds.height,
        boundsX: bounds.x,
        boundsY: bounds.y
      }

      const win = new BrowserWindow({
        ...windowOptions,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      })

      win.setAlwaysOnTop(true, "screen-saver")
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      win.setContentProtection(true)
      win.setIgnoreMouseEvents(false)
      win.focus()

      const html = this.buildSelectionHtml(config)
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch((error) => {
        console.error("Failed to load selection overlay:", error)
        void this.finishSelection(null, error)
      })

      win.on("closed", () => {
        this.windows = this.windows.filter((existing) => existing !== win)
        if (!this.windows.length && this.mode === "active" && !this.isClosing) {
          this.handleSelectionCancel()
        }
      })

      this.windows.push(win)
    })
  }

  private buildSelectionHtml(config: {
    displayId: number
    displayIndex: number
    scaleFactor: number
    width: number
    height: number
    boundsX: number
    boundsY: number
  }): string {
    const payload = encodeURIComponent(JSON.stringify(config))

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Selection Overlay</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(24, 39, 77, 0.12);
        cursor: crosshair;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
      }
      #instruction {
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 16px;
        border-radius: 9999px;
        background: rgba(12, 18, 32, 0.65);
        color: #f5f7ff;
        font-size: 14px;
        letter-spacing: 0.02em;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);
      }
      .dot {
        position: fixed;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #6aa8ff;
        border: 2px solid rgba(255, 255, 255, 0.95);
        box-shadow: 0 0 0 6px rgba(106, 168, 255, 0.2), 0 8px 24px rgba(31, 93, 255, 0.4);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      #selection-box {
        position: fixed;
        border: 1px solid rgba(106, 168, 255, 0.95);
        background: rgba(106, 168, 255, 0.15);
        box-shadow: 0 0 0 1px rgba(20, 40, 80, 0.35);
        pointer-events: none;
        display: none;
      }
    </style>
  </head>
  <body tabindex="0">
    <div id="instruction">Click first corner, then second corner</div>
    <div id="selection-box"></div>
    <script>
      const { ipcRenderer } = require('electron');
      const config = JSON.parse(decodeURIComponent('${payload}'));

      const dots = [];
      let firstPoint = null;
      let secondPoint = null;

      const instruction = document.getElementById('instruction');
      const selectionBox = document.getElementById('selection-box');

      function placeDot(point) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.left = point.client.x + 'px';
        dot.style.top = point.client.y + 'px';
        document.body.appendChild(dot);
        dots.push(dot);
      }

      function updateSelectionBox(currentPoint) {
        if (!firstPoint) return;
        const startX = firstPoint.client.x;
        const startY = firstPoint.client.y;
        const endX = currentPoint ? currentPoint.client.x : startX;
        const endY = currentPoint ? currentPoint.client.y : startY;
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        selectionBox.style.display = 'block';
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = Math.max(width, 1) + 'px';
        selectionBox.style.height = Math.max(height, 1) + 'px';
      }

      function buildPoint(event) {
        return {
          client: { x: event.clientX, y: event.clientY },
          screen: { x: event.screenX, y: event.screenY }
        };
      }

      function emitResult() {
        if (!firstPoint || !secondPoint) return;
        const x = Math.min(firstPoint.client.x, secondPoint.client.x);
        const y = Math.min(firstPoint.client.y, secondPoint.client.y);
        const width = Math.abs(firstPoint.client.x - secondPoint.client.x);
        const height = Math.abs(firstPoint.client.y - secondPoint.client.y);

        const selectionBoxRect = selectionBox.getBoundingClientRect();

        document.body.style.opacity = '0';

        ipcRenderer.send('selection-complete', {
          displayId: config.displayId,
          displayIndex: config.displayIndex,
          scaleFactor: config.scaleFactor,
          rect: {
            x,
            y,
            width,
            height
          },
          displaySize: {
            width: config.width,
            height: config.height
          },
          displayBounds: {
            x: config.boundsX,
            y: config.boundsY,
            width: config.width,
            height: config.height
          },
          debug: {
            devicePixelRatio: window.devicePixelRatio || 1,
            firstPointClient: firstPoint.client,
            secondPointClient: secondPoint.client,
            firstPointScreen: firstPoint.screen,
            secondPointScreen: secondPoint.screen,
            selectionBoxClientRect: {
              x: selectionBoxRect.x,
              y: selectionBoxRect.y,
              width: selectionBoxRect.width,
              height: selectionBoxRect.height
            }
          }
        });
      }

      document.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        const point = buildPoint(event);
        placeDot(point);

        if (!firstPoint) {
          firstPoint = point;
          updateSelectionBox(point);
          instruction.textContent = 'Click opposite corner';
          return;
        }

        if (!secondPoint) {
          secondPoint = point;
          updateSelectionBox(point);
          emitResult();
        }
      });

      document.addEventListener('mousemove', (event) => {
        if (firstPoint && !secondPoint) {
          updateSelectionBox({
            client: { x: event.clientX, y: event.clientY }
          });
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          ipcRenderer.send('selection-cancel');
        }
      });

      window.addEventListener('blur', () => {
        window.focus();
      });

      window.focus();
    </script>
  </body>
</html>`
  }

  private async closeAllWindows(): Promise<void> {
    const windowsToClose = [...this.windows]
    this.windows = []

    if (!windowsToClose.length) return

    await Promise.all(
      windowsToClose.map(
        (win) =>
          new Promise<void>((resolve) => {
            if (win.isDestroyed()) {
              resolve()
              return
            }

            win.once("closed", () => resolve())
            try {
              win.hide()
            } catch (err) {
              console.warn("Failed to hide selection window before close", err)
            }
            win.close()
          })
      )
    )
  }

  private async finishSelection(result: SelectionResult | null, error?: any): Promise<void> {
    if (this.isClosing && !error) {
      return
    }

    this.isClosing = true

    ipcMain.removeListener("selection-complete", this.handleSelectionComplete)
    ipcMain.removeListener("selection-cancel", this.handleSelectionCancel)

    const completion = this.completion
    this.completion = null

    try {
      await this.closeAllWindows()
    } catch (closeError) {
      error = error ?? closeError
    }

    this.mode = "idle"
    this.activeDisplays = []
    this.isClosing = false

    if (!completion) {
      return
    }

    if (error) {
      completion.reject(error)
    } else {
      completion.resolve(result)
    }
  }
}

