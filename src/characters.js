export const CHARACTERS = {
  haru: {
    name: "Haru",
    model: "/live2d/Haru/Haru.model3.json",
    fallback:
      "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json",
    scale: 1,
    voice: { names: ["Zira", "Aria", "Jenny"], pitch: 1.3, rate: 1 },
  },
  miara: {
    name: "Miara",
    model: "/live2d/Haru/Miara/miara_pro_t03.model3.json",
    scale: 1,
    voice: { names: ["Aria", "Jenny", "Zira"], pitch: 1.1, rate: 1.05 },
  },
};

export const DEFAULT_CHARACTER = "haru";