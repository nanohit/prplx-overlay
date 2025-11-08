# Reverse-Engineering "Invisible Cheating App" Cluely

Everyone saw Roy Lee's viral stunt with "Cluely," the invisible app designed to secretly ace coding interviews. He pissed off Columbia, Amazon, and pretty much everyone else—but let's skip past the controversy. I tore apart the app to see how it works, and turns out, the tech itself is genuinely interesting.

![Cluely Screenshot](image.png)

### How Cluely Actually Works (Technical Breakdown)

Roy built Cluely using Electron, a desktop app framework based on Chromium and Node.js, to create a transparent, always-on-top overlay:

- **Transparent Window (**`transparent: true`**)** – This Electron BrowserWindow property ensures the background is fully transparent, showing only explicitly rendered content.
- **Always On Top (**`alwaysOnTop: true`**)** – Electron's flag forces the overlay window to persistently float above all other applications, making it consistently accessible without being covered.

Here's an example code snippet: 

```
const { BrowserWindow } = require('electron');

const win = new BrowserWindow({
  width: 800,
  height: 600,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  fullscreen: false,
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
  }
});
win.loadURL('file://' + __dirname + '/index.html');
```

### Backend Communication

The overlay captures clipboard data, screenshots, or selected text and sends this information to an AI backend (e.g., OpenAI) via WebSockets or HTTP requests. This backend quickly processes and returns useful suggestions or solutions.

### Screen Capture and OCR

Advanced implementations use native modules (like node-ffi, robotjs) to capture specific screen areas and run OCR (Optical Character Recognition) using libraries like Tesseract.js. This lets the overlay extract text directly from your screen.

### Clipboard Monitoring

Electron continuously listens for clipboard changes, immediately activating AI-assisted processing whenever new text is copied.

### But Here's the Catch

- **Security Annoyances**: macOS and Windows can detect and restrict invisible overlays in secure or fullscreen contexts.
- **Performance Drag**: OCR processes and constant clipboard monitoring can significantly increase CPU and GPU usage.

### Real, Ethical Ways to Use This Tech

Roy was trolling interviews, but here's the thing—this invisible overlay tech is actually super useful:

- **Sales Copilots**: Imagine having a "Wolf of Wall Street"-style playbook always ready—instantly giving your sales reps real-time context and powerful closing lines during calls or meetings.
- **Customer Support Assistant**: Like having Jarvis from Iron Man whispering the perfect response into your ear—automatically suggesting accurate and relevant replies without breaking your workflow.
- **Onboarding Buddy**: Give new employees a personalized overlay that pops up helpful, contextual advice exactly when they need it, helping them get productive faster and more comfortably.

### Want to Use This for Good?

Everything's open-sourced right [here](https://github.com/Prat011/free-cluely). If this sounds like something your team could use ethically and effectively, reach out. Let's build something legit. You can contact me at prathit3.14@gmail.com

---

## Safari Perplexity Automation (Experimental)

> ⚠️ Local experiment for personal testing only. It relies on the live Perplexity UI and may break without warning.

1. **Enable JavaScript from Apple Events** in Safari: Settings → Advanced → enable the Develop menu, then Develop → “Allow JavaScript from Apple Events”.
2. **Open Perplexity** in a normal Safari window, solve any Cloudflare challenge, and stay logged in. (Private windows aren’t accessible via Apple Events.)
3. **Send a prompt from the terminal**:

   ```bash
   PERPLEXITY_MESSAGE='your prompt here' ./scripts/perplexity_send.jxa
   ```

   - The script finds the first Safari tab whose URL contains `perplexity.ai` and makes it active.
   - It injects the message directly into the Lexical editor that powers the chat box.
   - It programmatically clicks the submit button; Perplexity handles the rest.
   - The latest reply is captured from the UI and printed to stdout. Use `PERPLEXITY_OUTPUT=json` to receive the full prompt/response bundle.
   - Set `PERPLEXITY_NEW_CHAT=true` to trigger a fresh conversation before sending the prompt.
   - Optional tuning:
     - `PERPLEXITY_TIMEOUT` (seconds, default `45`)
     - `PERPLEXITY_POLL_INTERVAL_MS` (milliseconds between DOM polls, default `750`)
     - `PERPLEXITY_STABLE_POLLS` (number of identical polls before considering the response complete, default `3`)

4. **Troubleshooting**
   - If you see “input editor not found”, make sure the tab is loaded and no CAPTCHA is pending.
   - Returned text includes citation markers (e.g. `source+2​`). Strip or post-process them in your overlay if needed.
   - Any DOM change on perplexity.ai will require updating the selector logic in `scripts/perplexity_send.jxa`.