import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Download,
  Move,
  Maximize2,
  Film,
  Image as ImageIcon,
} from 'lucide-react';

export interface ZoomableMediaItem {
  type: 'image' | 'video';
  src: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  downloadFilename?: string;
}

interface MediaZoomModalProps {
  item: ZoomableMediaItem | null;
  onClose: () => void;
  isDark?: boolean;
}

export const MediaZoomModal: React.FC<MediaZoomModalProps> = ({
  item,
  onClose,
  isDark = false,
}) => {
  const [scale, setScale] = useState<number>(1.25);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!item) return null;

  const handleZoomIn = () => {
    setScale((prev) => Math.min(4.0, Number((prev + 0.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(0.5, Number((prev - 0.25).toFixed(2)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleReset = () => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      data-testid="media-zoom-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-5xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-sky-950/80 text-sky-400 border border-sky-800/60'
                  : 'bg-sky-50 text-sky-700 border border-sky-200'
              }`}
            >
              {item.type === 'video' ? (
                <Film className="w-4 h-4" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold truncate">{item.title}</h3>
                {item.badgeText && (
                  <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30">
                    {item.badgeText}
                  </span>
                )}
              </div>
              {item.subtitle && (
                <p
                  className={`text-xs truncate ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5">
            <div
              className={`flex items-center rounded-lg border p-0.5 ${
                isDark
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              <button
                type="button"
                data-testid="zoom-out-btn"
                onClick={handleZoomOut}
                title="Zoom Out (-)"
                className={`p-1.5 rounded-md transition-colors ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span
                data-testid="zoom-scale-badge"
                className="px-2.5 text-xs font-mono font-bold select-none min-w-[54px] text-center"
              >
                {Math.round(scale * 100)}%
              </span>

              <button
                type="button"
                data-testid="zoom-in-btn"
                onClick={handleZoomIn}
                title="Zoom In (+)"
                className={`p-1.5 rounded-md transition-colors ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="zoom-reset-btn"
                onClick={handleReset}
                title="Reset Zoom (100%)"
                className={`px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>100%</span>
              </button>
            </div>

            {/* Preset quick buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {[1, 1.5, 2, 3].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setScale(preset);
                    if (preset === 1) setPan({ x: 0, y: 0 });
                  }}
                  className={`px-2 py-1 rounded text-xs font-mono font-semibold border transition-colors ${
                    Math.abs(scale - preset) < 0.05
                      ? 'bg-sky-600 text-white border-sky-600'
                      : isDark
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {preset}x
                </button>
              ))}
            </div>

            <a
              href={item.src}
              download={item.downloadFilename || true}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <button
              type="button"
              data-testid="zoom-close-btn"
              onClick={onClose}
              title="Close Inspector"
              className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Zoom Canvas Area */}
        <div
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`relative flex-1 min-h-[380px] sm:min-h-[500px] bg-slate-950 flex items-center justify-center overflow-hidden select-none ${
            scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 120ms ease-out',
            }}
            className="flex items-center justify-center max-w-full max-h-full"
          >
            {item.type === 'image' ? (
              <img
                src={item.src}
                alt={item.title}
                draggable={false}
                className="max-h-[70vh] max-w-[85vw] object-contain rounded shadow-lg"
              />
            ) : (
              <video
                src={item.src}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[70vh] max-w-[85vw] object-contain rounded shadow-lg"
              />
            )}
          </div>

          {/* Bottom helper bar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/80 text-slate-200 text-[11px] flex items-center gap-3 pointer-events-none shadow-lg">
            <span className="flex items-center gap-1">
              <Maximize2 className="w-3 h-3 text-sky-400" />
              Scroll or click +/- to zoom ({Math.round(scale * 100)}%)
            </span>
            {scale > 1 && (
              <span className="flex items-center gap-1 text-teal-300">
                <Move className="w-3 h-3" />
                Drag to pan across ultrasound structures
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
