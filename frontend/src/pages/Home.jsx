import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { io } from 'socket.io-client'
import { motion } from 'framer-motion'
import {
  Video,
  Users,
  Plus,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Globe
} from 'lucide-react'

const socket = io(import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001')

export default function Home() {
  const navigate = useNavigate()
  const [joinUrl, setJoinUrl] = useState('')

  const createMeeting = () => {
    socket.emit('createRoom', (res) => {
      if (res?.roomId) {
        navigate(`/lobby/${res.roomId}`, {
          state: {
            name: 'Your Name',
            isCreator: true,
            customMeetingName: ''
          }
        })
      }
    })
  }

  const tryJoin = () => {
    try {
      const url = new URL(joinUrl)
      const parts = url.pathname.split('/')
      const id = parts[parts.length - 1]
      if (id) {
        navigate(`/lobby/${id}`, {
          state: {
            name: 'Your Name',
            isCreator: false,
            customMeetingName: ''
          }
        })
      }
    } catch (_) { }
  }

  const features = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Enterprise Security",
      description: "Bank-level encryption and secure connections"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast",
      description: "Optimized for low latency and high quality"
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Global Reach",
      description: "Connect with anyone, anywhere in the world"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl space-y-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6"
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-400 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>Professional Video Conferencing</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Connect with
              <span className="block bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                Confidence
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed">
              Experience crystal-clear video calls with enterprise-grade security.
              Perfect for business meetings, team collaboration, and remote work.
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={createMeeting}
                className="group flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold rounded-2xl shadow-glow transition-all duration-300"
              >
                <Plus className="w-5 h-5" />
                <span>Create New Meeting</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </motion.button>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center space-x-2 text-neutral-400 text-sm">
                <div className="w-8 h-0.5 bg-neutral-600" />
                <span>or join existing</span>
                <div className="w-8 h-0.5 bg-neutral-600" />
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <div className="flex items-center space-x-3 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
                <input
                  value={joinUrl}
                  onChange={e => setJoinUrl(e.target.value)}
                  placeholder="Paste meeting link here..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-neutral-400 text-sm"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={tryJoin}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all duration-200 border border-white/20"
                >
                  Join
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center text-brand-400 mb-4 group-hover:bg-brand-500/30 transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center space-x-6 text-neutral-400 text-sm">
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4" />
                <span>HD Video</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Unlimited Participants</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}


