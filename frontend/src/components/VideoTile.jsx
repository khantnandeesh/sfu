export default function VideoTile({ name, stream, isSpeaking, cameraOn }) {
  return (
    <div className={`relative rounded-lg overflow-hidden bg-neutral-900 ${isSpeaking ? 'ring-2 ring-brand-600' : ''}`}>
      {cameraOn && stream ? (
        <video autoPlay playsInline ref={el=>{ if(el && stream) el.srcObject = stream }} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full aspect-video flex items-center justify-center text-xl font-medium bg-neutral-800">{name?.[0]?.toUpperCase() || '?'}</div>
      )}
      <div className="absolute bottom-2 left-2 right-2 text-sm bg-black/40 px-2 py-1 rounded">{name}</div>
    </div>
  )
}


