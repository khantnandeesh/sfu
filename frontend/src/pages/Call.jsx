import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import * as mediasoupClient from 'mediasoup-client'

const SIGNAL_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001'
const socket = io(SIGNAL_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    withCredentials: true
})

export default function Call() {
    const { roomId } = useParams()
    const { state } = useLocation()
    const navigate = useNavigate()
    const name = state?.name || 'Guest'

    const [participants, setParticipants] = useState([])
    const [status, setStatus] = useState('init')
    const [micOn, setMicOn] = useState(true)
    const [camOn, setCamOn] = useState(true)
    const localStreamRef = useRef(null)

    // mediasoup state
    const deviceRef = useRef(null)
    const sendTransportRef = useRef(null)
    const recvTransportRef = useRef(null)
    const producersRef = useRef({})
    const consumersRef = useRef({})
    const peersRef = useRef({})

    useEffect(() => {
        let active = true
            ; (async () => {
                try {
                    console.log('[ui] requesting user media')
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                    if (!active) return
                    localStreamRef.current = stream
                    console.log('[ui] got local stream', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })))
                    await joinRoom()
                } catch (e) {
                    console.error('[ui] getUserMedia error', e)
                }
            })()
        return () => {
            active = false
            try { socket.disconnect() } catch (_) { }
            localStreamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [])

    // basic socket connection logs
    useEffect(() => {
        function onConnect() { console.log('[socket] connected', socket.id); setStatus('socket-connected') }
        function onError(err) { console.error('[socket] error', err); setStatus('socket-error') }
        function onDisconnect() { console.warn('[socket] disconnected'); setStatus('socket-disconnected') }
        socket.on('connect', onConnect)
        socket.on('connect_error', onError)
        socket.on('error', onError)
        socket.on('disconnect', onDisconnect)
        return () => {
            socket.off('connect', onConnect)
            socket.off('connect_error', onError)
            socket.off('error', onError)
            socket.off('disconnect', onDisconnect)
        }
    }, [])

    async function joinRoom() {
        return new Promise((resolve) => {
            console.log('[sig] joinRoom ->', { roomId, name })
            socket.emit('joinRoom', { roomId, name }, async (res) => {
                console.log('[sig] joinRoom <-', res)
                if (res?.error) return resolve()
                const device = new mediasoupClient.Device()
                await device.load({ routerRtpCapabilities: res.rtpCapabilities })
                deviceRef.current = device

                await createSendTransport()
                await createRecvTransport()

                // produce local tracks
                const audioTrack = localStreamRef.current.getAudioTracks?.()[0]
                const videoTrack = localStreamRef.current.getVideoTracks?.()[0]
                if (audioTrack) await produceTrack(audioTrack, 'audio')
                if (videoTrack) await produceTrack(videoTrack, 'video')

                // existing peers list
                setParticipants(prev => {
                    const others = (res.peers || []).filter(p => p.id !== socket.id)
                    return [
                        { id: 'local', name, stream: localStreamRef.current, isSpeaking: false, cameraOn: true },
                        ...others.map(p => ({ id: p.id, name: p.name, stream: null, isSpeaking: false, cameraOn: true }))
                    ]
                })

                // immediately consume existing producers
                if (Array.isArray(res.producers)) {
                    for (const prod of res.producers) {
                        await consumePeerProducer(prod.producerId, prod.peerId)
                    }
                }
                setStatus('joined')
                resolve()
            })
        })
    }

    async function createSendTransport() {
        return new Promise((resolve) => {
            console.log('[sig] createWebRtcTransport(send) ->')
            socket.emit('createWebRtcTransport', { roomId, direction: 'send' }, async (params) => {
                console.log('[sig] createWebRtcTransport(send) <-', params)
                if (params?.error) return resolve()
                const transport = deviceRef.current.createSendTransport(params)
                sendTransportRef.current = transport
                transport.on('connect', ({ dtlsParameters }, cb) => {
                    console.log('[sig] connectTransport(send) ->')
                    socket.emit('connectTransport', { roomId, transportId: transport.id, dtlsParameters }, () => { console.log('[sig] connectTransport(send) <- ok'); cb() })
                })
                transport.on('produce', ({ kind, rtpParameters }, cb) => {
                    console.log('[sig] produce', kind, '->')
                    socket.emit('produce', { roomId, transportId: transport.id, kind, rtpParameters }, ({ id }) => { console.log('[sig] produce <-', id); cb({ id }) })
                })
                transport.on('connectionstatechange', (state) => {
                    console.log('[webrtc] send transport state', state)
                    if (state === 'failed' || state === 'closed') navigate('/ended')
                })
                resolve()
            })
        })
    }

    async function createRecvTransport() {
        return new Promise((resolve) => {
            console.log('[sig] createWebRtcTransport(recv) ->')
            socket.emit('createWebRtcTransport', { roomId, direction: 'recv' }, async (params) => {
                console.log('[sig] createWebRtcTransport(recv) <-', params)
                if (params?.error) return resolve()
                const transport = deviceRef.current.createRecvTransport(params)
                recvTransportRef.current = transport
                transport.on('connect', ({ dtlsParameters }, cb) => {
                    console.log('[sig] connectTransport(recv) ->')
                    socket.emit('connectTransport', { roomId, transportId: transport.id, dtlsParameters }, () => { console.log('[sig] connectTransport(recv) <- ok'); cb() })
                })
                transport.on('connectionstatechange', (state) => {
                    console.log('[webrtc] recv transport state', state)
                    if (state === 'failed' || state === 'closed') navigate('/ended')
                })
                resolve()
            })
        })
    }

    async function produceTrack(track, kind) {
        const transport = sendTransportRef.current
        console.log('[webrtc] produceTrack', kind)
        const producer = await transport.produce({ track })
        producersRef.current[producer.id] = producer
    }

    // consume new producers
    useEffect(() => {
        function onNewProducer({ producerId, peerId, kind }) {
            if (peerId === socket.id) return
            console.log('[sig] newProducer <-', { producerId, peerId, kind })
            consumePeerProducer(producerId, peerId)
        }
        socket.on('newProducer', onNewProducer)
        socket.on('peerJoined', ({ id, name }) => {
            setParticipants(prev => {
                if (prev.find(p => p.id === id)) return prev
                return [...prev, { id, name, stream: null, isSpeaking: false, cameraOn: true }]
            })
        })
        socket.on('peerLeft', ({ id }) => {
            setParticipants(prev => prev.filter(p => p.id !== id))
        })
        return () => {
            socket.off('newProducer', onNewProducer)
            socket.off('peerJoined')
            socket.off('peerLeft')
        }
    }, [])

    async function consumePeerProducer(producerId, peerId) {
        return new Promise((resolve) => {
            const rtpCapabilities = deviceRef.current.rtpCapabilities
            console.log('[sig] consume ->', { producerId, peerId })
            socket.emit('consume', { roomId, producerId, rtpCapabilities, transportId: recvTransportRef.current.id }, async (params) => {
                console.log('[sig] consume <-', params)
                if (params?.error) return resolve()
                const consumer = await recvTransportRef.current.consume(params)
                consumersRef.current[consumer.id] = consumer
                // merge track into existing stream for this peer
                setParticipants(prev => {
                    const next = [...prev]
                    const idx = next.findIndex(p => p.id === peerId)
                    if (idx === -1) return prev
                    const existing = next[idx]
                    const stream = existing.stream instanceof MediaStream ? existing.stream : new MediaStream()
                    // avoid duplicate same-kind tracks
                    stream.getTracks().filter(t => t.kind === consumer.track.kind).forEach(t => stream.removeTrack(t))
                    stream.addTrack(consumer.track)
                    next[idx] = { ...existing, stream }
                    return next
                })
                await socket.emit('resumeConsumer', { roomId, consumerId: consumer.id }, () => { })
                resolve()
            })
        })
    }

    const endCall = () => {
        navigate('/ended')
    }

    const gridCols = useMemo(() => {
        const n = Math.max(1, participants.length)
        if (n <= 1) return 'grid-cols-1'
        if (n <= 4) return 'grid-cols-2'
        if (n <= 9) return 'grid-cols-3'
        return 'grid-cols-4'
    }, [participants.length])

    const toggleMic = () => {
        const track = localStreamRef.current?.getAudioTracks?.()[0]
        if (!track) return
        track.enabled = !track.enabled
        setMicOn(track.enabled)
    }
    const toggleCam = () => {
        const track = localStreamRef.current?.getVideoTracks?.()[0]
        if (!track) return
        track.enabled = !track.enabled
        setCamOn(track.enabled)
    }

    return (
        <div className="min-h-screen flex flex-col">
            <div className="px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800">status: {status} | participants: {participants.length}</div>
            <div className={`grid ${gridCols} gap-3 p-4 flex-1`}>
                {participants.map(p => (
                    <div key={p.id} className={`relative rounded-lg overflow-hidden bg-neutral-900 aspect-video`}>
                        {p.stream && p.id === 'local' ? (
                            <video autoPlay muted playsInline ref={el => { if (el && p.stream) el.srcObject = p.stream }} className="w-full h-full object-cover" />
                        ) : p.stream ? (
                            <video autoPlay playsInline ref={el => { if (el && p.stream) el.srcObject = p.stream }} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full aspect-video flex items-center justify-center text-xl font-medium bg-neutral-800">{p.name?.[0]?.toUpperCase() || '?'}</div>
                        )}
                        <div className="absolute bottom-2 left-2 right-2 text-sm bg-black/40 px-2 py-1 rounded">{p.name}</div>
                    </div>
                ))}
            </div>
            <div className="sticky bottom-0 p-4 flex items-center justify-center gap-3">
                <button onClick={toggleMic} className={`px-4 py-2 rounded-md ${micOn ? 'bg-neutral-800' : 'bg-red-600'}`}>{micOn ? 'Mute' : 'Unmute'}</button>
                <button onClick={toggleCam} className={`px-4 py-2 rounded-md ${camOn ? 'bg-neutral-800' : 'bg-yellow-600'}`}>{camOn ? 'Stop Video' : 'Start Video'}</button>
                <button onClick={endCall} className="px-4 py-2 rounded-md bg-red-600">End</button>
            </div>
        </div>
    )
}


