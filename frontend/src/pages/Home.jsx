import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { io } from 'socket.io-client'

const socket = io(import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001')

export default function Home() {
  const navigate = useNavigate()
  const [joinUrl, setJoinUrl] = useState('')

  const createMeeting = () => {
    socket.emit('createRoom', (res) => {
      if (res?.roomId) {
        navigate(`/lobby/${res.roomId}`)
      }
    })
  }

  const tryJoin = () => {
    try {
      const url = new URL(joinUrl)
      const parts = url.pathname.split('/')
      const id = parts[parts.length - 1]
      if (id) navigate(`/lobby/${id}`)
    } catch (_) { }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6">
        <h1 className="text-3xl font-semibold">Start a call</h1>
        <div className="flex items-center gap-3">
          <button onClick={createMeeting} className="px-4 py-2 bg-brand-600 rounded-md">Create New Meeting</button>
          <div className="flex-1 flex gap-2">
            <input value={joinUrl} onChange={e => setJoinUrl(e.target.value)} placeholder="Paste meeting link" className="flex-1 bg-neutral-900 rounded-md px-3 py-2 outline-none" />
            <button onClick={tryJoin} className="px-3 py-2 bg-neutral-800 rounded-md">Join</button>
          </div>
        </div>
      </div>
    </div>
  )
}


