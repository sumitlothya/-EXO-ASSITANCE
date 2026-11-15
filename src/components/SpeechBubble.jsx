import React, { useEffect, useState } from "react";
import "./SpeechBubble.css";


export default function SpeechBubble({ text, mood = "HAPPY" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!text) {
      setVisible(false);
      return;
    }
    setVisible(true);

    if (mood === "THINKING") return; // don't auto-hide while waiting

    
    const ms = Math.min(30000, Math.max(5000, text.length * 60));
    const timer = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(timer);
  }, [text, mood]);

  
  const clean = (text || "").replace(/[*_`#>~]/g, "").trim();

  return (
    <div className={`haru-wrap ${visible ? "show" : ""}`}>
      <div className="haru-bubble">{clean}</div>
      <div className="haru-mood">
        <span className="haru-dot" /> {mood}
      </div>
    </div>
  );
}