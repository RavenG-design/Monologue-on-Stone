import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import p5 from 'p5';

interface BodyMapCanvasProps {
  videoSource: string | null;
  onClear: () => void;
  viscosity: number;
  chalkIntensity: number;
  commemorativeText: string;
}

export interface BodyMapCanvasHandle {
  downloadImage: (filename?: string) => void;
  clearCanvas: () => void;
}

const BodyMapCanvas = forwardRef<BodyMapCanvasHandle, BodyMapCanvasProps>(({ videoSource, onClear, viscosity, chalkIntensity, commemorativeText }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  
  // Refs to allow p5 to access latest props without restarting the sketch
  const textRef = useRef(commemorativeText);
  const viscRef = useRef(viscosity);
  const chalkRef = useRef(chalkIntensity);

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
          p.textStyle(p.ITALIC);
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
        const dist = p.dist(pos.x, pos.y, prev.x, prev.y);
        if (dist < 0.1) return;

        const speedScale = p.constrain(dist, 0, 40);
        const weightBase = p.lerp(1, 22, currentVisc);
        const weight = p.map(speedScale, 0, 40, weightBase * 1.3, weightBase * 0.2);
        const alpha = p.map(p.constrain(dist, 2, 20), 2, 20, 180, 60);

        pg.push();
        // Deep Charcoal ink - unified to avoid any potential blue tint
        const inkColor = p.color(26, 26, 26);
        
        const numBristles = p.floor(p.lerp(3, 8, currentVisc));
        for (let i = 0; i < numBristles; i++) {
          const offset = p.map(i, 0, numBristles - 1, -weight/2, weight/2);
          const noiseVal = p.noise(p.frameCount * 0.1, i) * 3;
          pg.stroke(p.red(inkColor), p.green(inkColor), p.blue(inkColor), alpha * 0.8);
          pg.strokeWeight(p.lerp(0.8, 2.5, 1 - speedScale/40));
          pg.line(prev.x + offset + noiseVal, prev.y, pos.x + offset + noiseVal, pos.y);
        }

        if (dist < 4) {
          pg.noStroke();
          pg.fill(p.red(inkColor), p.green(inkColor), p.blue(inkColor), alpha * 0.4);
          pg.rectMode(p.CENTER);
          pg.rect(pos.x, pos.y, weight * 0.5, weight * 1.4);
        }

        // Drip lines removed per request
        
        // --- 4. VERMILION ACCENTS (Traditional Red Splatter) ---
        // Only splatter once some basic distance has been covered and enough frames have passed
        if (dist > 12 * (1 - currentChalk) && p.frameCount > 120) {
          const count = p.floor(p.random(1, 6) * currentChalk);
          pg.noStroke();
          for (let i = 0; i < count; i++) {
            const rx = pos.x + p.random(-weight * 4, weight * 4);
            const ry = pos.y + p.random(-weight * 4, weight * 4);
            const rs = p.random(0.8, 1.2 + currentChalk * 5);
            
            // Muted Vermilion red
            if (p.random() < 0.15 * currentChalk) {
              pg.fill(192, 78, 53, alpha * 0.9);
            } else {
              pg.fill(26, 26, 26, alpha * 0.1);
            }
            pg.circle(rx, ry, rs);
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
