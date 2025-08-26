import React, { useEffect, useRef, useState } from 'react';
import { MicOff, Mic, Video, VideoOff } from 'lucide-react';

// React.memo prevents the component from re-rendering if its props haven't changed.
// This is CRITICAL to stop the flicker from the parent's timer.
const VideoTile = React.memo(({
  stream,
  name,
  isLocal,
  micOn,
  cameraOn,
  isAdmin,
  isSpeaking,
}) => {
  const videoRef = useRef(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayTimeoutRef = useRef(null);

  // This effect safely attaches the stream to the video element.
  // It runs only when the `stream` prop itself changes.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleMouseEnter = () => {
    setShowOverlay(true);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    overlayTimeoutRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, 2000);
  };

  const handleMouseLeave = () => {
    // Keep overlay for 2s after last hover; timer set on enter
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-white/5 group transition-shadow duration-300 ${isSpeaking ? 'ring-2 ring-success-500 shadow-glow' : 'shadow-soft'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '100%',
        height: '100%',
        minWidth: '100%',
        minHeight: '100%'
      }}
    >
      {/* Video Container - fills entire tile */}
      <div className="relative w-full h-full" style={{ width: '100%', height: '100%', minWidth: '100%', minHeight: '100%' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Local video should always be muted to prevent echo
          className={`w-full h-full object-fill transition-all duration-300 ${cameraOn ? 'opacity-100' : 'opacity-0'
            }`}
          style={{
            objectPosition: 'center',
            objectFit: 'fill',
            minWidth: '100%',
            minHeight: '100%',
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)' // Mirror all videos (both local and remote)
          }}
        />

        {/* Placeholder when camera is off */}
        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-700 to-neutral-800">
            <div className="w-20 h-20 rounded-full bg-brand-500/20 flex items-center justify-center border-2 border-brand-500/30">
              <span className="text-3xl font-bold text-brand-400">{name?.[0]?.toUpperCase() || '?'}</span>
            </div>
          </div>
        )}

        {/* Subtle gradient veil for readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

        {/* Hover Overlay: Name + Call status (2s) */}
        <div className={`absolute inset-x-2 bottom-2 transition-all duration-300 ${showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 shadow-soft">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                <span className="text-xs font-bold text-brand-400">{name?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <span className="text-white text-sm font-medium truncate">{name} {isLocal && '(You)'} {isAdmin && '(Admin)'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center ${micOn ? 'bg-success-500/15 text-success-400 border-success-500/30' : 'bg-error-500/15 text-error-400 border-error-500/30'}`}>
                {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </div>
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center ${cameraOn ? 'bg-success-500/15 text-success-400 border-success-500/30' : 'bg-error-500/15 text-error-400 border-error-500/30'}`}>
                {cameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </div>
            </div>
          </div>
        </div>

        {/* Local indicator */}
        {isLocal && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-brand-500/80 rounded-full shadow-soft">
            <span className="text-xs font-medium text-white">You</span>
          </div>
        )}

        {/* Admin indicator */}
        {isAdmin && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-warning-500/80 rounded-full shadow-soft" style={{ left: isLocal ? '3.5rem' : '0.5rem' }}>
            <span className="text-xs font-medium text-white">Admin</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default VideoTile;