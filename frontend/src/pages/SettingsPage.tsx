import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, Sliders, Cpu, Save, 
  ShieldCheck, Database, Info, ExternalLink
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [ocrEngine, setOcrEngine] = useState<string>('demo');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.65);
  const [speedThreshold, setSpeedThreshold] = useState<number>(120);
  const [autoScanInterval, setAutoScanInterval] = useState<number>(3);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSave = () => {
    localStorage.setItem('nayan_ocr_engine', ocrEngine);
    localStorage.setItem('nayan_confidence_threshold', String(confidenceThreshold));
    localStorage.setItem('nayan_speed_threshold', String(speedThreshold));
    localStorage.setItem('nayan_autoscan_interval', String(autoScanInterval));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-4 max-w-4xl font-sans">
      {/* Header */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <SettingsIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>CORE SYSTEM PARAMETERS & VISION TUNING</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Platform Configuration & Engine Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Tune computer vision parameters, anomaly speed limits, and modular OCR engine adapters.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs shadow-xs transition-colors cursor-pointer border border-blue-400/40"
        >
          <Save className="w-3.5 h-3.5" />
          <span>SAVE CHANGES</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Platform configuration successfully persisted.</span>
        </div>
      )}

      {/* OCR ADAPTER SETTINGS */}
      <div className="p-4 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-3 font-mono">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span>Pluggable Optical OCR Engine Selection</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'demo',
              title: 'OpenCV Heuristic Engine',
              desc: 'Contour localization, aspect ratio filters, and template correlation. CPU optimized; zero external weights needed.',
              installed: true,
              tag: 'DEFAULT ACTIVE'
            },
            {
              id: 'paddleocr',
              title: 'PaddleOCR Adapter',
              desc: 'High-accuracy deep learning OCR model. Pluggable Python module (pip install paddlepaddle paddleocr).',
              installed: false,
              tag: 'PLUG-IN MODULE'
            },
            {
              id: 'easyocr',
              title: 'EasyOCR Adapter',
              desc: 'PyTorch-based CRAFT + CRNN text recognition plugin (pip install easyocr).',
              installed: false,
              tag: 'PLUG-IN MODULE'
            }
          ].map(eng => (
            <div
              key={eng.id}
              onClick={() => setOcrEngine(eng.id)}
              className={`p-3.5 rounded border cursor-pointer transition-all ${
                ocrEngine === eng.id
                  ? 'bg-[#131F37] border-blue-500 shadow-xs'
                  : 'bg-[#090E1A] border-[#1E293B] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs text-slate-100">{eng.title}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  ocrEngine === eng.id 
                    ? 'bg-blue-600 text-white font-bold border-blue-500' 
                    : 'bg-[#090E1A] text-slate-400 border-[#1E293B]'
                }`}>
                  {eng.tag}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                {eng.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* COMPUTER VISION & THRESHOLDS */}
      <div className="p-4 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-4 font-mono text-xs">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-blue-400" />
          <span>Computer Vision & Kinematic Limits</span>
        </h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-bold">OCR Confidence Gate Threshold</label>
              <span className="text-blue-400 font-bold">{Math.round(confidenceThreshold * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.4}
              max={0.95}
              step={0.05}
              value={confidenceThreshold}
              onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#090E1A] border border-[#1E293B] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Detections with confidence scores beneath this gate will be disregarded to avoid false positive plate logs.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-bold">Kinematic Speed Anomaly Trigger</label>
              <span className="text-rose-400 font-bold">{speedThreshold} km/h</span>
            </div>
            <input
              type="range"
              min={80}
              max={180}
              step={5}
              value={speedThreshold}
              onChange={e => setSpeedThreshold(parseInt(e.target.value))}
              className="w-full h-1.5 bg-[#090E1A] border border-[#1E293B] rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Calculated inter-camera speeds exceeding this threshold trigger instantaneous Kinematic Anomaly security flags.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-bold">Continuous Optical Sampling Interval</label>
              <span className="text-slate-200 font-bold">{autoScanInterval} seconds</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={autoScanInterval}
              onChange={e => setAutoScanInterval(parseInt(e.target.value))}
              className="w-full h-1.5 bg-[#090E1A] border border-[#1E293B] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
