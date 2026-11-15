import { useEffect, useRef, useState } from "react";

export const voiceSupported =
  typeof window !== "undefined" &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function useVoice(onResult) {
  const recRef = useRef(null);
  const callbackRef = useRef(onResult);
  const [listening, setListening] = useState(false);

  
  callbackRef.current = onResult;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      callbackRef.current?.(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      console.log("Voice error:", e.error);
      setListening(false);
    };

    recRef.current = rec;
    return () => rec.abort();
  }, []);

  const start = () => {
    if (!recRef.current || listening) return;
    window.speechSynthesis.cancel(); 
    try {
      recRef.current.start();
      setListening(true);
    } catch (err) {
      console.log(err);
    }
  };

  const stop = () => recRef.current?.stop();

  return { listening, start, stop };
}


let voiceProfile = {
  names: ["Zira", "Aria", "Jenny", "Michelle", "Sonia", "Libby", "Hazel", "Samantha"],
  pitch: 1.2,
  rate: 1,
};


export function setVoiceProfile(profile) {
  if (profile) voiceProfile = { ...voiceProfile, ...profile };
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  for (const name of voiceProfile.names) {
    const v = voices.find((v) => v.name.includes(name));
    if (v) return v;
  }
  
  return (
    voices.find((v) => v.lang.startsWith("en") && /female/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    null
  );
}


if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () =>
    window.speechSynthesis.getVoices();
}

export function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const clean = text.replace(/[*_`#>~]/g, "").replace(/\s+/g, " ").trim();

  const u = new SpeechSynthesisUtterance(clean);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = voiceProfile.rate;
  u.pitch = voiceProfile.pitch;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}