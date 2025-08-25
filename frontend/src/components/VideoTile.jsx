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
}) => {
  const videoRef = useRef(null);
  const [showName, setShowName] = useState(false);
  const nameTimeoutRef = useRef(null);

  // This effect safely attaches the stream to the video element.
  // It runs only when the `stream` prop itself changes.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleMouseEnter = () => {
    setShowName(true);
    // Clear any existing timeout
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    // Hide name after 2.5 seconds
    nameTimeoutRef.current = setTimeout(() => {
      setShowName(false);
    }, 2500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (nameTimeoutRef.current) {
        clearTimeout(nameTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full h-full bg-neutral-800 rounded-lg overflow-hidden shadow-lg group"
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

        {/* Status Icons - Top Right */}
        <div className="absolute top-2 right-2 flex flex-col space-y-1">
          {/* Mic Status */}
          <div className={`p-1.5 rounded-full transition-all duration-200 ${micOn
            ? 'bg-green-500/80 text-white'
            : 'bg-red-500/80 text-white'
            }`}>
            {micOn ? (
              <Mic className="w-3 h-3" />
            ) : (
              <MicOff className="w-3 h-3" />
            )}
          </div>

          {/* Camera Status */}
          <div className={`p-1.5 rounded-full transition-all duration-200 ${cameraOn
            ? 'bg-green-500/80 text-white'
            : 'bg-red-500/80 text-white'
            }`}>
            {cameraOn ? (
              <Video className="w-3 h-3" />
            ) : (
              <VideoOff className="w-3 h-3" />
            )}
          </div>
        </div>

        {/* Name Overlay - Bottom with hover effect */}
        <div className={`absolute bottom-0 left-0 w-full transition-all duration-300 ${showName ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
          <div className="p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex items-center space-x-2">
              <span className="text-white text-sm font-medium drop-shadow-lg">
                {name} {isLocal && '(You)'}
              </span>
            </div>
          </div>
        </div>

        {/* Local indicator */}
        {isLocal && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-brand-500/80 rounded-full">
            <span className="text-xs font-medium text-white">You</span>
          </div>
        )}

        {/* Admin indicator */}
        {isAdmin && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-warning-500/80 rounded-full">
            <span className="text-xs font-medium text-white">Admin</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default VideoTile;