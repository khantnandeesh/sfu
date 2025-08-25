import { Link } from 'react-router-dom'

export default function Ended() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-semibold">Call ended</h2>
        <Link to="/" className="px-4 py-2 bg-brand-600 rounded-md inline-block">Go Home</Link>
      </div>
    </div>
  )
}


