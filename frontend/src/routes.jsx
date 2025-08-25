import { createBrowserRouter } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Lobby from './pages/Lobby.jsx'
import Call from './pages/Call.jsx'
import Ended from './pages/Ended.jsx'

export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/lobby/:roomId', element: <Lobby /> },
  { path: '/call/:roomId', element: <Call /> },
  { path: '/ended', element: <Ended /> },
])


