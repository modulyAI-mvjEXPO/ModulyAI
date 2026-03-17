import React, { useEffect, useRef, useState } from "react";
import { createNoise3D } from "simplex-noise";
import "./wavy-background.css";

type WavyBackgroundProps = {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  waveWidth?: number;
  backgroundFill?: string;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
};

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 10,
  speed = "fast",
  waveOpacity = 0.5,
}: WavyBackgroundProps) => {
  const noise = createNoise3D();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>(0);

  const getSpeed = (): number => {
    switch (speed) {
      case "slow":  return 0.001;
      case "fast":  return 0.002;
      default:      return 0.001;
    }
  };

  const waveColors = colors ?? [
    "#ff3333",
    "#ffff00",
    "#0066ff",
    "#ff3333",
    "#0066ff",
  ];

  const init = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (ctx.canvas.width = window.innerWidth);
    let h = (ctx.canvas.height = window.innerHeight);
    ctx.filter = `blur(${blur}px)`;
    let nt = 0;

    window.onresize = () => {
      w = ctx.canvas.width = window.innerWidth;
      h = ctx.canvas.height = window.innerHeight;
      ctx.filter = `blur(${blur}px)`;
    };

    const drawWave = (n: number) => {
      nt += getSpeed();
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.lineWidth = waveWidth ?? 50;
        ctx.strokeStyle = waveColors[i % waveColors.length];
        for (let x = 0; x < w; x += 5) {
          const y = noise(x / 800, 0.3 * i, nt) * 100;
          ctx.lineTo(x, y + h * 0.5);
        }
        ctx.stroke();
        ctx.closePath();
      }
    };

    const render = () => {
      ctx.fillStyle = backgroundFill ?? "#ffffff";
      ctx.globalAlpha = waveOpacity;
      ctx.fillRect(0, 0, w, h);
      drawWave(5);
      animationIdRef.current = requestAnimationFrame(render);
    };

    render();
  };

  useEffect(() => {
    init();
    return () => {
      cancelAnimationFrame(animationIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(
      typeof window !== "undefined" &&
        navigator.userAgent.includes("Safari") &&
        !navigator.userAgent.includes("Chrome")
    );
  }, []);

  const containerClass = ["wavy-bg-container", containerClassName]
    .filter(Boolean)
    .join(" ");
  const contentClass = ["wavy-bg-content", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <canvas
        className="wavy-bg-canvas"
        ref={canvasRef}
        id="wavy-canvas"
        style={isSafari ? { filter: `blur(${blur}px)` } : undefined}
      />
      <div className={contentClass}>
        {children}
      </div>
    </div>
  );
};
