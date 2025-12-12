
import React, { useEffect, useRef } from 'react';

interface AtlasVisualProps {
  isThinking: boolean;
  edgeBlur?: number; // 0-100, controls "Mistiness"
  centerWhite?: number; // 0-100, controls Ring Radius
  haloIntensity?: number; // 0-100, controls Opacity/Glow strength
  mode?: 'light' | 'dark';
}

// Updated Mini Component to match the "Deep Dreamy" aesthetic
export const AtlasMini: React.FC<{ isThinking?: boolean, className?: string }> = ({ isThinking = false, className = "w-6 h-6" }) => {
    return (
        <div className={`${className} relative flex items-center justify-center shrink-0`}>
            {/* Deep Mist Glow (The Dreamy Atmosphere) */}
            <div className={`absolute inset-0 rounded-full blur-[3px] transition-all duration-500 ${isThinking ? 'bg-indigo-400/60 scale-125' : 'bg-indigo-600/40'}`}></div>
            
            {/* Spinning Ring (The Flowing Energy) */}
            <div 
                className="absolute w-full h-full border-[2px] rounded-full border-t-cyan-200/90 border-r-indigo-400/50 border-b-transparent border-l-blue-500/30"
                style={{ animation: isThinking ? 'spin 1s linear infinite' : 'spin 4s linear infinite' }}
            ></div>
            
            {/* Core (The Depth) */}
             <div className={`absolute w-[60%] h-[60%] rounded-full blur-[2px] transition-colors duration-500 ${isThinking ? 'bg-white/30' : 'bg-cyan-600/20'}`}></div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

const AtlasVisual: React.FC<AtlasVisualProps> = ({ 
    isThinking,
    edgeBlur = 50,
    centerWhite = 50,
    haloIntensity = 50,
    mode = 'light'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateDimensions = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }
    };
    
    // Initial resize
    updateDimensions();
    
    // Add event listener with matching signature
    const handleResize = () => updateDimensions();
    window.addEventListener('resize', handleResize);

    const animate = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      
      ctx.clearRect(0, 0, width, height);
      
      const cx = width / 2;
      const cy = height / 2;
      
      // Slow, meditative movement
      const baseSpeed = 0.002; 
      const speedMultiplier = isThinking ? 4.0 : 1.0; 
      timeRef.current += baseSpeed * speedMultiplier;
      const t = timeRef.current;

      const isDark = mode === 'dark';

      // --- ETHEREAL CONFIGURATION ---

      // 1. Palette: Deep, Dreamy, Rich
      // "Not Shallow" -> We need higher saturation and darker values mixed with light.
      const palette = isDark ? {
          mist: '40, 20, 180',   // Deep Indigo/Violet
          core: '0, 180, 255',   // Electric Cyan
          highlight: '200, 240, 255'
      } : {
          // Light Mode (Beige BG):
          // Deep Royal Blue + Periwinkle + Vivid Azure
          mist: '60, 80, 220',     // Deep Periwinkle/Royal Blue (Dreamy base)
          core: '0, 140, 230',     // Vivid Azure (The "Body" of the ring)
          highlight: '180, 230, 255' // Icy Highlight
      };

      // 2. Geometry
      const baseRadius = 50 + (centerWhite / 100) * 80;
      
      // Breathing: Very slow and subtle
      const breath = Math.sin(t * 1.5) * 4;
      const r = baseRadius + breath;

      // 3. Blur / Diffusion
      const mistAmount = 10 + (edgeBlur / 100) * 50;
      
      // Increase base opacity to make it "deeper" and less "shallow"
      const globalAlpha = 0.45 + (haloIntensity / 100) * 0.55;

      // --- RENDER LAYERS ---
      
      const layers = [
          // Layer 1: The Deep Mist (Wide, slowest, darkest)
          // This gives the "Dreamy" purple-ish backdrop
          { r: r, w: 70, s: 0.2, c: palette.mist, a: 0.25 },
          
          // Layer 2: The Main Flow (Medium, vivid color)
          { r: r, w: 45, s: -0.4, c: palette.core, a: 0.35 },

          // Layer 3: The Highlights (Thin, distinct movement, adds "Gloss")
          { r: r, w: 25, s: 0.6, c: palette.highlight, a: 0.5 }
      ];

      layers.forEach((layer, i) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * layer.s + i);
          ctx.translate(-cx, -cy);

          // Blend Mode: 
          // 'screen' generally works best for glowing effects on both light/dark backgrounds if colors are saturated enough
          // But on light BG, 'source-over' with alpha blending is often cleaner for "dark" colors.
          ctx.globalCompositeOperation = isDark ? 'screen' : 'source-over'; 
          
          const grad = ctx.createConicGradient(0, cx, cy);
          
          // Smooth transitions
          grad.addColorStop(0, `rgba(${layer.c}, 0)`);
          grad.addColorStop(0.2, `rgba(${layer.c}, ${layer.a * globalAlpha * 0.6})`);
          grad.addColorStop(0.5, `rgba(${layer.c}, ${layer.a * globalAlpha})`); // Peak
          grad.addColorStop(0.8, `rgba(${layer.c}, ${layer.a * globalAlpha * 0.6})`);
          grad.addColorStop(1, `rgba(${layer.c}, 0)`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = layer.w;
          ctx.lineCap = 'round';
          
          // Blur filter
          ctx.filter = `blur(${mistAmount}px)`;
          
          ctx.beginPath();
          ctx.arc(cx, cy, layer.r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
      });

      // --- THINKING PULSE ---
      if (isThinking) {
          ctx.save();
          const pulseOpacity = (Math.sin(t * 8) + 1) / 2 * 0.6;
          
          ctx.fillStyle = `rgba(${palette.highlight}, ${pulseOpacity})`;
          ctx.filter = `blur(${mistAmount * 1.5}px)`; 
          
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill(); 
          ctx.restore();
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isThinking, edgeBlur, centerWhite, haloIntensity, mode]);

  return (
    <div className={`w-full h-full flex items-center justify-center relative overflow-hidden ${mode === 'dark' ? 'bg-transparent' : 'bg-atlas-bg'}`}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full transition-opacity duration-1000"
      />
      <div className={`absolute bottom-8 pointer-events-none text-[10px] tracking-[0.4em] uppercase font-sans font-bold opacity-30 ${mode === 'dark' ? 'text-white' : 'text-atlas-text'}`}>
        Atlas Core
      </div>
    </div>
  );
};

export default AtlasVisual;
