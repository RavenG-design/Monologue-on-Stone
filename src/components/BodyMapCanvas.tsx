import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import p5 from 'p5';

interface BodyMapCanvasProps {
  videoSource: string | null;
  onClear: () => void;
  viscosity: number;
  chalkIntensity: number;
  brushShape: 'default' | 'flower';
  commemorativeText: string;
}

export interface BodyMapCanvasHandle {
  downloadImage: (filename?: string) => void;
  clearCanvas: () => void;
}

const BodyMapCanvas = forwardRef<BodyMapCanvasHandle, BodyMapCanvasProps>(({ videoSource, onClear, viscosity, chalkIntensity, brushShape, commemorativeText }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  
  // Refs to allow p5 to access latest props without restarting the sketch
  const textRef = useRef(commemorativeText);
  const viscRef = useRef(viscosity);
  const chalkRef = useRef(chalkIntensity);
  const shapeRef = useRef(brushShape);

      useImperativeHandle(ref, () => ({
    downloadImage: (filename = 'body-as-map.png') => {
      if (p5InstanceRef.current) {
        const p = p5InstanceRef.current;
        // @ts-ignore
        const currentPg = p.getPg(); 
        
        // Create an export composition at 1080p
        const exp = p.createGraphics(1080, 1920);
        exp.background(242, 240, 233);
        
        // Draw the Ink layer
        exp.image(currentPg, 0, 0);
        
        // Redraw Text at high-res for the download
        if (textRef.current) {
          exp.fill(26, 26, 26, 200);
          exp.textFont('EB Garamond');
          exp.textSize(32); // Scaled text size for 1080p
          exp.textAlign(p.CENTER, p.BOTTOM);
          exp.text(textRef.current, 1080 / 2, 1920 - 64);
        }
        
        exp.save(filename);
      }
    },
    clearCanvas: () => {
      if (p5InstanceRef.current) {
        (p5InstanceRef.current as any).clearCanvas();
      }
    }
  }));

  useEffect(() => {
    textRef.current = commemorativeText;
  }, [commemorativeText]);

  useEffect(() => {
    viscRef.current = viscosity;
  }, [viscosity]);

  useEffect(() => {
    chalkRef.current = chalkIntensity;
  }, [chalkIntensity]);

  useEffect(() => {
    shapeRef.current = brushShape;
  }, [brushShape]);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      const OUT_W = 1080;
      const OUT_H = 1920;
      let R_SCALE = 1;

      let video: p5.Element;
      let poseNet: any;
      let poses: any[] = [];
      let canvas: p5.Renderer;
      let pg: p5.Graphics; 
      let paperTexture: p5.Image;

      let smoothedWrists = {
        left: { x: 0, y: 0, active: false, seed: p.random(1000), points: 0 },
        right: { x: 0, y: 0, active: false, seed: p.random(1000), points: 0 }
      };

        p.setup = () => {
          const containerHeight = containerRef.current?.clientHeight || 800;
          const containerWidth = (containerHeight * 9) / 16;
          canvas = p.createCanvas(containerWidth, containerHeight);
          p.noStroke();
          p.pixelDensity(p.displayDensity() > 1 ? 2 : 1); // Ensure sharp text and curves on screen
          
          R_SCALE = OUT_W / p.width;
          
          pg = p.createGraphics(OUT_W, OUT_H);
          pg.clear(0, 0, 0, 0);
        };

      p.draw = () => {
        p.clear(0, 0, 0, 0);
        
        // 1. Draw Video Base
        if (video) {
          const vRatio = (video as any).width / (video as any).height || 1;
          const cRatio = p.width / p.height;
          let vw, vh;
          if (vRatio > cRatio) {
            vh = p.height; vw = vh * vRatio;
          } else {
            vw = p.width; vh = vw / vRatio;
          }
          p.push();
          p.image(video, (p.width - vw) / 2, (p.height - vh) / 2, vw, vh);
          p.pop();
        } else {
          // If no video, just beige
          p.background(242, 240, 233);
        }

        // 2. Pure Beige 85% Opaque Overlay
        p.fill(242, 240, 233, 217); // #F2F0E9 at 85% alpha
        p.rect(0, 0, p.width, p.height);

        // 3. Draw Brush Strokes (Inky Graphic layer)
        p.image(pg, 0, 0, p.width, p.height);

        // 4. Pose Processing
        if (videoSource) {
          if (!video) {
            video = p.createVideo(videoSource, () => {
              const videoElement = video as any;
              videoElement.volume(0);
              videoElement.loop();
              videoElement.play();
              video.hide();
              
              // @ts-ignore
              poseNet = window.ml5.poseNet(video, () => {});

              poseNet.on('pose', (results: any[]) => {
                poses = results;
              });
            });
          }

          if (video && (video as any).elt.readyState >= 2 && poses.length > 0) {
            const pose = poses[0].pose;
            processPose(pose);
          }
        }

        // 5. Render Text
        if (textRef.current) {
          p.push();
          p.fill(26, 26, 26, 180);
          p.textFont('EB Garamond');
          p.textSize(12);
          p.textStyle(p.NORMAL);
          p.textAlign(p.CENTER, p.BOTTOM);
          p.text(textRef.current, p.width / 2, p.height - 24);
          p.pop();
        }
      };

      const processPose = (pose: any) => {
        // Use viscRef.current for latest value
        const currentVisc = viscRef.current;
        const leftWrist = pose.leftWrist;
        const rightWrist = pose.rightWrist;
        
        const videoToCanvas = (pt: any) => {
          const vw = (video as any).width || 1;
          const vh = (video as any).height || 1;
          return {
            x: p.map(pt.x, 0, vw, 0, OUT_W),
            y: p.map(pt.y, 0, vh, 0, OUT_H)
          };
        };

        const updateWrist = (rawPt: any, smoothed: any, side: string) => {
          if (rawPt.confidence > 0.15) {
            const target = videoToCanvas(rawPt);
            const sf = p.lerp(0.4, 0.08, currentVisc); 
            
            if (!smoothed.active) {
              smoothed.x = target.x; smoothed.y = target.y; smoothed.active = true;
              smoothed.seed = p.random(1000); // New seed for every new stroke integration
              smoothed.points = 0;
            } else {
              const prev = { x: smoothed.x, y: smoothed.y };
              smoothed.x = p.lerp(smoothed.x, target.x, sf);
              smoothed.y = p.lerp(smoothed.y, target.y, sf);
              smoothed.points++;
              renderBrush({x: smoothed.x, y: smoothed.y}, prev, side, smoothed.seed, smoothed.points);
            }
          } else {
            smoothed.active = false;
          }
        };

        updateWrist(leftWrist, smoothedWrists.left, 'left');
        updateWrist(rightWrist, smoothedWrists.right, 'right');
      };

      const renderBrush = (pos: {x: number, y: number}, prev: {x: number, y: number}, side: string, seed: number, strokeIndex: number) => {
        const currentVisc = viscRef.current;
        const currentChalk = chalkRef.current;
        const currentShape = shapeRef.current;
        const dist = p.dist(pos.x, pos.y, prev.x, prev.y);
        
        // Anti-jump: Skip frames with extreme tracking jitter
        if (dist < 0.1 * R_SCALE || dist > 150 * R_SCALE) return;

        const speedScale = p.constrain(dist / R_SCALE, 0, 40);
        const weightBase = p.lerp(2, 18, currentVisc) * R_SCALE;
        
        // Define alpha based on brush shape
        let alpha: number;
        if (currentShape === 'default') {
          // Dynamic non-linear mapping for extreme "Pop" and contrast
          const normSpeed = p.constrain(dist, 1, 30);
          const factor = p.pow((normSpeed - 1) / 29, 1.5); 
          // Set floor to ~40% opacity (100) and scale to full (255)
          // Also allow it to be even lower if dist is very small
          alpha = p.lerp(80, 255, factor);
          
          // --- STROKE LIFECYCLE (Heavy ends) ---
          // Use a bell-curve or decay for "Ink flow" - heavy at start of new placement
          const startHeavy = p.map(p.constrain(strokeIndex, 0, 10), 0, 10, 1.5, 1.0);
          const inkFlow = p.constrain(startHeavy, 1.0, 1.5);
          alpha *= inkFlow;
        } else {
          alpha = p.map(p.constrain(dist, 2, 25), 2, 25, 230, 90);
        }

        pg.push();
        
        const dx = pos.x - prev.x;
        const dy = pos.y - prev.y;
        const mag = p.sqrt(dx * dx + dy * dy);
        const px = (-dy / mag);
        const py = (dx / mag);

        if (currentShape === 'default') {
          // --- MASTER INK-WASH BRUSH (Living & Breathing) ---
          p.noiseSeed(seed);
          
          const maxBrushWidth = weightBase * 8.0;
          const brushWidth = p.map(p.constrain(speedScale, 0, 35), 0, 35, weightBase * 1.5, maxBrushWidth);
          
          // --- HEAD & TAIL PROFILE ---
          // Make the start of the entire stroke thinner, and thicken it as it progresses
          const startProfile = p.map(p.constrain(strokeIndex, 0, 25), 0, 25, 0.5, 1.2);
          const endProfile = p.map(p.constrain(strokeIndex + 0.5, 0, 25), 0, 25, 0.5, 1.2);
          
          // DYNAMIC BRISTLE COUNT: Increased by ~20% for a fuller core
          const bristleCount = p.floor(p.map(p.constrain(speedScale, 1, 35), 1, 35, 15, 60));
          
          for (let i = 0; i < bristleCount; i++) {
            // Gaussian-like distribution (center-weighted)
            let t = (i / (bristleCount - 1)) - 0.5;
            // Bias t towards the center to create a "dense core"
            t = p.pow(p.abs(t * 2), 1.2) * 0.5 * (t < 0 ? -1 : 1);
            
            const jitter = (p.noise(seed, i * 0.8, strokeIndex * 0.2) - 0.5) * 0.2;
            const distFromCenter = p.abs(t * 2); 
            
            // --- 1. DYNAMIC EROSION (Fei-bai / Dry Brush) ---
            const erosionNoise = p.noise(i * 0.6, strokeIndex * 0.12, p.frameCount * 0.05);
            // Edge-focused erosion: Core (center) is much more resistant to breaking
            const edgeErosion = p.map(distFromCenter, 0.3, 1.0, 0, 0.7);
            const speedErosion = p.map(speedScale, 2, 35, 0.3, 0.9); // Lowered max erosion
            
            if (erosionNoise < (speedErosion + edgeErosion)) {
              // Instead of just skipping, add grainy "dry ink" texture
              if (p.random() < 0.35 && speedScale > 5) {
                pg.noStroke();
                pg.fill(10, 10, 10, alpha * 0.18);
                // Randomized position for grain
                const grainOff = (t + jitter) * brushWidth * p.lerp(startProfile, endProfile, p.random());
                const rGrain = p.random(0.5, 1.5) * R_SCALE;
                pg.circle(pos.x + px * grainOff + p.random(-2, 2) * R_SCALE, pos.y + py * grainOff + p.random(-2, 2) * R_SCALE, rGrain);
              }
              // Lowered skip probability to avoid being too "dead/empty"
              if (p.random() < 0.85) continue; 
            }

            // --- 2. MULTI-LAYER TEXTURE (Ink Wash) ---
            let localAlpha = alpha;
            let bWeight = 0;
            
            // Internal texture noise (Paper grain simulation)
            const grainNoise = p.noise(i * 0.8, strokeIndex * 0.3, p.frameCount * 0.1);
            localAlpha *= p.map(grainNoise, 0, 1, 0.5, 1.0);

            if (distFromCenter < 0.3) {
              // The Dark Core - slightly less dark when slow
              localAlpha *= p.map(p.noise(i, strokeIndex * 0.1), 0, 1, 0.7, 1.3);
              bWeight = p.lerp(1.2, 3.8, p.noise(i * 2, seed));
            } else {
              // The Bleeding Fringe
              const fade = 1.0 - distFromCenter;
              localAlpha *= p.map(p.noise(i, strokeIndex * 0.05), 0, 1, 0.15, 0.7) * (0.2 + 0.8 * fade);
              bWeight = p.lerp(0.15, 1.2, p.noise(i, seed * 2));
            }

            pg.stroke(10, 10, 10, p.constrain(localAlpha, 0, 255));
            pg.strokeWeight(bWeight);
            pg.strokeCap(p.ROUND);
            
            // --- 3. DIRECTIONAL HAIR & JITTER ---
            const subSteps = 2; 
            pg.beginShape();
            pg.noFill();
            for (let s = 0; s <= subSteps; s++) {
              const st = s / subSteps;
              const lx = p.lerp(prev.x, pos.x, st);
              const ly = p.lerp(prev.y, pos.y, st);
              
              // Tapering width within the segment
              const currentScale = p.lerp(startProfile, endProfile, st);
              const offset = (t + jitter) * brushWidth * currentScale;

              const freq = p.map(distFromCenter, 0, 1, 0.05, 0.2); 
              const amp = p.map(distFromCenter, 0, 1, 1.5, 6) * R_SCALE;
              const wavyNoise = (p.noise(i * 12, strokeIndex * 0.2 + s * 0.8) - 0.5) * amp;
              
              // Longitudinal jitter (feathering) along the direction of travel
              const longBase = p.noise(i, seed) - 0.5;
              const longJitter = longBase * (speedScale * 0.5 + 5) * R_SCALE * (s === 0 ? -1 : 1);
              
              pg.vertex(
                lx + px * (offset + wavyNoise) + (dx/mag) * longJitter, 
                ly + py * (offset + wavyNoise) + (dy/mag) * longJitter
              );
            }
            pg.endShape();
          }

          // --- 4. ACCIDENTAL SPLINTERS (Stray Hairs) ---
          if (p.random() < 0.12) {
            const strayOff = (p.random(-0.5, 0.5) * brushWidth * 1.8);
            pg.strokeWeight(0.2 * R_SCALE);
            pg.stroke(10, 10, 10, alpha * 0.12);
            pg.line(prev.x, prev.y, pos.x + px * strayOff, pos.y + py * strayOff);
          }

          // --- 5. MICRO-SPLATTERS (INK SPRAY / FEIBAI) ---
          if (speedScale > 12) {
            const splatterChance = p.map(speedScale, 12, 45, 0.3, 0.98);
            if (p.random() < splatterChance) {
              const count = p.floor(p.map(speedScale, 12, 45, 6, 25));
              pg.noStroke();
              pg.fill(10, 10, 10, alpha * 0.6);
              for (let k = 0; k < count; k++) {
                const sDist = p.random(2, brushWidth * 2.8);
                const sAngle = p.random(p.TWO_PI);
                const sSize = p.random(0.2, 4.5) * R_SCALE;
                pg.circle(pos.x + p.cos(sAngle) * sDist, pos.y + p.sin(sAngle) * sDist, sSize);
              }
            }
          }

          // --- 6. BREATHING UNDERTONE ---
          const nVal = p.noise(p.frameCount * 0.04, seed);
          const waveOff = (nVal - 0.5) * brushWidth * 2.0;
          pg.noFill();
          pg.stroke(10, 10, 10, alpha * 0.06);
          pg.strokeWeight(0.5 * R_SCALE);
          pg.line(prev.x + px * waveOff, prev.y + py * waveOff, pos.x + px * waveOff, pos.y + py * waveOff);
        } else if (currentShape === 'flower') {
          // --- FLOWER BRUSH LOGIC ---
          // Creates organic, petal-like clusters inspired by the movement
          const petalCount = p.floor(p.lerp(3, 8, currentVisc));
          const size = p.map(speedScale, 0, 40, weightBase * 2, weightBase * 6);
          
          pg.noStroke();
          pg.fill(10, 10, 10, alpha * 0.2);
          
          for (let i = 0; i < petalCount; i++) {
            const ang = p.map(i, 0, petalCount, 0, p.TWO_PI) + (p.frameCount * 0.02);
            const rx = pos.x + p.cos(ang) * size * 0.3;
            const ry = pos.y + p.sin(ang) * size * 0.3;
            
            pg.push();
            pg.translate(rx, ry);
            pg.rotate(ang + p.HALF_PI);
            // Petal shape
            pg.beginShape();
            pg.vertex(0, 0);
            pg.bezierVertex(-size/4, -size/2, -size/2, -size, 0, -size);
            pg.bezierVertex(size/2, -size, size/4, -size/2, 0, 0);
            pg.endShape();
            pg.pop();
          }
          
          // Central stamen effect
          pg.stroke(10, 10, 10, alpha * 0.6);
          pg.strokeWeight(0.5 * R_SCALE);
          pg.line(prev.x, prev.y, pos.x, pos.y);
          
          if (p.random() < 0.1 * currentChalk) {
            pg.fill(192, 78, 53, alpha * 0.7);
            const rStamen = p.random(2, 5) * R_SCALE;
            pg.circle(pos.x + p.random(-5, 5) * R_SCALE, pos.y + p.random(-5, 5) * R_SCALE, rStamen);
          }
        }
        pg.pop();
      };
      
      (p as any).getPg = () => {
        return pg;
      };

      (p as any).clearCanvas = () => {
        pg.clear(0, 0, 0, 0);
      };
    };

    const instance = new ((p5 as any).default || p5 || (window as any).p5)(sketch, containerRef.current);
    p5InstanceRef.current = instance;

    return () => {
      instance.remove();
    };
  }, [videoSource]);

  return (
    <div className="relative h-full flex flex-col items-center justify-center">
      <div 
        ref={containerRef} 
        className="h-full aspect-[9/16] bg-[#F2F0E9] shadow-[0_40px_80px_rgba(26,26,26,0.1)] border border-[#1A1A1A]/5 relative overflow-hidden"
      >
        {/* Loading overlay removed as per user request */}
      </div>
      <div className="mt-8 flex gap-4 absolute -bottom-16">
        <button 
          onClick={() => {
            if (ref && 'current' in ref && ref.current) {
              ref.current.clearCanvas();
            }
          }}
          className="group relative px-8 py-3 flex flex-col items-center"
        >
          <span className="typewriter-meta !text-[9px] text-[#1A1A1A]/40 group-hover:text-[#C04E35] transition-colors mb-1">Reset_Canvas</span>
          <div className="w-12 h-[1px] bg-[#1A1A1A]/5 group-hover:bg-[#C04E35]/20 transition-colors" />
        </button>
      </div>
    </div>
  );
});

export default BodyMapCanvas;
