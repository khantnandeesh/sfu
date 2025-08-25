import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import VideoTile from './VideoTile'; // Make sure this path is correct
import { socket } from '../lib/socket';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Wrap the entire component in React.memo
const DraggableVideoGrid = React.memo(({ participants, isMobile, localStream }) => {
  const [layouts, setLayouts] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [focusedTile, setFocusedTile] = useState(null);
  const layoutsRef = useRef({});

  // Debug logging
  console.log('[DraggableVideoGrid] Participants:', participants);
  console.log('[DraggableVideoGrid] isMobile:', isMobile);
  console.log('[DraggableVideoGrid] localStream:', localStream);

  // All the internal logic of this component remains exactly the same as before.
  // The React.memo wrapper is the only change to the component's definition.
  const defaultLayouts = useMemo(() => {
    if (isMobile) {
      return { lg: participants.map((p, i) => ({ i: p.id, x: i % 2, y: Math.floor(i / 2), w: 1, h: 1, minW: 1, minH: 1, maxW: 2, maxH: 2, isDraggable: false, isResizable: false })) };
    }
    const desktopLayout = participants.map((p, i) => {
      if (i === 0) return { i: p.id, x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1, maxW: 4, maxH: 4, isDraggable: true, isResizable: true };
      if (i <= 4) { const x = (i - 1) % 3; const y = Math.floor((i - 1) / 3) + 2; return { i: p.id, x, y, w: 1, h: 1, minW: 1, minH: 1, maxW: 3, maxH: 3, isDraggable: true, isResizable: true }; }
      const x = (i - 5) % 4; const y = Math.floor((i - 5) / 4) + 4; return { i: p.id, x, y, w: 1, h: 1, minW: 1, minH: 1, maxW: 2, maxH: 2, isDraggable: true, isResizable: true };
    });
    return { lg: desktopLayout };
  }, [participants, isMobile]);

  useEffect(() => {
    const currentLayout = layoutsRef.current.lg || [];
    const currentParticipantIds = new Set(currentLayout.map(item => item.i));
    const newParticipantIds = new Set(participants.map(p => p.id));
    if (currentParticipantIds.size === newParticipantIds.size && [...currentParticipantIds].every(id => newParticipantIds.has(id))) {
      if (Object.keys(layouts).length === 0 && defaultLayouts.lg) { setLayouts(defaultLayouts); layoutsRef.current = defaultLayouts; } return;
    }
    let needsUpdate = false; let newLayout = [...currentLayout];
    const participantsToRemove = [...currentParticipantIds].filter(id => !newParticipantIds.has(id));
    if (participantsToRemove.length > 0) { needsUpdate = true; newLayout = newLayout.filter(item => !participantsToRemove.includes(item.i)); }
    const participantsToAdd = [...newParticipantIds].filter(id => !currentParticipantIds.has(id));
    if (participantsToAdd.length > 0) {
      needsUpdate = true;
      const defaultLgLayout = defaultLayouts.lg || [];
      for (const id of participantsToAdd) { const defaultItem = defaultLgLayout.find(item => item.i === id); if (defaultItem) newLayout.push(defaultItem); }
    }
    if (needsUpdate) { const newLayouts = { ...layouts, lg: newLayout }; setLayouts(newLayouts); layoutsRef.current = newLayouts; }
  }, [participants, isMobile, defaultLayouts, layouts]);

  const onLayoutChange = useCallback((currentLayout, allLayouts) => { layoutsRef.current = allLayouts; setLayouts(allLayouts); }, []);
  const onDragStart = useCallback(() => setIsDragging(true), []);
  const onDragStop = useCallback(() => setIsDragging(false), []);
  const onResizeStart = useCallback(() => setIsDragging(true), []);
  const onResizeStop = useCallback(() => setIsDragging(false), []);
  const resetLayout = useCallback(() => { setLayouts(defaultLayouts); layoutsRef.current = defaultLayouts; }, [defaultLayouts]);
  const toggleTileFocus = useCallback((participantId) => { setFocusedTile(prev => prev === participantId ? null : participantId); }, []);

  if (isMobile) {
    return (
      <div className="h-full w-full p-2"><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 h-full">
        {participants.map((participant, index) => (
          <motion.div key={participant.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: index * 0.1 }} className="w-full h-full">
            <VideoTile
              name={participant.name}
              stream={participant.stream || localStream}
              isSpeaking={participant.isSpeaking}
              cameraOn={participant.cameraOn}
              micOn={participant.micOn}
              isLocal={participant.id === socket?.id || participant.stream === localStream}
              isAdmin={participant.isAdmin}
            />
          </motion.div>
        ))}
      </div></div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{ width: '100%', height: '100%', margin: 0, padding: 0 }}>
      <div className="absolute top-2 right-2 z-10">
        <button onClick={resetLayout} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-all duration-200 border border-white/20">
          Reset Layout
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout w-full h-full"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={120}
        onLayoutChange={onLayoutChange}
        onDragStart={onDragStart}
        onDragStop={onDragStop}
        onResizeStart={onResizeStart}
        onResizeStop={onResizeStop}
        draggableHandle=".drag-handle"
        margin={[0, 0]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
        style={{
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0
        }}
      >
        {participants.map((participant) => (
          <div key={participant.id} className="relative group w-full h-full">
            <div className="drag-handle absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-move">
              <div className="w-6 h-6 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <GripVertical className="w-3 h-3 text-white" />
              </div>
            </div>

            <button onClick={() => toggleTileFocus(participant.id)} className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="w-6 h-6 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
                {focusedTile === participant.id ? <Minimize2 className="w-3 h-3 text-white" /> : <Maximize2 className="w-3 h-3 text-white" />}
              </div>
            </button>

            <div className={`w-full h-full transition-all duration-300 ${focusedTile === participant.id ? 'ring-2 ring-blue-500' : ''}`}>
              <VideoTile
                name={participant.name}
                stream={participant.stream || localStream}
                isSpeaking={participant.isSpeaking}
                cameraOn={participant.cameraOn}
                micOn={participant.micOn}
                isLocal={participant.id === socket?.id || participant.stream === localStream}
                isAdmin={participant.isAdmin}
              />
            </div>

            <div className="absolute bottom-1 right-1 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="w-full h-full border-r-2 border-b-2 border-white/50 rounded-br-lg"></div>
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-500/10 pointer-events-none z-30"
          />
        )}
      </AnimatePresence>
    </div>
  );
});

export default DraggableVideoGrid;