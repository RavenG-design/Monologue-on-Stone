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
        p5InstanceRef.current.saveCanvas(filename);
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
      // ... existing variables ...
      let video: p5.Element;
      let poseNet: any;
      let poses: any[] = [];
      let canvas: p5.Renderer;
      let pg: p5.Graphics; // Offscreen graphics for the drawing
      let paperTexture: p5.Image;

      // ... smoothedWrists ...
      let smoothedWrists = {
        left: { x: 0, y: 0, active: false },
        right: { x: 0, y: 0, active: false }
      };

      p.setup = () => {
        const containerHeight = containerRef.current?.clientHeight || 800;
        const containerWidth = (containerHeight * 9) / 16;
        canvas = p.createCanvas(containerWidth, containerHeight);
        p.noStroke();
        
        pg = p.createGraphics(p.width, p.height);
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
        p.image(pg, 0, 0);

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
            x: p.map(pt.x, 0, vw, 0, p.width),
            y: p.map(pt.y, 0, vh, 0, p.height)
          };
        };

        const updateWrist = (rawPt: any, smoothed: any, side: string) => {
          if (rawPt.confidence > 0.15) {
            const target = videoToCanvas(rawPt);
            const sf = p.lerp(0.4, 0.08, currentVisc); 
            
            if (!smoothed.active) {
              smoothed.x = target.x; smoothed.y = target.y; smoothed.active = true;
            } else {
              const prev = { x: smoothed.x, y: smoothed.y };
              smoothed.x = p.lerp(smoothed.x, target.x, sf);
              smoothed.y = p.lerp(smoothed.y, target.y, sf);
              renderBrush({x: smoothed.x, y: smoothed.y}, prev, side);
            }
          } else {
            smoothed.active = false;
          }
        };

        updateWrist(leftWrist, smoothedWrists.left, 'left');
        updateWrist(rightWrist, smoothedWrists.right, 'right');
      };

      const renderBrush = (pos: {x: number, y: number}, prev: {x: number, y: number}, side: string) => {
        const currentVisc = viscRef.current;
        const currentChalk = chalkRef.current;
        const currentShape = shapeRef.current;
        const dist = p.dist(pos.x, pos.y, prev.x, prev.y);
        
        // Anti-jump: Skip frames with extreme tracking jitter
        if (dist < 0.1 || dist > 60) return;

        const speedScale = p.constrain(dist, 0, 40);
        const weightBase = p.lerp(1, 15, currentVisc);
        const alpha = p.map(p.constrain(dist, 2, 25), 2, 25, 230, 90);

        pg.push();
        
        const dx = pos.x - prev.x;
        const dy = pos.y - prev.y;
        const mag = p.sqrt(dx * dx + dy * dy);
        const px = (-dy / mag);
        const py = (dx / mag);

        if (currentShape === 'default') {
          // --- FLAT BRUSH LOGIC ---
          const brushWidth = p.map(p.constrain(speedScale, 0, 35), 0, 35, weightBase * 0.5, weightBase * 4.5);
          const bristleCount = p.floor(p.lerp(6, 16, currentVisc));
          for (let i = 0; i < bristleCount; i++) {
            const t = (i / (bristleCount - 1 || 1)) - 0.5;
            const offset = t * brushWidth;
            const stagger = p.noise(i, p.frameCount * 0.1) * 3;
            pg.strokeCap(p.SQUARE);
            pg.strokeWeight(p.lerp(0.5, 2.5, p.noise(i, p.frameCount)));
            pg.stroke(10, 10, 10, alpha * (0.6 + p.random(0.4)));
            pg.line(prev.x + px * offset, prev.y + py * offset, pos.x + px * offset + stagger, pos.y + py * offset + stagger);
          }

          if (speedScale > 10) {
            const longBristleCount = 3;
            for (let i = 0; i < longBristleCount; i++) {
              const offset = (p.random() - 0.5) * brushWidth * 1.2;
              pg.strokeWeight(0.5);
              pg.stroke(10, 10, 10, alpha * 0.3);
              pg.line(prev.x + px * offset, prev.y + py * offset, pos.x + px * offset * 1.5, pos.y + py * offset * 1.5);
            }
          }

          // --- 3. BREATHING WAVES (Random Wavy Lines) ---
          // Creates rhythmic, noise-driven waves that follow the brush stroke for a "living" feel
          const numWaves = p.floor(p.lerp(1, 3, currentVisc));
          for (let i = 0; i < numWaves; i++) {
            pg.noFill();
            pg.stroke(10, 10, 10, alpha * 0.12);
            pg.strokeWeight(0.35);
            pg.beginShape();
            const waveSteps = 4;
            for (let j = 0; j <= waveSteps; j++) {
              const lx = p.lerp(prev.x, pos.x, j / waveSteps);
              const ly = p.lerp(prev.y, pos.y, j / waveSteps);
              // Use p5 noise for smooth, breathing oscillations
              const nVal = p.noise(p.frameCount * 0.04 + i * 10, j * 0.4);
              const waveOff = (nVal - 0.5) * brushWidth * 2.2;
              pg.curveVertex(lx + px * waveOff, ly + py * waveOff);
            }
            pg.endShape();
          }

          if (speedScale > 12) {
            pg.noFill();
            pg.stroke(10, 10, 10, alpha * 0.1);
            pg.strokeWeight(0.3);
            const midX = (prev.x + pos.x) / 2;
            const midY = (prev.y + pos.y) / 2;
            const orbitScale = p.map(speedScale, 12, 40, 1, 3);
            pg.beginShape();
            pg.vertex(prev.x, prev.y);
            pg.quadraticVertex(midX + px * brushWidth * orbitScale, midY + py * brushWidth * orbitScale, pos.x, pos.y);
            pg.endShape();
          }

          if (dist > 5) {
            const steps = p.floor(dist / 4) + 1;
            pg.noStroke();
            pg.fill(10, 10, 10, alpha * 0.05);
            for (let i = 0; i <= steps; i++) {
               const lx = p.lerp(prev.x, pos.x, i / steps);
               const ly = p.lerp(prev.y, pos.y, i / steps);
               pg.ellipse(lx, ly, brushWidth * 0.8, brushWidth * 0.3);
               if (p.random() < 0.04 * currentChalk) {
                  pg.fill(192, 78, 53, alpha * 0.5);
                  pg.circle(lx + p.random(-brushWidth/2, brushWidth/2), ly + p.random(-brushWidth/2, brushWidth/2), p.random(1, 2));
                  pg.fill(10, 10, 10, alpha * 0.05);
               }
            }
          }
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
          pg.strokeWeight(0.5);
          pg.line(prev.x, prev.y, pos.x, pos.y);
          
          if (p.random() < 0.1 * currentChalk) {
            pg.fill(192, 78, 53, alpha * 0.7);
            pg.circle(pos.x + p.random(-5, 5), pos.y + p.random(-5, 5), p.random(2, 5));
          }
        }
        pg.pop();
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
