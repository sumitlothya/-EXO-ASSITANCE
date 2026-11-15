import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
import { CHARACTERS } from "../characters";

window.PIXI = PIXI;

const IS_PET =
  new URLSearchParams(window.location.search).get("mode") === "pet";

const CANVAS_W = IS_PET ? 400 : 800;
const CANVAS_H = IS_PET ? 650 : 900;

async function pickModelUrl(character) {
  try {
    const res = await fetch(character.model);
    if (res.ok) return character.model;
  } catch {
  
  }
  if (character.fallback) return character.fallback;
  throw new Error(`Model not found: ${character.model}`);
}

function Live2DCharacter({ characterId = "haru" }) {
  const character = CHARACTERS[characterId] || CHARACTERS.haru;
  const canvasRef = useRef(null);
  const [status, setStatus] = useState(`Loading ${character.name}...`);

  useEffect(() => {
    let cancelled = false;
    let app = null;
    let model = null;

    async function start() {
      try {
        if (!window.Live2DCubismCore) {
          throw new Error(
            "Cubism core not loaded. Check the <script> tag in index.html."
          );
        }

        app = new PIXI.Application({
          view: canvasRef.current,
          width: CANVAS_W,
          height: CANVAS_H,
          transparent: true,
          backgroundAlpha: 0,
          autoStart: true,
          antialias: true,
        });

        const url = await pickModelUrl(character);
        model = await Live2DModel.from(url);

        if (cancelled) {
          model.destroy();
          return;
        }

        const scale =
          Math.min(
            (CANVAS_W * 0.9) / model.width,
            (CANVAS_H * (IS_PET ? 0.7 : 0.95)) / model.height
          ) * (character.scale || 1);
        model.scale.set(scale);
        model.anchor.set(0.5, 1);
        model.x = CANVAS_W / 2;
        model.y = CANVAS_H;

        app.stage.addChild(model);

        setStatus(
          url === character.model
            ? `${character.name} is ready`
            : `${character.name} is ready (using test model)`
        );
      } catch (error) {
        console.error(`${character.name} Live2D error:`, error);
        if (!cancelled) setStatus(`${character.name} error: ${error.message}`);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (app) app.destroy(false, { children: true });
    };
  }, [character]);

  return (
    <div className="live2d-container">
      <canvas
        ref={canvasRef}
        className="live2d-canvas"
        width={CANVAS_W}
        height={CANVAS_H}
      />
      {!IS_PET && <div className="live2d-status">{status}</div>}
    </div>
  );
}

export default Live2DCharacter;