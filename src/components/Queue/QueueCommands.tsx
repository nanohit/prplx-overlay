import React from "react"
import { IoLogOutOutline } from "react-icons/io5"

interface QueueCommandsProps {
  screenshots: Array<{ path: string; preview: string }>
  onChatToggle: () => void
  onNewChat: () => void
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  screenshots,
  onChatToggle,
  onNewChat
}) => {
  return (
    <div className="w-fit">
      <div className="text-[11px] text-white/90 liquid-glass-bar py-0.5 px-3 flex items-center justify-center gap-3 draggable-area">
        {screenshots.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] leading-none">Solve</span>
            <div className="flex gap-1">
              <span className="bg-white/10 rounded px-1 py-0.5 text-[10px] leading-none text-white/70">
                ⌘
              </span>
              <span className="bg-white/10 rounded px-1 py-0.5 text-[10px] leading-none text-white/70">
                ↵
              </span>
            </div>
          </div>
        )}

          <button
          className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-0.5 text-[10px] leading-none text-white/80 flex items-center gap-1"
            onClick={onChatToggle}
            type="button"
          >
            💬 Chat
          </button>

          <button
          className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-0.5 text-[10px] leading-none text-white/80 flex items-center gap-1"
          onClick={onNewChat}
            type="button"
          title="Start fresh Perplexity chat (⌘⇧N)"
        >
          🆕 New
        </button>

        <div className="mx-1 h-3 w-px bg-white/20" />

        <button
          className="text-red-400/80 hover:text-red-300 transition-colors hover:cursor-pointer"
          title="Quit"
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default QueueCommands
