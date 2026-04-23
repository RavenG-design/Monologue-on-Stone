/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import BodyMapCanvas, { BodyMapCanvasHandle } from './components/BodyMapCanvas';
import VideoUpload from './components/VideoUpload';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X } from 'lucide-react';

type Language = 'en' | 'zh';

const translations = {
  en: {
    title: "Monologue on Stone",
    subtitle: '"The wall is no longer stone, but a manuscript."',
    sourceIntegration: "Source Integration",
    mediumParameters: "Medium parameters",
    viscosity: "Viscosity",
    erasureResist: "Erasure_Resist",
    annotation: "Annotation",
    annotationPlaceholder: "Gym/Date/Grade",
    commit: "Share",
    download: "Download",
    gallery: "Gallery",
    information: "Information",
    loading: "climbing",
    kineticArchive: "Kinetic Archive",
    designBy: "Design by: @feeeefeei",
    modalTitle: "Navigating the Void",
    closeGuidance: "Close_Guidance",
    steps: [
      { t: "Ingestion", d: "Upload a video of your kinetic performance (climbing, bouldering, movement)." },
      { t: "Synthesis", d: "Watch the system parse your trajectory, translating muscle memory into charcoal ink." },
      { t: "Modulation", d: "Adjust Viscosity for fluid continuity and Erasure Resist for stroke permanence." },
      { t: "Inclusion", d: "Annotate your entry with personal metadata—dates, routes, or internal states." },
      { t: "Commitment", d: "Finalize the entry to download your kinetic cartography as a permanent archive." }
    ]
  },
  zh: {
    title: "石之独白",
    subtitle: "“岩壁不再是冰冷的石块，而是一卷长轴。”",
    sourceIntegration: "素材整合",
    mediumParameters: "媒介参数",
    viscosity: "粘稠度",
    erasureResist: "抹除阻尼",
    annotation: "标注",
    annotationPlaceholder: "Gym/Date/Grade",
    commit: "分享",
    download: "下载并存档",
    gallery: "展厅",
    information: "说明",
    loading: "攀登中",
    kineticArchive: "动能记录",
    designBy: "设计自: @feeeefeei",
    modalTitle: "虚无导航",
    closeGuidance: "关闭指引",
    steps: [
      { t: "摄入", d: "上传您的运能表演视频（攀岩、抱石或肢体律动）。" },
      { t: "合成", d: "观察系统如何解析您的轨迹，将肌肉记忆转化为炭黑墨迹。" },
      { t: "调节", d: "调节“粘稠度”以获得流体连续性，调节“抹除阻尼”以获得笔触持久性。" },
      { t: "收录", d: "用个人元数据（如日期、路线或内在状态）标注您的条目。" },
      { t: "承载", d: "完成条目以将您的动能制图下载为永久档案。" }
    ]
  }
};

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [viscosity, setViscosity] = useState(0.82);
  const [chalkIntensity, setChalkIntensity] = useState(0.45);
  const [commemorativeText, setCommemorativeText] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const canvasRef = useRef<BodyMapCanvasHandle>(null);

  const t = translations[language];

  const handleExport = () => {
    if (canvasRef.current) {
      canvasRef.current.downloadImage(`body-map-${Date.now()}.png`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F2F0E9] text-[#1A1A1A] font-serif paper-grain overflow-hidden selection:bg-[#C04E35] selection:text-white">
      {/* Integrated Sidebar: All Controls */}
      <aside className="w-[340px] border-r border-[#000]/10 flex flex-col p-10 bg-white/10 backdrop-blur-sm shrink-0 z-10 overflow-y-auto custom-scrollbar">
        <div className="space-y-3 mb-12">
          <h1 className="text-3xl serif-display tracking-tight text-[#000]">{t.title}</h1>
          <p className="typewriter-meta uppercase opacity-90">{t.subtitle}</p>
        </div>

        <div className="space-y-10 flex-1 text-[#000]">
          {/* Source Integration */}
          <div className="space-y-4">
             <p className="typewriter-meta opacity-80 font-medium">{t.sourceIntegration}</p>
             <VideoUpload onVideoUpload={setVideoSource} currentVideo={videoSource} />
          </div>

          {/* Medium Parameters */}
          <div className="space-y-8 pt-4 border-t border-[#000]/10">
             <p className="typewriter-meta opacity-80 font-medium">{t.mediumParameters}</p>
             <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="typewriter-meta">{t.viscosity}</span>
                    <span className="typewriter-meta text-[#A03D2A] font-bold">{viscosity.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={viscosity}
                    onChange={(e) => setViscosity(parseFloat(e.target.value))}
                    className="w-full h-[1px] bg-[#000]/20 appearance-none cursor-pointer accent-black"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="typewriter-meta">{t.erasureResist}</span>
                    <span className="typewriter-meta text-[#A03D2A] font-bold">{chalkIntensity.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={chalkIntensity}
                    onChange={(e) => setChalkIntensity(parseFloat(e.target.value))}
                    className="w-full h-[1px] bg-[#000]/20 appearance-none cursor-pointer accent-black"
                  />
                </div>
             </div>
          </div>

          {/* Annotation & Export */}
          <div className="space-y-8 pt-4 border-t border-[#000]/10">
            <div className="space-y-3">
              <label className="typewriter-meta opacity-80 text-[8px] block font-medium">{t.annotation}</label>
              <textarea 
                value={commemorativeText}
                onChange={(e) => setCommemorativeText(e.target.value)}
                placeholder={t.annotationPlaceholder}
                className="w-full bg-transparent border border-[#000]/20 p-4 text-[13px] font-serif text-[#000] focus:border-[#A03D2A] focus:outline-none transition-colors h-24 resize-none placeholder:opacity-30"
              />
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleExport}
                className="flex-1 border border-[#000] text-[#000] py-4 typewriter-meta !text-[9px] tracking-[0.1em] hover:bg-[#A03D2A] hover:border-[#A03D2A] hover:!text-[#F2F0E9] transition-all duration-500"
              >
                {t.commit}
              </button>
              <button 
                onClick={handleExport}
                className="flex-1 bg-[#000] !text-[#F2F0E9] py-4 typewriter-meta !text-[9px] tracking-[0.1em] hover:bg-[#A03D2A] transition-all duration-500"
              >
                {t.download}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="mt-12 space-y-4 pt-8 border-t border-[#000]/10">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="typewriter-meta opacity-70">{t.kineticArchive}</p>
              <div className="typewriter-meta !text-[8px] !lowercase leading-relaxed opacity-70 font-semibold">
                L: {videoSource ? 'x.442 y.891' : '0.00'}<br />
                R: {videoSource ? 'x.129 y.456' : '0.00'}
              </div>
            </div>
            <div className="text-right">
               <p className="typewriter-meta !text-[7px] opacity-60 tracking-widest whitespace-nowrap font-bold">{t.designBy}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content: Vast Gallery Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Top-right Controls */}
        <div className="absolute top-10 right-10 z-50 flex items-center gap-6">
          <button 
            className="group border-b border-transparent hover:border-[#000]/10 transition-colors py-1"
          >
            <span className="typewriter-meta !text-[10px] text-[#000] opacity-80 group-hover:opacity-100 tracking-[0.2em] font-bold">
              {t.gallery}
            </span>
          </button>

          <button 
            onClick={() => setLanguage(lang => lang === 'en' ? 'zh' : 'en')}
            className="group border-b border-transparent hover:border-[#000]/10 transition-colors py-1"
          >
            <span className="typewriter-meta !text-[10px] text-[#000] opacity-80 group-hover:opacity-100 tracking-[0.2em] font-bold">
              {language === 'en' ? '中' : 'ENG'}
            </span>
          </button>

          <button 
            onClick={() => setIsInfoOpen(true)}
            className="group border-b border-transparent hover:border-[#000]/10 transition-colors py-1"
          >
            <span className="typewriter-meta !text-[10px] text-[#000] opacity-80 group-hover:opacity-100 tracking-[0.2em] font-bold">
              {t.information}
            </span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={videoSource ? 'canvas' : 'empty'}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="z-10 w-full flex justify-center h-full max-h-[82vh]"
          >
            <BodyMapCanvas 
              ref={canvasRef}
              videoSource={videoSource} 
              onClear={() => setVideoSource(null)}
              viscosity={viscosity}
              chalkIntensity={chalkIntensity}
              commemorativeText={commemorativeText}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Onboarding Modal Overlay */}
      <AnimatePresence>
        {isInfoOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F2F0E9]/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#F2F0E9] border border-[#000]/10 p-10 max-w-xl w-full max-h-[720px] overflow-y-auto custom-scrollbar relative shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] paper-grain"
            >
              <button 
                onClick={() => setIsInfoOpen(false)}
                className="absolute top-6 right-6 p-2 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-5 h-5 text-[#000] stroke-[2px]" />
              </button>

              <div className="space-y-10">
                <div className="space-y-3">
                  <h2 className="text-4xl serif-display text-[#000]">{t.modalTitle}</h2>
                  <div className="h-[1px] w-12 bg-[#A03D2A]" />
                </div>

                <div className="space-y-6">
                  {t.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-8 group">
                      <span className="typewriter-meta opacity-60 group-hover:opacity-100 transition-opacity pt-1 font-bold">0{idx + 1}</span>
                      <div className="space-y-1">
                        <h3 className="typewriter-meta !text-[10px] text-[#000] font-bold">{step.t}</h3>
                        <p className="text-[#000] leading-relaxed text-[14px]">{step.d}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                   <button 
                    onClick={() => setIsInfoOpen(false)}
                    className="w-full bg-[#000] !text-[#F2F0E9] py-4 typewriter-meta !text-[10px] tracking-[0.2em] hover:bg-[#A03D2A] transition-colors"
                   >
                     {t.closeGuidance}
                   </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
