import { app } from "electron"
import path from "node:path"
import fs from "node:fs"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

interface PerplexityOptions {
  newChat?: boolean
  timeoutSeconds?: number
  pollIntervalMs?: number
  stablePolls?: number
  model?: "sonar" | "gpt-5" | "gpt-5-reasoning" | "claude-sonnet-4.5-reasoning"
  webSearch?: boolean
  requestId?: string
}

interface PerplexityResult {
  prompt: string
  response: string
  responses: string[]
  responseHtml?: string | null
  responsesHtml?: string[]
}

interface PerplexityStreamPayload {
  prompt?: string
  response: string
  responses: string[]
  timestamp: number
  responsesHtml?: string[]
  responseHtml?: string
}

function resolveScriptPath(fileName: string): string {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, "scripts", fileName),
    path.join(process.resourcesPath ?? appPath, "scripts", fileName)
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      ensureExecutable(candidate)
      return candidate
    }
  }

  throw new Error(`Perplexity automation script not found. Expected at scripts/${fileName}`)
}

function resolveSendScriptPath(): string {
  return resolveScriptPath("perplexity_send.jxa")
}

function resolveAttachmentScriptPath(): string {
  return resolveScriptPath("perplexity_attachments.jxa")
}

function ensureExecutable(filePath: string): void {
  if (process.platform === "win32") {
    return
  }

  try {
    const stats = fs.statSync(filePath)
    const mode = stats.mode & 0o777
    if ((mode & 0o111) === 0) {
      fs.chmodSync(filePath, mode | 0o755)
    }
  } catch (error) {
    console.warn(`Unable to adjust permissions for ${filePath}:`, error)
  }
}

async function runJxaScript(scriptPath: string, env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  if (process.platform === "darwin") {
    try {
      return await execFileAsync("osascript", ["-l", "JavaScript", scriptPath], { env })
    } catch (error: any) {
      throw error
    }
  }

  return execFileAsync(scriptPath, { env })
}

function runJxaScriptWithStream(
  scriptPath: string,
  env: NodeJS.ProcessEnv,
  onStream?: (payload: PerplexityStreamPayload) => void
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const isDarwin = process.platform === "darwin"
    const child = isDarwin
      ? spawn("osascript", ["-l", "JavaScript", scriptPath], { env })
      : spawn(scriptPath, [], { env })

    let stdout = ""
    let stderr = ""
    let stdoutPending = ""
    let stderrPending = ""

    const emitStreamPayload = (raw: string) => {
      if (!raw) return
      try {
        const parsed = JSON.parse(raw) as PerplexityStreamPayload
        onStream?.(parsed)
      } catch (error) {
        console.warn("Failed to parse Perplexity stream payload:", raw, error)
      }
    }

    const handleLine = (line: string, source: "stdout" | "stderr") => {
      const trimmed = line.trim()
      if (!trimmed) {
        if (source === "stdout") {
          stdout += "\n"
        } else {
          stderr += "\n"
        }
        return
      }
      if (trimmed.startsWith("PX_STREAM:")) {
        const payloadRaw = trimmed.slice("PX_STREAM:".length)
        emitStreamPayload(payloadRaw)
        return
      }
      if (source === "stdout") {
        stdout += line + "\n"
      } else {
        stderr += line + "\n"
      }
    }

    const handleChunk = (chunk: string, source: "stdout" | "stderr") => {
      let buffer = source === "stdout" ? stdoutPending : stderrPending
      buffer += chunk

      let newlineIndex = buffer.indexOf("\n")
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex)
        handleLine(line, source)
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf("\n")
      }

      if (source === "stdout") {
        stdoutPending = buffer
      } else {
        stderrPending = buffer
      }
    }

    child.stdout?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => handleChunk(chunk, "stdout"))
    child.stdout?.on("end", () => {
      if (stdoutPending.length > 0) {
        handleLine(stdoutPending, "stdout")
        stdoutPending = ""
      }
    })

    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk: string) => handleChunk(chunk, "stderr"))
    child.stderr?.on("end", () => {
      if (stderrPending.length > 0) {
        handleLine(stderrPending, "stderr")
        stderrPending = ""
      }
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        const failure = new Error(
          `Perplexity script exited with code ${code ?? "unknown"}${signal ? ` (signal: ${signal})` : ""}`
        )
        ;(failure as any).stdout = stdout
        ;(failure as any).stderr = stderr
        reject(failure)
      }
    })
  })
}

function parseStdout(stdout: string): PerplexityResult {
  const trimmed = stdout.trim()
  if (!trimmed) {
    throw new Error("Empty response from Perplexity automation script")
  }

  const lastLine = trimmed.split(/\r?\n/).filter(Boolean).pop() as string
  try {
    return JSON.parse(lastLine) as PerplexityResult
  } catch (error) {
    throw new Error(`Failed to parse Perplexity response: ${lastLine}`)
  }
}

export async function sendPerplexityPrompt(
  prompt: string,
  options: PerplexityOptions = {},
  onStream?: (payload: PerplexityStreamPayload) => void
): Promise<PerplexityResult> {
  if (!prompt.trim()) {
    throw new Error("Prompt is empty")
  }

  const scriptPath = resolveSendScriptPath()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PERPLEXITY_MESSAGE: prompt,
    PERPLEXITY_OUTPUT: "json"
  }

  if (options.newChat) {
    env.PERPLEXITY_NEW_CHAT = "true"
  }
  if (process.env.NODE_ENV !== "production" || process.env.PERPLEXITY_DEBUG_LOG_RESPONSES === "true") {
    env.PERPLEXITY_DEBUG_LOG_RESPONSES = "true"
  }
  if (options.timeoutSeconds) {
    env.PERPLEXITY_TIMEOUT = String(options.timeoutSeconds)
  }
  if (options.pollIntervalMs) {
    env.PERPLEXITY_POLL_INTERVAL_MS = String(options.pollIntervalMs)
  }
  if (options.stablePolls) {
    env.PERPLEXITY_STABLE_POLLS = String(options.stablePolls)
  }
  if (options.model) {
    env.PERPLEXITY_MODEL = options.model
  }
  if (typeof options.webSearch === "boolean") {
    env.PERPLEXITY_WEB_SEARCH = options.webSearch ? "on" : "off"
  }

  try {
    const { stdout, stderr } = await runJxaScriptWithStream(scriptPath, env, onStream)
    if (stderr?.trim()) {
      console.warn("Perplexity script stderr:", stderr)
    }
    const parsed = parseStdout(stdout)
    if (process.env.NODE_ENV !== "production") {
      const preview =
        parsed.response.length > 400
          ? `${parsed.response.slice(0, 400)}…`
          : parsed.response
      console.log("[PerplexityHelper] Captured response preview:", preview.replace(/\n/g, "\\n"))
      console.log(
        "[PerplexityHelper] Response length:",
        parsed.response.length,
        "Lines:",
        parsed.response.split(/\r?\n/).length
      )
      if (parsed.responseHtml) {
        console.log(
          "[PerplexityHelper] Response HTML length:",
          parsed.responseHtml.length,
          "Segments:",
          parsed.responsesHtml?.length ?? 0
        )
      }
    }
    return parsed
  } catch (error: any) {
    const stderr = error?.stderr?.trim()
    const stdout = error?.stdout?.trim()
    const messageParts = ["Perplexity automation failed"]
    if (error?.message) messageParts.push(error.message)
    if (stdout) messageParts.push(`stdout: ${stdout}`)
    if (stderr) messageParts.push(`stderr: ${stderr}`)
    throw new Error(messageParts.join(" | "))
  }
}

export async function attachPerplexityImage(imagePath: string, options: { newChat?: boolean } = {}): Promise<void> {
  if (!imagePath) {
    throw new Error("Image path is required for attachment")
  }

  const scriptPath = resolveAttachmentScriptPath()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PERPLEXITY_MODE: "attach",
    PERPLEXITY_IMAGE_PATH: imagePath
  }

  if (options.newChat) {
    env.PERPLEXITY_NEW_CHAT = "true"
  }

  const { stdout, stderr } = await runJxaScript(scriptPath, env)
  if (stderr?.trim()) {
    console.warn("Perplexity attachment script stderr:", stderr)
  }

  const trimmed = stdout?.trim()
  if (!trimmed) return

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed?.status !== "attached") {
      console.warn("Unexpected attachment script response:", trimmed)
    }
  } catch (error) {
    console.warn("Failed to parse attachment script response:", trimmed, error)
  }
}

export async function sendPerplexityPromptWithAttachments(
  prompt: string,
  options: PerplexityOptions = {}
): Promise<PerplexityResult> {
  const scriptPath = resolveAttachmentScriptPath()

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PERPLEXITY_MODE: "send",
    PERPLEXITY_MESSAGE: prompt ?? "",
    PERPLEXITY_OUTPUT: "json"
  }

  if (options.newChat) {
    env.PERPLEXITY_NEW_CHAT = "true"
  }
  if (process.env.NODE_ENV !== "production" || process.env.PERPLEXITY_DEBUG_LOG_RESPONSES === "true") {
    env.PERPLEXITY_DEBUG_LOG_RESPONSES = "true"
  }
  if (options.timeoutSeconds) {
    env.PERPLEXITY_TIMEOUT = String(options.timeoutSeconds)
  }
  if (options.pollIntervalMs) {
    env.PERPLEXITY_POLL_INTERVAL_MS = String(options.pollIntervalMs)
  }
  if (options.stablePolls) {
    env.PERPLEXITY_STABLE_POLLS = String(options.stablePolls)
  }
  if (options.model) {
    env.PERPLEXITY_MODEL = options.model
  }
  if (typeof options.webSearch === "boolean") {
    env.PERPLEXITY_WEB_SEARCH = options.webSearch ? "on" : "off"
  }

  try {
    const { stdout, stderr } = await runJxaScript(scriptPath, env)
    if (stderr?.trim()) {
      console.warn("Perplexity send-with-attachments stderr:", stderr)
    }
    const parsed = parseStdout(stdout)
    if (process.env.NODE_ENV !== "production") {
      const preview =
        parsed.response.length > 400
          ? `${parsed.response.slice(0, 400)}…`
          : parsed.response
      console.log("[PerplexityHelper] (attachments) Captured response preview:", preview.replace(/\n/g, "\\n"))
      console.log(
        "[PerplexityHelper] (attachments) Response length:",
        parsed.response.length,
        "Lines:",
        parsed.response.split(/\r?\n/).length
      )
      if (parsed.responseHtml) {
        console.log(
          "[PerplexityHelper] (attachments) Response HTML length:",
          parsed.responseHtml.length,
          "Segments:",
          parsed.responsesHtml?.length ?? 0
        )
      }
    }
    return parsed
  } catch (error: any) {
    const stderr = error?.stderr?.trim()
    const stdout = error?.stdout?.trim()
    const messageParts = ["Perplexity attachment send failed"]
    if (error?.message) messageParts.push(error.message)
    if (stdout) messageParts.push(`stdout: ${stdout}`)
    if (stderr) messageParts.push(`stderr: ${stderr}`)
    throw new Error(messageParts.join(" | "))
  }
}
