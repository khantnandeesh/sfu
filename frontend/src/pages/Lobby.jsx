import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import { motion } from 'framer-motion'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Copy,
  Check,
  ArrowRight,
  Settings,
  X
} from 'lucide-react'

const socket = io(import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001')

export default function Lobby() {
  const { roomId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const name = state?.name || 'Guest'
  const isCreator = state?.isCreator || false
  const customMeetingName = state?.customMeetingName || ''

  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [copied, setCopied] = useState(false)
  const [meetingName, setMeetingName] = useState(customMeetingName || `Meeting ${roomId}`)
  const [showNameEdit, setShowNameEdit] = useState(false)
  const [editingName, setEditingName] = useState(meetingName)
  const [userName, setUserName] = useState(name)
  const [showUserNameEdit, setShowUserNameEdit] = useState(false)
  const [editingUserName, setEditingUserName] = useState(name)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let active = true
      ; (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          if (!active) return
          streamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
        } catch (e) {
          console.error(e)
        }
      })()
    return () => { active = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks?.()[0]
    if (track) {
      track.enabled = !track.enabled
      setMicOn(!track.enabled)
    }
  }

  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (track) {
      track.enabled = !track.enabled
      setCamOn(!track.enabled)
    }
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy room ID:', err)
    }
  }

  const saveMeetingName = () => {
    if (editingName.trim() && editingName !== meetingName) {
      setMeetingName(editingName.trim())
    }
    setShowNameEdit(false)
  }

  const cancelNameEdit = () => {
    setEditingName(meetingName)
    setShowNameEdit(false)
  }

  // Update editing name when meeting name changes
  useEffect(() => {
    setEditingName(meetingName)
  }, [meetingName])

  // Update editing user name when user name changes
  useEffect(() => {
    setEditingUserName(userName)
  }, [userName])

  const saveUserName = () => {
    if (editingUserName.trim() && editingUserName !== userName) {
      setUserName(editingUserName.trim())
    }
    setShowUserNameEdit(false)
  }

  const cancelUserNameEdit = () => {
    setEditingUserName(userName)
    setShowUserNameEdit(false)
  }

  const joinCall = () => {
    navigate(`/call/${roomId}`, {
      state: {
        name: userName,
        isCreator,
        customMeetingName: meetingName
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-6xl space-y-8">
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-brand-500/20 rounded-2xl flex items-center justify-center">
              <Video className="w-8 h-8 text-brand-500" />
            </div>

            {/* Meeting Name Section */}
            <div className="mb-4">
              {showNameEdit ? (
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveMeetingName()}
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-lg font-semibold focus:outline-none focus:border-brand-500 text-center min-w-0"
                    placeholder="Enter meeting name"
                    autoFocus
                  />
                  <button
                    onClick={saveMeetingName}
                    className="p-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg transition-all duration-200"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelNameEdit}
                    className="p-2 bg-white/10 hover:bg-white/20 text-neutral-300 rounded-lg transition-all duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h1
                  className="text-2xl sm:text-3xl font-bold text-white mb-2 cursor-pointer hover:text-brand-400 transition-colors duration-200"
                  onClick={() => isCreator && setShowNameEdit(true)}
                  title={isCreator ? "Click to edit meeting name" : ""}
                >
                  {meetingName}
                </h1>
              )}

              {isCreator && (
                <p className="text-sm text-neutral-400">
                  {showNameEdit ? "Press Enter to save" : "Click meeting name to edit"}
                </p>
              )}
            </div>

            <p className="text-lg text-neutral-300">
              Get ready to join your video call
            </p>
          </motion.div>

          {/* Room ID Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-md mx-auto"
          >
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse" />
                  <span className="text-sm text-neutral-400">Room ID:</span>
                  <span className="font-mono text-white font-medium">{roomId}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={copyRoomId}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all duration-200"
                >
                  {copied ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Video Preview */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-4"
            >
              <div className="aspect-video bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl overflow-hidden border border-white/10 shadow-large">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Video Controls */}
              <div className="flex items-center justify-center space-x-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMic}
                  className={`p-3 rounded-xl font-medium transition-all duration-200 ${micOn
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    : 'bg-error-500/20 hover:bg-error-500/30 text-error-400 border border-error-500/30'
                    }`}
                >
                  {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleCam}
                  className={`p-3 rounded-xl font-medium transition-all duration-200 ${camOn
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    : 'bg-warning-500/20 hover:bg-warning-500/30 text-warning-400 border border-warning-500/30'
                    }`}
                >
                  {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </motion.button>
              </div>
            </motion.div>

            {/* Settings Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-6"
            >
              <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-brand-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Meeting Settings</h3>
                </div>

                <div className="space-y-6">
                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Your Name</label>
                    {showUserNameEdit ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editingUserName}
                          onChange={e => setEditingUserName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveUserName()}
                          placeholder="Enter your display name"
                          className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200 text-white placeholder-neutral-400"
                          autoFocus
                        />
                        <button
                          onClick={saveUserName}
                          className="p-3 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-xl transition-all duration-200"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelUserNameEdit}
                          className="p-3 bg-white/10 hover:bg-white/20 text-neutral-300 rounded-xl transition-all duration-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={userName}
                          readOnly
                          placeholder="Enter your display name"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white cursor-pointer hover:border-white/20 transition-all duration-200"
                        />
                        <button
                          onClick={() => setShowUserNameEdit(true)}
                          className="p-3 bg-white/10 hover:bg-white/20 text-neutral-300 rounded-xl transition-all duration-200"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={joinCall}
                      disabled={!userName.trim()}
                      className="group w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:from-neutral-600 disabled:to-neutral-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-glow transition-all duration-300"
                    >
                      <span>Join Meeting</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-brand-500/30 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-brand-400 text-xs font-bold">i</span>
                  </div>
                  <div className="text-sm text-brand-300">
                    <p className="font-medium mb-1">Pro Tips:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Test your microphone and camera before joining</li>
                      <li>• Use a quiet environment for better audio quality</li>
                      <li>• Ensure good lighting for clear video</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}


