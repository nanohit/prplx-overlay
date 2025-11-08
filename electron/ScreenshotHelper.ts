// ScreenshotHelper.ts

import path from "node:path"
import fs from "node:fs"
import { app, screen } from "electron"
import { v4 as uuidv4 } from "uuid"
import screenshot from "screenshot-desktop"
import sharp from "sharp"
import { SelectionResult } from "./SelectionHelper"

export class ScreenshotHelper {
  private screenshotQueue: string[] = []
  private extraScreenshotQueue: string[] = []
  private readonly MAX_SCREENSHOTS = 5

  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  private view: "queue" | "solutions" = "queue"

  constructor(view: "queue" | "solutions" = "queue") {
    this.view = view

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

    // Create directories if they don't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir)
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir)
    }
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue
  }

  public getExtraScreenshotQueue(): string[] {
    return this.extraScreenshotQueue
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err)
      })
    })
    this.screenshotQueue = []

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }

  private async enqueueScreenshot(filePath: string): Promise<void> {
    const targetQueue = this.view === "queue" ? this.screenshotQueue : this.extraScreenshotQueue
    targetQueue.push(filePath)

    if (targetQueue.length > this.MAX_SCREENSHOTS) {
      const removedPath = targetQueue.shift()
      if (removedPath) {
        try {
          await fs.promises.unlink(removedPath)
        } catch (error) {
          console.error("Error removing old screenshot:", error)
        }
      }
    }
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
    try {
      hideMainWindow()
      
      // Add a small delay to ensure window is hidden
      await new Promise(resolve => setTimeout(resolve, 100))
      
      let screenshotPath = ""

      const directory = this.view === "queue" ? this.screenshotDir : this.extraScreenshotDir
      screenshotPath = path.join(directory, `${uuidv4()}.png`)
      await screenshot({ filename: screenshotPath })

      await this.enqueueScreenshot(screenshotPath)

      return screenshotPath
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw new Error(`Failed to take screenshot: ${error.message}`)
    } finally {
      // Ensure window is always shown again
      showMainWindow()
    }
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filepath)
      return `data:image/png;base64,${data.toString("base64")}`
    } catch (error) {
      console.error("Error reading image:", error)
      throw error
    }
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(path)
      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        )
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        )
      }
      return { success: true }
    } catch (error) {
      console.error("Error deleting file:", error)
      return { success: false, error: error.message }
    }
  }

  public async captureRegion(selection: SelectionResult): Promise<string> {
    const directory = this.view === "queue" ? this.screenshotDir : this.extraScreenshotDir
    const outputFile = path.join(directory, `${uuidv4()}.png`)

    const minDimensionPx = 2

    try {
      let capturedWithTargetDisplay = false

      console.debug("[ScreenshotHelper] captureRegion selection", {
        displayId: selection.displayId,
        displayIndex: selection.displayIndex,
        scaleFactor: selection.scaleFactor,
        rect: selection.rect,
        displayBounds: selection.displayBounds,
        displaySize: selection.displaySize,
        debug: selection.debug
      })

      const electronDisplays = screen.getAllDisplays()

      const debugInfo = selection.debug
      const overlayOffsetDipX = (() => {
        if (!debugInfo) return 0
        const deltas: number[] = []
        if (debugInfo.firstPointScreen && debugInfo.firstPointClient) {
          deltas.push(debugInfo.firstPointScreen.x - debugInfo.firstPointClient.x)
        }
        if (debugInfo.secondPointScreen && debugInfo.secondPointClient) {
          deltas.push(debugInfo.secondPointScreen.x - debugInfo.secondPointClient.x)
        }
        if (!deltas.length) return 0
        return deltas.reduce((sum, value) => sum + value, 0) / deltas.length
      })()

      const overlayOffsetDipY = (() => {
        if (!debugInfo) return 0
        const deltas: number[] = []
        if (debugInfo.firstPointScreen && debugInfo.firstPointClient) {
          deltas.push(debugInfo.firstPointScreen.y - debugInfo.firstPointClient.y)
        }
        if (debugInfo.secondPointScreen && debugInfo.secondPointClient) {
          deltas.push(debugInfo.secondPointScreen.y - debugInfo.secondPointClient.y)
        }
        if (!deltas.length) return 0
        return deltas.reduce((sum, value) => sum + value, 0) / deltas.length
      })()

      console.debug("[ScreenshotHelper] overlay offsets (dip)", {
        overlayOffsetDipX,
        overlayOffsetDipY
      })

      console.debug(
        "[ScreenshotHelper] electron displays",
        electronDisplays.map((display) => ({
          id: display.id,
          bounds: display.bounds,
          workArea: display.workArea,
          scaleFactor: display.scaleFactor
        }))
      )

      const candidateScreens = new Set<string | number>()
      const addCandidate = (value: string | number | null | undefined) => {
        if (value === null || value === undefined) return
        if (typeof value === "number") {
          if (!Number.isFinite(value)) return
          candidateScreens.add(value)
          candidateScreens.add(String(value))
          return
        }
        if (typeof value === "string" && value.trim().length > 0) {
          candidateScreens.add(value)
          const numeric = Number(value)
          if (!Number.isNaN(numeric)) {
            candidateScreens.add(numeric)
          }
        }
      }

      addCandidate(selection.displayId)
      addCandidate(
        typeof selection.displayId === "number" && Number.isFinite(selection.displayId)
          ? String(selection.displayId)
          : null
      )

      let availableDisplays: Array<{
        id: number | string
        name?: string
        width?: number | string
        height?: number | string
      }> | undefined

      try {
        availableDisplays = (await screenshot.listDisplays()) as Array<{
          id: number | string
          name?: string
          width?: number | string
          height?: number | string
        }>
      } catch (error) {
        console.warn("Failed to enumerate displays for screenshot", error)
      }

      if (Array.isArray(availableDisplays)) {
        console.debug(
          "[ScreenshotHelper] screenshot-desktop displays",
          availableDisplays.map((display, index) => ({
            index,
            id: display.id,
            width: display.width,
            height: display.height,
            name: display.name
          }))
        )
      }
      if (Array.isArray(availableDisplays) && availableDisplays.length > 0) {
        const matchById = availableDisplays.find((display) => {
          const id = display.id
          if (id === selection.displayId) return true
          if (typeof id === "string" && String(selection.displayId) === id) return true
          if (typeof id === "number" && typeof selection.displayId === "number") {
            return id === selection.displayId
          }
          const numericId = typeof id === "string" ? Number(id) : Number.NaN
          return Number.isFinite(numericId) && numericId === selection.displayId
        })

        if (matchById) {
          addCandidate(matchById.id)
        } else {
          const expectedWidth = Math.round(selection.displaySize.width * selection.scaleFactor)
          const expectedHeight = Math.round(selection.displaySize.height * selection.scaleFactor)
          const matchBySize = availableDisplays.find((display) => {
            const width =
              typeof display.width === "number" ? display.width : Number(display.width)
            const height =
              typeof display.height === "number" ? display.height : Number(display.height)
            return (
              Number.isFinite(width) &&
              Number.isFinite(height) &&
              Math.round(Number(width)) === expectedWidth &&
              Math.round(Number(height)) === expectedHeight
            )
          })
          if (matchBySize) {
            addCandidate(matchBySize.id)
          }
        }

        if (selection.displayIndex < availableDisplays.length) {
          addCandidate(availableDisplays[selection.displayIndex]?.id)
        }
      }

      let screenshotBuffer: Buffer | null = null

      console.debug("[ScreenshotHelper] candidate screens to try", Array.from(candidateScreens))

      for (const candidate of candidateScreens) {
        try {
          screenshotBuffer = (await screenshot({ screen: candidate })) as Buffer
          capturedWithTargetDisplay = true
          console.debug("[ScreenshotHelper] captured target display", { candidate })
          break
        } catch (error) {
          console.warn(`Failed to capture screen ${String(candidate)}; falling back`, error)
        }
      }

      if (!screenshotBuffer) {
        try {
          screenshotBuffer = (await screenshot()) as Buffer
          console.debug("[ScreenshotHelper] captured fallback full-desktop buffer")
        } catch (primaryError) {
          console.warn("Specific display capture failed, retrying without screen id", primaryError)
          screenshotBuffer = (await screenshot()) as Buffer
        }
        capturedWithTargetDisplay = false
      }

      if (!screenshotBuffer) {
        throw new Error("Failed to capture screenshot buffer")
      }

      const scaleFactor = selection.scaleFactor || 1
      const displayBounds = selection.displayBounds || {
        x: 0,
        y: 0,
        width: selection.displaySize.width,
        height: selection.displaySize.height
      }
      const image = sharp(screenshotBuffer)
      const metadata = await image.metadata()

      const fallbackDisplay = electronDisplays.find(
        (display) => display.id === selection.displayId
      )
      const baseDisplayWidth = Math.max(
        minDimensionPx,
        Math.round(selection.rect.width * Math.max(scaleFactor, 1))
      )
      const baseDisplayHeight = Math.max(
        minDimensionPx,
        Math.round(selection.rect.height * Math.max(scaleFactor, 1))
      )

      const maxWidth =
        metadata.width ??
        (capturedWithTargetDisplay
          ? Math.max(minDimensionPx, Math.round(selection.displaySize.width * scaleFactor))
          : baseDisplayWidth)
      const maxHeight =
        metadata.height ??
        (capturedWithTargetDisplay
          ? Math.max(minDimensionPx, Math.round(selection.displaySize.height * scaleFactor))
          : baseDisplayHeight)

      let left = 0
      let top = 0
      let width = baseDisplayWidth
      let height = baseDisplayHeight

      const selectionOriginDipX = selection.rect.x + overlayOffsetDipX
      const selectionOriginDipY = selection.rect.y + overlayOffsetDipY

      if (capturedWithTargetDisplay) {
        const baseWidth = selection.displaySize.width || maxWidth
        const baseHeight = selection.displaySize.height || maxHeight
        const effectiveScaleX =
          baseWidth > 0 && maxWidth > 0 ? maxWidth / baseWidth : Math.max(scaleFactor, 1)
        const effectiveScaleY =
          baseHeight > 0 && maxHeight > 0 ? maxHeight / baseHeight : Math.max(scaleFactor, 1)

        left = Math.round(selectionOriginDipX * effectiveScaleX)
        top = Math.round(selectionOriginDipY * effectiveScaleY)
        width = Math.round(selection.rect.width * effectiveScaleX)
        height = Math.round(selection.rect.height * effectiveScaleY)
      } else {
        const unionBounds = electronDisplays.reduce(
          (acc, display) => {
            const { x, y, width, height } = display.bounds
            return {
              minX: Math.min(acc.minX, x),
              minY: Math.min(acc.minY, y),
              maxX: Math.max(acc.maxX, x + width),
              maxY: Math.max(acc.maxY, y + height)
            }
          },
          electronDisplays.length
            ? {
                minX: electronDisplays[0].bounds.x,
                minY: electronDisplays[0].bounds.y,
                maxX: electronDisplays[0].bounds.x + electronDisplays[0].bounds.width,
                maxY: electronDisplays[0].bounds.y + electronDisplays[0].bounds.height
              }
            : { minX: 0, minY: 0, maxX: maxWidth, maxY: maxHeight }
        )

        const dipToScreenPoint =
          typeof (screen as any).dipToScreenPoint === "function"
            ? (screen as any).dipToScreenPoint.bind(screen)
            : null

        const unionOriginDip = { x: unionBounds.minX, y: unionBounds.minY }
        const topLeftDip = {
          x:
            (displayBounds?.x ?? fallbackDisplay?.bounds.x ?? 0) +
            selectionOriginDipX,
          y:
            (displayBounds?.y ?? fallbackDisplay?.bounds.y ?? 0) +
            selectionOriginDipY
        }
        const bottomRightDip = {
          x: topLeftDip.x + selection.rect.width,
          y: topLeftDip.y + selection.rect.height
        }

        const convertPoint = (point: { x: number; y: number }) => {
          if (dipToScreenPoint) {
            return dipToScreenPoint(null, point)
          }
          return point
        }

        const unionOriginScreen = convertPoint(unionOriginDip)
        const topLeftScreen = convertPoint(topLeftDip)
        const bottomRightScreen = convertPoint(bottomRightDip)

        left = Math.round(topLeftScreen.x - unionOriginScreen.x)
        top = Math.round(topLeftScreen.y - unionOriginScreen.y)
        width = Math.round(bottomRightScreen.x - topLeftScreen.x)
        height = Math.round(bottomRightScreen.y - topLeftScreen.y)

        if (!Number.isFinite(width) || width <= 0) {
          const fallbackScaleX =
            selection.displaySize.width > 0
              ? (metadata.width ?? selection.displaySize.width * scaleFactor) /
                selection.displaySize.width
              : Math.max(scaleFactor, 1)
          width = Math.round(selection.rect.width * fallbackScaleX)
        }

        if (!Number.isFinite(height) || height <= 0) {
          const fallbackScaleY =
            selection.displaySize.height > 0
              ? (metadata.height ?? selection.displaySize.height * scaleFactor) /
                selection.displaySize.height
              : Math.max(scaleFactor, 1)
          height = Math.round(selection.rect.height * fallbackScaleY)
        }
      }

      width = Math.max(minDimensionPx, width)
      height = Math.max(minDimensionPx, height)

      if (!Number.isFinite(left)) left = 0
      if (!Number.isFinite(top)) top = 0

      if (left < 0) {
        width += left
        left = 0
      }
      if (top < 0) {
        height += top
        top = 0
      }

      if (left + width > maxWidth) {
        width = Math.max(minDimensionPx, maxWidth - left)
      }
      if (top + height > maxHeight) {
        height = Math.max(minDimensionPx, maxHeight - top)
      }

      console.debug("[ScreenshotHelper] extraction parameters", {
        capturedWithTargetDisplay,
        metadata: { width: metadata.width, height: metadata.height },
        computed: { left, top, width, height },
        selectionRect: selection.rect,
        displayBounds,
        scaleFactor,
        maxSize: { width: maxWidth, height: maxHeight }
      })

      if (width <= 0 || height <= 0) {
        throw new Error("Selected area is too small")
      }

      await image
        .extract({ left, top, width, height })
        .toFormat("png")
        .toFile(outputFile)

      await this.enqueueScreenshot(outputFile)

      return outputFile
    } catch (error) {
      console.error("Error capturing region screenshot:", error)
      throw error
    }
  }
}
