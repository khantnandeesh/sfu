import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'

const socket = io(import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001')

export default function Lobby() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const [name, setName] = useState('')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const streamRef = useRef(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        if (!active) return
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (e) {
        console.error(e)
      }
    })()
    return () => { active = false; streamRef.current?.getTracks().forEach(t=>t.stop()) }
  }, [])

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks?.()[0]
    if (track) {
      track.enabled = !track.enabled
      setMuted(!track.enabled)
    }
  }
  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (track) {
      track.enabled = !track.enabled
      setCamOff(!track.enabled)
    }
  }
  const join = () => {
    navigate(`/call/${roomId}`, { state: { name: name || 'Guest' } })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl grid md:grid-cols-2 gap-6 items-start">
        <div className="aspect-video bg-neutral-900 rounded-lg overflow-hidden">
          <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Lobby</h2>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className="w-full bg-neutral-900 rounded-md px-3 py-2 outline-none" />
          <div className="flex gap-2">
            <button onClick={toggleMic} className="px-3 py-2 bg-neutral-800 rounded-md">{muted? 'Unmute':'Mute'}</button>
            <button onClick={toggleCam} className="px-3 py-2 bg-neutral-800 rounded-md">{camOff? 'Start Video':'Stop Video'}</button>
          </div>
          <button onClick={join} className="px-4 py-2 bg-brand-600 rounded-md">Join Call</button>
        </div>
      </div>
    </div>
  )
}


