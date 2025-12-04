# os.ai overlay
Invisible Electron overlay that sees screen, accepts text/voice inputs, and orchestrates web scraping of [os.ai](https://os.ai) and API calling to answer anything in real-time.

### Hotkeys:
- `Cmd + down key` to open/hide the overlay.
- 'Cmd + arrow keys' to move the app and 'Cmd + shift + down key' to move app down.
- 'Cmd + "' to toggle visibility focus mode (anti-screen-recording-detection)
- 'Cmd + W' to use internet search.
- 'CMd + m' for Sonar.
- 'CMd + ,' for GPT-5.
- 'CMd + ,' for GPT-5 with Reasning.
- 'CMd + ,' for CLaude Sonnet 4.5 with Reasoning.
- 'Cmd + Shift = N' for New chat.
- 'Cmd + L' for extended reasoning propmpt.
- 'Cmd + Enter' for capturing screenshot.
- 'Cmd + 1' for screenshot and attachement.
- 'Cmd + 2' for screenshot capture and immediate LLM query.

### Prerequisites
- Node.js installed.
- Safari browser
- Perplexity account.
- Optionally: **Either** a Gemini API key (from [Google AI Studio](https://makersuite.google.com/app/apikey))
- **Or** Ollama installed locally for private LLM usage (for privacy)

#### To run:
1. Start the ./dev.sh script:

- Starts the Vite dev server on port 5180
- Waits for the server to be ready
- Launches the Electron app.
