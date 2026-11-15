import React, { useState } from "react";
import useVoice, { speak, stopSpeaking, voiceSupported } from "./useVoice";

const MODEL = "openai/gpt-oss-120b";

const WELCOME = {
  role: "assistant",
  content: "Hello! I'm Haru's AI assistant. Ask me anything!",
};

const SITES = {
  youtube: "https://youtube.com",
  google: "https://google.com",
};

// remove markdown symbols so text looks clean in chat, bubble and voice
function cleanText(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();
}

// Handles "open youtube", "open <file>" and "move <file> to <folder>".
// Returns reply text, or null if the message is not a command.
async function openLink(url, message) {
  if (window.api?.openUrl) await window.api.openUrl(url);
  else window.open(url, "_blank");
  return message;
}

const FOLDERS = "desktop|documents|downloads|pictures|music|videos";

// Handles searches, websites, apps, and files. Returns reply text, or null if not a command.
async function handleCommand(text) {
  const clean = text
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/^(please|can you|could you)\s+/i, "")
    .replace(/\s+please$/i, "")
    .replace(/^(open|launch|start|move)\s+(the|my)\s+/i, (m, v) => v + " ")
    .replace(/\s+to\s+(the|my)\s+/i, " to ");
  const lower = clean.toLowerCase();

  // YouTube search: "search cats on youtube"
  const yt = clean.match(/^(?:search|look up)\s+(?:for\s+)?(.+?)\s+(?:on|in)\s+youtube$/i);
  if (yt) {
    return openLink(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(yt[1])}`,
      `Searching YouTube for ${yt[1]}.`
    );
  }

  // Google search: "search cats", "google cats", "look up cats on google"
  const g = clean.match(/^(?:search|google|look up)\s+(?:for\s+)?(.+?)(?:\s+(?:on|in|using)\s+google)?$/i);
  if (g) {
    return openLink(
      `https://www.google.com/search?q=${encodeURIComponent(g[1])}`,
      `Searching Google for ${g[1]}.`
    );
  }

  // Websites
  for (const [name, url] of Object.entries(SITES)) {
    if (lower.includes(`open ${name}`)) {
      return openLink(url, `Opening ${name[0].toUpperCase() + name.slice(1)}!`);
    }
  }

  // Apps and files only work inside Electron
  if (!window.api) return null;

  // "show downloads" / "list my documents"
  const list = clean.match(
    new RegExp(`^(?:show|list)\\s+(?:me\\s+)?(?:the\\s+)?(?:files\\s+in\\s+)?(?:my\\s+)?(${FOLDERS})(?:\\s+(?:files|folder))?$`, "i")
  );
  if (list) return await window.api.listFiles(list[1]);

  // "open latest download"
  if (/^open\s+(?:the\s+)?(?:latest|last|newest|recent)\s+download(?:ed)?(?:\s+file)?$/i.test(clean)) {
    return await window.api.latestFile("downloads");
  }

  // "open latest file in pictures"
  const latest = clean.match(
    new RegExp(`^open\\s+(?:the\\s+)?(?:latest|last|newest|recent)\\s+file\\s+(?:in|from)\\s+(?:my\\s+)?(${FOLDERS})$`, "i")
  );
  if (latest) return await window.api.latestFile(latest[1]);

  // "open report from downloads"
  const from = clean.match(
    new RegExp(`^open\\s+(.+?)\\s+(?:from|in)\\s+(?:my\\s+)?(${FOLDERS})$`, "i")
  );
  if (from) return await window.api.openFile(from[1], from[2]);

  const moveMatch = clean.match(/^move\s+(.+?)\s+to\s+(.+)$/i);
  if (moveMatch) return await window.api.moveFile(moveMatch[1], moveMatch[2]);

  const openMatch = clean.match(/^(?:open|launch|start)\s+(.+)$/i);
  if (openMatch) {
    // Try an allowed app first, then a file or folder
    const appReply = await window.api.openApp(openMatch[1]);
    if (appReply) return appReply;
    return await window.api.openFile(openMatch[1]);
  }

  return null;
}

// onBubble({ text, mood }) shows Haru's reply above her head (see SpeechBubble)
function Chatbot({ onBubble }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([WELCOME]);
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true); // Haru speaks her answers

  // Pass text directly (from voice) or fall back to the input box
  async function sendMessage(text) {
    const userMessage = (typeof text === "string" ? text : message).trim();

    if (!userMessage) return;
    if (loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: userMessage },
    ]);

    setMessage("");

    // Commands (open / move) are handled here, without calling the AI
    const commandReply = await handleCommand(userMessage);
    if (commandReply) {
      reply(commandReply);
      return;
    }

    setLoading(true);
    onBubble?.({ text: "Haru is thinking...", mood: "THINKING" });

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;

      if (!apiKey) {
        throw new Error("VITE_GROQ_API_KEY is missing.");
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are Haru, a friendly anime-style AI assistant. Give helpful, clear and concise answers. Reply in plain text only. Never use markdown, asterisks, or bullet symbols. Keep answers short and conversational.",
              },
              ...messages.map((item) => ({
                role: item.role,
                content: item.content,
              })),
              { role: "user", content: userMessage },
            ],
            temperature: 1,
            max_completion_tokens: 2048,
            top_p: 1,
            reasoning_effort: "medium",
          }),
        }
      );

      const data = await response.json();

      console.log("Groq response:", data);

      if (!response.ok) {
        throw new Error(
          data?.error?.message || `Groq HTTP ${response.status}`
        );
      }

      const raw = data?.choices?.[0]?.message?.content;

      if (!raw) {
        throw new Error("Groq returned an empty answer.");
      }

      const answer = cleanText(raw);

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: answer },
      ]);

      onBubble?.({ text: answer, mood: "HAPPY" });
      if (voiceOn) speak(answer);
    } catch (error) {
      console.error("Groq error:", error);

      const errorText = `Error connecting to Groq: ${error.message}`;

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: errorText },
      ]);

      onBubble?.({ text: errorText, mood: "SAD" });
    } finally {
      setLoading(false);
    }
  }

  // Handles voice-only commands first, otherwise sends to sendMessage
  // (which also handles open / move commands)
  function handleVoice(text) {
    const t = text.toLowerCase();

    if (t.includes("clear chat")) {
      setMessages([WELCOME]);
      onBubble?.({ text: "", mood: "HAPPY" });
      stopSpeaking();
    } else if (t.includes("stop talking") || t.includes("be quiet")) {
      stopSpeaking();
    } else {
      sendMessage(text);
    }
  }

  function reply(text) {
    setMessages((previous) => [
      ...previous,
      { role: "assistant", content: text },
    ]);
    onBubble?.({ text, mood: "HAPPY" });
    if (voiceOn) speak(text);
  }

  const { listening, start, stop } = useVoice(handleVoice);

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      sendMessage();
    }
  }

  return (
    <div className="chatbot">
      <div className="chat-header">
        <div className="chat-title">EXO ASSISTANCE</div>
        <div className="chat-subtitle">Live2D Assistant</div>
      </div>

      <div className="chat-messages">
        {messages.map((item, index) => (
          <div
            key={index}
            className={
              item.role === "user"
                ? "message user-message"
                : "message assistant-message"
            }
          >
            {item.content}
          </div>
        ))}

        {loading && (
          <div className="message assistant-message">Haru is thinking...</div>
        )}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Listening..." : "Talk to Haru..."}
          disabled={loading}
        />

        {voiceSupported && (
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={loading}
            title="Voice input"
          >
            {listening ? "🔴" : "🎤"}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (voiceOn) stopSpeaking();
            setVoiceOn(!voiceOn);
          }}
          title="Toggle Haru's voice"
        >
          {voiceOn ? "🔊" : "🔇"}
        </button>

        <button type="button" onClick={() => sendMessage()} disabled={loading}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default Chatbot;
