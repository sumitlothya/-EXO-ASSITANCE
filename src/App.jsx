import React, { useEffect, useState } from "react";

import Live2DCharacter from "./components/Live2DCharacter";
import Chatbot from "./components/Chatbot";
import SpeechBubble from "./components/SpeechBubble";
import { CHARACTERS, DEFAULT_CHARACTER } from "./characters";
import { setVoiceProfile } from "./components/useVoice";

const isPet =
  new URLSearchParams(window.location.search).get("mode") === "pet";

const channel = new BroadcastChannel("haru-bubble");
const charChannel = new BroadcastChannel("character-select");

function App() {
  const [bubble, setBubble] = useState({ text: "", mood: "HAPPY" });
  const [characterId, setCharacterId] = useState(
    () => localStorage.getItem("character") || DEFAULT_CHARACTER
  );

  useEffect(() => {
    if (!isPet) return;
    const onMessage = (event) => setBubble(event.data);
    channel.addEventListener("message", onMessage);
    return () => channel.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onChar = (event) => setCharacterId(event.data);
    charChannel.addEventListener("message", onChar);
    return () => charChannel.removeEventListener("message", onChar);
  }, []);

  
  useEffect(() => {
    setVoiceProfile(CHARACTERS[characterId]?.voice);
  }, [characterId]);

  function changeCharacter(id) {
    setCharacterId(id);
    localStorage.setItem("character", id);
    charChannel.postMessage(id);
  }

  function handleBubble(data) {
    channel.postMessage(data);
  }

  if (isPet) {
    return (
      <div className="pet">
        <div style={{ position: "relative", width: 400, height: 650 }}>
          <SpeechBubble text={bubble.text} mood={bubble.mood} />
          <Live2DCharacter key={characterId} characterId={characterId} />
        </div>
      </div>
    );
  }

  return (
    <main className="app">
      <section className="character-section" style={{ position: "relative" }}>
        <select
          value={characterId}
          onChange={(e) => changeCharacter(e.target.value)}
          style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }}
        >
          {Object.entries(CHARACTERS).map(([id, c]) => (
            <option key={id} value={id}>
              {c.name}
            </option>
          ))}
        </select>
        <Live2DCharacter key={characterId} characterId={characterId} />
      </section>

      <section className="chat-section">
        <Chatbot
          onBubble={handleBubble}
          characterName={CHARACTERS[characterId]?.name || "Haru"}
        />
      </section>
    </main>
  );
}

export default App;