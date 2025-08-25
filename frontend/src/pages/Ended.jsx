import { motion } from 'framer-motion'
import { PhoneOff, Home, RefreshCw, Users, Clock, CheckCircle, Calendar, User, Hash } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Ended() {
  const location = useLocation()
  const navigate = useNavigate()
  const callDetails = location.state || {}

  const {
    meetingName = 'Call Ended',
    roomId = 'Unknown',
    startTime = 'Unknown',
    endTime = 'Unknown',
    totalDuration = 0,
    formattedDuration = '00:00:00',
    participants = [],
    totalParticipants = 0,
    creator = false
  } = callDetails

  const formatTime = (timeString) => {
    if (timeString === 'Unknown' || !timeString) return 'Unknown'
    try {
      // Handle both timestamp numbers and date strings
      const date = typeof timeString === 'number' ? new Date(timeString) : new Date(timeString)
      if (isNaN(date.getTime())) return 'Unknown'

      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 mx-auto mb-6 bg-error-500/20 rounded-full flex items-center justify-center">
            <PhoneOff className="w-10 h-10 text-error-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {meetingName}
          </h1>
          <p className="text-neutral-400 text-lg">
            Call has ended
          </p>
        </motion.div>

        {/* Call Details Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        >
          {/* Meeting Info */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-brand-500/20 rounded-xl mb-4 mx-auto">
              <Hash className="w-6 h-6 text-brand-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Meeting ID</h3>
            <p className="text-neutral-400 font-mono text-sm">{roomId}</p>
          </div>

          {/* Duration */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-success-500/20 rounded-xl mb-4 mx-auto">
              <Clock className="w-6 h-6 text-success-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Duration</h3>
            <p className="text-2xl font-bold text-success-400">{formattedDuration}</p>
          </div>

          {/* Participants */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-xl mb-4 mx-auto">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Participants</h3>
            <p className="text-2xl font-bold text-purple-400">{totalParticipants}</p>
          </div>

          {/* Start Time */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-xl mb-4 mx-auto">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Started</h3>
            <p className="text-neutral-400 text-sm">{formatTime(startTime)}</p>
          </div>

          {/* End Time */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-orange-500/20 rounded-xl mb-4 mx-auto">
              <Calendar className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Ended</h3>
            <p className="text-neutral-400 text-sm">{formatTime(endTime)}</p>
          </div>

          {/* Creator Status */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-yellow-500/20 rounded-xl mb-4 mx-auto">
              <User className="w-6 h-6 text-yellow-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Your Role</h3>
            <p className="text-neutral-400 text-sm">
              {creator ? 'Meeting Creator' : 'Participant'}
            </p>
          </div>
        </motion.div>

        {/* Participants List */}
        {participants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8"
          >
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center justify-center">
              <Users className="w-5 h-5 mr-2 text-brand-400" />
              Call Participants
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {participants.map((participant, index) => (
                <div
                  key={participant.id}
                  className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                    <span className="text-brand-400 font-medium text-sm">
                      {participant.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">
                      {participant.name} {participant.isLocal && '(You)'}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {participant.isLocal ? 'Local' : 'Remote'}
                    </div>
                  </div>
                  {participant.isLocal && (
                    <CheckCircle className="w-4 h-4 text-success-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4"
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 shadow-glow"
          >
            <Home className="w-5 h-5" />
            <span>Go Home</span>
          </button>

          <button
            onClick={() => navigate(`/lobby/${roomId}`, {
              state: {
                name: participants.find(p => p.isLocal)?.name || 'Guest',
                isCreator: creator,
                customMeetingName: meetingName
              }
            })}
            className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-all duration-200 hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Rejoin Meeting</span>
          </button>
        </motion.div>
      </div>
    </div>
  )
}


