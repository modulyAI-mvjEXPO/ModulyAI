import { cn } from "../../lib/utils";
import { useState } from "react";

export function SoftGlowBackground() {
  const [count, setCount] = useState(0);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Soft Yellow Glow */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, #FFF991 0%, transparent 70%)
          `,
          opacity: 0.6,
          mixBlendMode: "multiply",
        }}
      />
      {/* Your Content/Components */}
    </div>
  );
}

export default SoftGlowBackground;
