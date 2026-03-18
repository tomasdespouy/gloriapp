"use client";

import { useState } from "react";
import { X, Image, Film } from "lucide-react";

interface Props {
  src: string;
  videoSrc: string;
  alt: string;
}

export default function PatientImageModal({ src, videoSrc, alt }: Props) {
  const [open, setOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoAvailable, setVideoAvailable] = useState(true);

  const handleOpen = () => {
    setOpen(true);
    setShowVideo(false);
  };

  return (
    <>
      <button onClick={handleOpen} className="flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-24 h-24 rounded-2xl object-cover bg-gray-100 shadow-sm"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>

            <div className="rounded-2xl overflow-hidden bg-gray-900" style={{ width: 400, height: 400 }}>
              {showVideo ? (
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  onError={() => {
                    setVideoAvailable(false);
                    setShowVideo(false);
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={alt}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Toggle + name */}
            <div className="flex items-center justify-between mt-3">
              <p className="text-white/60 text-sm">{alt}</p>
              {videoAvailable && (
                <button
                  onClick={() => setShowVideo(!showVideo)}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors bg-white/10 px-3 py-1.5 rounded-lg"
                >
                  {showVideo ? <Image size={13} /> : <Film size={13} />}
                  {showVideo ? "Ver foto" : "Ver video"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
