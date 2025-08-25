import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Signal, Maximize2,
    Minimize2, Copy, Monitor, MonitorOff, X, Check, Settings
} from 'lucide-react';
import DraggableVideoGrid from '../components/DraggableVideoGrid';

const SIGNAL_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

const socket = io(SIGNAL_URL, {
    autoConnect: false,
    transports: ['websocket'],
});

export default function Call() {
    const { roomId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const name = state?.name || 'Guest';
    const isCreator = state?.isCreator || false;
    const customMeetingName = state?.customMeetingName || '';

    const [participants, setParticipants] = useState([]);
    const [status, setStatus] = useState('initializing');
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [copied, setCopied] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showMeetingNameEdit, setShowMeetingNameEdit] = useState(false);
    const [editingMeetingName, setEditingMeetingName] = useState(customMeetingName);
    const [meetingName, setMeetingName] = useState(customMeetingName || `Call with ${roomId}`);
    const [showControls, setShowControls] = useState(true);
    const [isAdmin, setIsAdmin] = useState(isCreator);
    const [waitingUsers, setWaitingUsers] = useState([]);
    const [showWaitingUsers, setShowWaitingUsers] = useState(false);

    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const deviceRef = useRef(null);
    const sendTransportRef = useRef(null);
    const recvTransportRef = useRef(null);
    const producersRef = useRef({ audio: null, video: null });
    const consumersRef = useRef({});
    const controlsTimeoutRef = useRef(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (status === 'joined') {
            const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
            return () => clearInterval(timer);
        }
    }, [status]);

    // Auto-hide controls after 2 seconds
    useEffect(() => {
        if (status === 'joined') {
            const timer = setTimeout(() => {
                setShowControls(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const handleMouseMove = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 2000);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 2000);
    }, []);

    useEffect(() => {
        console.log('[Call] Initializing...')
        socket.connect();

        const initialize = async () => {
            try {
                console.log('[Call] Getting user media...')
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                localStreamRef.current = stream;
                console.log('[Call] User media obtained:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })))

                // Get initial track states
                const audioTrack = stream.getAudioTracks()[0];
                const videoTrack = stream.getVideoTracks()[0];
                const initialMicOn = audioTrack ? audioTrack.enabled : true;
                const initialCamOn = videoTrack ? videoTrack.enabled : true;

                setMicOn(initialMicOn);
                setCamOn(initialCamOn);
                // Don't set participants here - let the backend handle it when joining

                // Wait for socket to be connected before joining room
                if (socket.connected) {
                    console.log('[Call] Socket already connected, joining room...')
                    await joinRoom();
                } else {
                    console.log('[Call] Waiting for socket connection...')
                    socket.once('connect', async () => {
                        console.log('[Call] Socket connected, joining room...')
                        await joinRoom();
                    });
                }
            } catch (e) {
                console.error('[Call] getUserMedia error:', e);
                setStatus('permission-denied');
            }
        };

        initialize();

        return () => {
            console.log('[Call] Cleaning up...')
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();
            socket.disconnect();

            // Cleanup controls timeout
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const onConnect = () => {
            console.log('[socket] Connected with ID:', socket.id)
            setStatus('connected')
        };

        const onDisconnect = () => {
            console.log('[socket] Disconnected')
            setStatus('disconnected')
        };

        const onPeerJoined = ({ id, name, micOn, cameraOn, isAdmin }) => {
            console.log('[socket] Peer joined:', { id, name, micOn, cameraOn, isAdmin })
            setParticipants(prev => {
                // Check if this participant is already in the list
                const existingIndex = prev.findIndex(p => p.id === id);
                if (existingIndex !== -1) {
                    // Update existing participant
                    const updated = [...prev];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        name,
                        micOn: micOn !== undefined ? micOn : updated[existingIndex].micOn,
                        cameraOn: cameraOn !== undefined ? cameraOn : updated[existingIndex].cameraOn,
                        isAdmin: isAdmin !== undefined ? isAdmin : updated[existingIndex].isAdmin
                    };
                    return updated;
                } else {
                    // Add new participant
                    return [...prev, {
                        id,
                        name,
                        stream: new MediaStream(),
                        isSpeaking: false,
                        cameraOn: cameraOn !== undefined ? cameraOn : true,
                        micOn: micOn !== undefined ? micOn : true,
                        isAdmin: isAdmin || false
                    }];
                }
            });
        };

        const onPeerLeft = ({ id }) => {
            console.log('[socket] Peer left:', { id })
            setParticipants(prev => prev.filter(p => p.id !== id));
        };

        const onNewProducer = ({ producerId, peerId }) => {
            console.log('[socket] New producer:', { producerId, peerId })
            consumePeerProducer(producerId, peerId)
        };

        const onPeerMicUpdate = ({ peerId, micOn }) => {
            console.log('[socket] Peer mic update:', { peerId, micOn })
            setParticipants(prev => prev.map(p =>
                p.id === peerId ? { ...p, micOn } : p
            ));
        };

        const onPeerCameraUpdate = ({ peerId, cameraOn }) => {
            console.log('[socket] Peer camera update:', { peerId, cameraOn })
            setParticipants(prev => prev.map(p =>
                p.id === peerId ? { ...p, cameraOn } : p
            ));
        };

        const onUpdateMicStatus = ({ peerId, micOn }) => {
            console.log('[socket] Mic status update:', { peerId, micOn })
            setParticipants(prev => prev.map(p =>
                p.id === peerId ? { ...p, micOn } : p
            ));
        };

        const onUpdateCameraStatus = ({ peerId, cameraOn }) => {
            console.log('[socket] Camera status update:', { peerId, cameraOn })
            setParticipants(prev => prev.map(p =>
                p.id === peerId ? { ...p, cameraOn } : p
            ));
        };

        const onUserWaiting = ({ id, name }) => {
            console.log('[socket] User waiting:', { id, name })
            setWaitingUsers(prev => {
                // Check if user is already in waiting list
                if (prev.some(u => u.id === id)) {
                    console.log('[socket] User already in waiting list:', id);
                    return prev;
                }
                console.log('[socket] Adding user to waiting list:', id);
                return [...prev, { id, name }];
            });
            setShowWaitingUsers(true);
        };

        const onUserApproved = ({ roomId }) => {
            console.log('[socket] User approved, rejoining room...', roomId)
            console.log('[socket] Current socket ID:', socket.id)
            setStatus('initializing');
            setWaitingUsers([]);
            joinRoom();
        };

        const onUserRejected = ({ roomId }) => {
            console.log('[socket] User rejected')
            navigate('/ended', {
                state: {
                    message: 'You were rejected from the meeting by the admin.',
                    roomId
                }
            });
        };

        const onUserKicked = ({ roomId }) => {
            console.log('[socket] User kicked')
            navigate('/ended', {
                state: {
                    message: 'You were removed from the meeting by the admin.',
                    roomId
                }
            });
        };

        const onTestResponse = (data) => {
            console.log('[socket] Test response received:', data);
        };

        const onPong = (data) => {
            console.log('[socket] Pong received:', data);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('peerJoined', onPeerJoined);
        socket.on('peerLeft', onPeerLeft);
        socket.on('newProducer', onNewProducer);
        socket.on('peerMicUpdate', onPeerMicUpdate);
        socket.on('peerCameraUpdate', onPeerCameraUpdate);
        socket.on('updateMicStatus', onUpdateMicStatus);
        socket.on('updateCameraStatus', onUpdateCameraStatus);
        socket.on('userWaiting', onUserWaiting);
        socket.on('userApproved', onUserApproved);
        socket.on('userRejected', onUserRejected);
        socket.on('userKicked', onUserKicked);
        socket.on('testResponse', onTestResponse);
        socket.on('pong', onPong);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('peerJoined', onPeerJoined);
            socket.off('peerLeft', onPeerLeft);
            socket.off('newProducer', onNewProducer);
            socket.off('peerMicUpdate', onPeerMicUpdate);
            socket.off('peerCameraUpdate', onPeerCameraUpdate);
            socket.off('updateMicStatus', onUpdateMicStatus);
            socket.off('updateCameraStatus', onUpdateCameraStatus);
            socket.off('userWaiting', onUserWaiting);
            socket.off('userApproved', onUserApproved);
            socket.off('userRejected', onUserRejected);
            socket.off('userKicked', onUserKicked);
            socket.off('testResponse', onTestResponse);
            socket.off('pong', onPong);
        };
    }, []);

    // Debug: Monitor participants changes
    useEffect(() => {
        console.log('[Call] Participants changed:', participants.length, 'participants:', participants.map(p => ({ id: p.id, name: p.name, isAdmin: p.isAdmin })));
    }, [participants]);

    async function joinRoom() {
        return new Promise((resolve) => {
            console.log('[sig] joinRoom ->', { roomId, name, isCreator })
            socket.emit('joinRoom', { roomId, name, isCreator }, async (res) => {
                console.log('[sig] joinRoom <-', res)
                console.log('[sig] joinRoom response status:', res?.status)
                if (res?.error) return resolve()

                // Handle waiting status
                if (res?.status === 'waiting') {
                    setStatus('waiting');
                    return resolve();
                }

                try {
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

                    // Set participants list from backend response
                    const allPeers = res.peers || [];
                    console.log('[room] All peers from backend:', allPeers)

                    // Remove duplicates by ID
                    const uniquePeers = allPeers.filter((peer, index, self) =>
                        index === self.findIndex(p => p.id === peer.id)
                    );

                    const participantsList = uniquePeers.map(p => {
                        if (p.id === socket.id) {
                            // This is the local participant
                            return {
                                id: p.id,
                                name: p.name,
                                stream: localStreamRef.current,
                                isSpeaking: false,
                                cameraOn: p.cameraOn !== undefined ? p.cameraOn : camOn,
                                micOn: p.micOn !== undefined ? p.micOn : micOn,
                                isAdmin: p.isAdmin || isAdmin
                            };
                        } else {
                            // This is a remote participant
                            return {
                                id: p.id,
                                name: p.name,
                                stream: null,
                                isSpeaking: false,
                                cameraOn: p.cameraOn !== undefined ? p.cameraOn : true,
                                micOn: p.micOn !== undefined ? p.micOn : true,
                                isAdmin: p.isAdmin || false
                            };
                        }
                    });

                    console.log('[room] Final participants list:', participantsList)
                    setParticipants(participantsList)

                    // Debug: Log the current participants state
                    console.log('[room] Setting participants:', participantsList.length, 'participants')

                    // immediately consume existing producers
                    if (Array.isArray(res.producers)) {
                        for (const prod of res.producers) {
                            await consumePeerProducer(prod.producerId, prod.peerId)
                        }
                    }
                    setStatus('joined')
                    resolve()
                } catch (error) {
                    console.error('Failed to join room:', error)
                    resolve()
                }
            })
        })
    }

    async function createSendTransport() {
        return new Promise((resolve) => {
            console.log('[sig] createWebRtcTransport(send) ->')
            socket.emit('createWebRtcTransport', { roomId, direction: 'send' }, async (params) => {
                console.log('[sig] createWebRtcTransport(send) <-', params)
                if (params?.error) return resolve()

                try {
                    const transport = deviceRef.current.createSendTransport(params)
                    sendTransportRef.current = transport

                    transport.on('connect', ({ dtlsParameters }, cb) => {
                        console.log('[sig] connectTransport(send) ->')
                        socket.emit('connectTransport', { roomId, transportId: transport.id, dtlsParameters }, () => {
                            console.log('[sig] connectTransport(send) <- ok')
                            cb()
                        })
                    })

                    transport.on('produce', ({ kind, rtpParameters }, cb) => {
                        console.log('[sig] produce', kind, '->')
                        socket.emit('produce', { roomId, transportId: transport.id, kind, rtpParameters }, ({ id }) => {
                            console.log('[sig] produce <-', id)
                            cb({ id })
                        })
                    })

                    transport.on('connectionstatechange', (state) => {
                        console.log('[webrtc] send transport state', state)
                        if (state === 'failed' || state === 'closed') navigate('/ended')
                    })
                    resolve()
                } catch (error) {
                    console.error('Failed to create send transport:', error)
                    resolve()
                }
            })
        })
    }

    async function createRecvTransport() {
        return new Promise((resolve) => {
            console.log('[sig] createWebRtcTransport(recv) ->')
            socket.emit('createWebRtcTransport', { roomId, direction: 'recv' }, async (params) => {
                console.log('[sig] createWebRtcTransport(recv) <-', params)
                if (params?.error) return resolve()

                try {
                    const transport = deviceRef.current.createRecvTransport(params)
                    recvTransportRef.current = transport

                    transport.on('connect', ({ dtlsParameters }, cb) => {
                        console.log('[sig] connectTransport(recv) ->')
                        socket.emit('connectTransport', { roomId, transportId: transport.id, dtlsParameters }, () => {
                            console.log('[sig] connectTransport(recv) <- ok')
                            cb()
                        })
                    })

                    transport.on('connectionstatechange', (state) => {
                        console.log('[webrtc] recv transport state', state)
                        if (state === 'failed' || state === 'closed') navigate('/ended')
                    })
                    resolve()
                } catch (error) {
                    console.error('Failed to create recv transport:', error)
                    resolve()
                }
            })
        })
    }

    async function produceTrack(track, kind) {
        try {
            const transport = sendTransportRef.current
            if (!transport) return

            console.log('[webrtc] produceTrack', kind)
            const producer = await transport.produce({ track })
            producersRef.current[kind] = producer
            console.log('[webrtc] track produced:', kind, producer.id)
        } catch (error) {
            console.error('Failed to produce track:', error)
        }
    }

    async function consumePeerProducer(producerId, peerId) {
        return new Promise((resolve) => {
            try {
                if (!deviceRef.current || !recvTransportRef.current) {
                    console.warn('Device or recv transport not ready')
                    return resolve()
                }

                const rtpCapabilities = deviceRef.current.rtpCapabilities
                console.log('[sig] consume ->', { producerId, peerId })

                socket.emit('consume', { roomId, producerId, rtpCapabilities, transportId: recvTransportRef.current.id }, async (params) => {
                    console.log('[sig] consume <-', params)
                    if (params?.error) return resolve()

                    try {
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
                        console.log('[webrtc] consumer resumed:', consumer.id)
                        resolve()
                    } catch (error) {
                        console.error('Failed to consume track:', error)
                        resolve()
                    }
                })
            } catch (error) {
                console.error('Failed to consume peer producer:', error)
                resolve()
            }
        })
    }

    const toggleMic = useCallback(() => {
        const track = localStreamRef.current?.getAudioTracks()?.[0];
        if (track) {
            track.enabled = !track.enabled;
            setMicOn(track.enabled);
            setParticipants(prev => prev.map(p => p.id === socket.id ? { ...p, micOn: track.enabled } : p));

            // Emit mic status to other participants with local participant ID
            socket.emit('updateMicStatus', { roomId, peerId: socket.id, micOn: track.enabled });
        }
    }, [roomId]);

    const toggleCam = useCallback(() => {
        const track = localStreamRef.current?.getVideoTracks()?.[0];
        if (track) {
            track.enabled = !track.enabled;
            setCamOn(track.enabled);
            setParticipants(prev => prev.map(p => p.id === socket.id ? { ...p, cameraOn: track.enabled } : p));

            // Emit camera status to other participants with local participant ID
            socket.emit('updateCameraStatus', { roomId, peerId: socket.id, cameraOn: track.enabled });
        }
    }, [roomId]);

    const toggleScreenShare = useCallback(async () => {
        const videoProducer = producersRef.current.video;
        if (!videoProducer) return;
        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];
                await videoProducer.replaceTrack({ track: screenTrack });
                const oldTrack = localStreamRef.current.getVideoTracks()[0];
                localStreamRef.current.removeTrack(oldTrack); oldTrack.stop();
                localStreamRef.current.addTrack(screenTrack);
                setIsScreenSharing(true);
                screenTrack.onended = () => toggleScreenShare();
            } catch (error) { console.error('Screen sharing failed:', error); }
        } else {
            try {
                const newCamStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newCamTrack = newCamStream.getVideoTracks()[0];
                await videoProducer.replaceTrack({ track: newCamTrack });
                const oldTrack = localStreamRef.current.getVideoTracks()[0];
                localStreamRef.current.removeTrack(oldTrack); oldTrack.stop();
                localStreamRef.current.addTrack(newCamTrack);
                setIsScreenSharing(false);
            } catch (error) { console.error('Failed to switch back to camera:', error); }
        }
    }, [isScreenSharing]);

    const formatDuration = useCallback((seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const endCall = useCallback(() => {
        const callEndTime = Date.now();
        const totalCallDuration = Math.floor((callEndTime - startCallTime.current) / 1000);

        const callDetails = {
            meetingName: meetingName,
            roomId: roomId,
            startTime: startCallTime.current,
            endTime: callEndTime,
            totalDuration: totalCallDuration,
            formattedDuration: formatDuration(totalCallDuration),
            participants: participants.map(p => ({
                name: p.name,
                id: p.id,
                isLocal: p.id === 'local'
            })),
            totalParticipants: participants.length,
            creator: isCreator
        };

        navigate('/ended', { state: callDetails });
    }, [navigate, meetingName, roomId, participants, isCreator, formatDuration]);

    const copyInviteLink = useCallback(async () => {
        const inviteLink = `${window.location.origin}/lobby/${roomId}`;
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy invite link:', err);
        }
    }, [roomId]);

    const toggleParticipantsPanel = useCallback(() => setShowParticipants(prev => !prev), []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    const saveMeetingName = useCallback(async () => {
        if (editingMeetingName.trim() && editingMeetingName !== meetingName) {
            setMeetingName(editingMeetingName.trim());
            // Here you could also save to backend if needed
        }
        setShowMeetingNameEdit(false);
    }, [editingMeetingName, meetingName]);

    const cancelMeetingNameEdit = useCallback(() => {
        setEditingMeetingName(meetingName);
        setShowMeetingNameEdit(false);
    }, [meetingName]);

    const approveUser = useCallback((userId) => {
        console.log('[frontend] Approving user:', userId);
        console.log('[frontend] Socket connected:', socket.connected);
        console.log('[frontend] Socket ID:', socket.id);
        console.log('[frontend] Room ID:', roomId);
        // Test socket connection first
        socket.emit('ping', { message: 'Testing backend connection' });
        socket.emit('testEvent', { message: 'Testing socket connection' });

        // Add a small delay to ensure the test event is processed
        setTimeout(() => {
            socket.emit('approveUser', { roomId, userId }, (response) => {
                console.log('[frontend] approveUser emit response:', response);
            });
        }, 100);
        setWaitingUsers(prev => {
            const newWaitingUsers = prev.filter(u => u.id !== userId);
            if (newWaitingUsers.length === 0) {
                setShowWaitingUsers(false);
            }
            return newWaitingUsers;
        });
    }, [roomId]);

    const rejectUser = useCallback((userId) => {
        console.log('[frontend] Rejecting user:', userId);
        socket.emit('rejectUser', { roomId, userId });
        setWaitingUsers(prev => {
            const newWaitingUsers = prev.filter(u => u.id !== userId);
            if (newWaitingUsers.length === 0) {
                setShowWaitingUsers(false);
            }
            return newWaitingUsers;
        });
    }, [roomId]);

    const kickUser = useCallback((userId) => {
        socket.emit('kickUser', { roomId, userId });
    }, [roomId]);

    const startCallTime = useRef(Date.now());

    // Show waiting screen if user is waiting for admin approval
    if (status === 'waiting') {
        return (
            <div className="h-screen flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 overflow-hidden">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-6">
                        <div className="w-20 h-20 mx-auto rounded-full bg-brand-500/20 flex items-center justify-center border-2 border-brand-500/30">
                            <Phone className="w-10 h-10 text-brand-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">Waiting for Approval</h1>
                            <p className="text-neutral-400">The meeting admin will review your request to join.</p>
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                            <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="h-screen flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* Responsive Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: showControls ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="h-16 px-2 sm:px-4 bg-white/5 backdrop-blur-md border-b border-white/10 flex items-center justify-between fixed top-0 left-0 right-0 z-50"
            >
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-3 h-3 sm:w-5 sm:h-5 text-brand-500" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                            {showMeetingNameEdit ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={editingMeetingName}
                                        onChange={(e) => setEditingMeetingName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveMeetingName()}
                                        className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm font-semibold focus:outline-none focus:border-brand-500 min-w-0"
                                        autoFocus
                                    />
                                    <button
                                        onClick={saveMeetingName}
                                        className="p-1 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded transition-all duration-200"
                                    >
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={cancelMeetingNameEdit}
                                        className="p-1 bg-white/10 hover:bg-white/20 text-neutral-300 rounded transition-all duration-200"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <h1
                                    className="text-sm sm:text-lg font-semibold text-white truncate cursor-pointer hover:text-brand-400 transition-colors duration-200"
                                    onClick={() => isCreator && setShowMeetingNameEdit(true)}
                                    title={isCreator ? "Click to edit meeting name" : ""}
                                >
                                    {meetingName}
                                </h1>
                            )}
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
                            <span className={`flex items-center space-x-1 ${status === 'joined' ? 'text-success-500' : status === 'initializing' ? 'text-warning-500' : 'text-neutral-400'}`}>
                                {status === 'joined' ? (
                                    <Signal className="w-4 h-4" />
                                ) : status === 'initializing' ? (
                                    <div className="w-4 h-4 rounded-full bg-warning-500 animate-pulse" />
                                ) : (
                                    <div className="w-4 h-4 rounded-full bg-neutral-500" />
                                )}
                                <span className="capitalize hidden sm:inline">{status.replace('-', ' ')}</span>
                            </span>
                            <span className="text-neutral-400 hidden sm:inline">•</span>
                            <span className="text-neutral-400 flex items-center space-x-1">
                                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{participants.length}</span>
                            </span>
                            {status === 'joined' && (
                                <>
                                    <span className="text-neutral-400 hidden sm:inline">•</span>
                                    <span className="text-neutral-400 text-xs">{formatDuration(callDuration)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-2">
                    {/* Admin waiting users indicator */}
                    {isAdmin && waitingUsers.length > 0 && (
                        <button
                            onClick={() => setShowWaitingUsers(true)}
                            className="p-1.5 sm:p-2 rounded-lg bg-warning-500/20 text-warning-400 border border-warning-500/30 transition-all duration-200 relative"
                        >
                            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-warning-500 text-white text-xs rounded-full flex items-center justify-center">
                                {waitingUsers.length}
                            </span>
                        </button>
                    )}
                    <button
                        onClick={toggleFullscreen}
                        className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-all duration-200"
                    >
                        {isFullscreen ? <Minimize2 className="w-3 h-3 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                    </button>
                    <button
                        onClick={toggleParticipantsPanel}
                        className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 ${showParticipants
                            ? 'bg-brand-500/20 text-brand-400'
                            : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white'
                            }`}
                    >
                        <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <button className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-all duration-200">
                        <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                </div>
            </motion.div>

            {/* Main Content Area with padding for fixed bars */}
            <div className="flex-1 pt-16 pb-20 flex overflow-hidden">
                {/* Video Grid */}
                <div className="flex-1 overflow-hidden">
                    <DraggableVideoGrid
                        participants={participants}
                        isMobile={isMobile}
                        localStream={localStreamRef.current}
                    />
                </div>

                {/* Participants Sidebar - Responsive */}
                <AnimatePresence>
                    {showParticipants && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ ease: 'easeInOut', duration: 0.3 }}
                            className="w-80 bg-white/5 backdrop-blur-md border-l border-white/10 p-4 overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Participants</h3>
                                <button
                                    onClick={toggleParticipantsPanel}
                                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all duration-200"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                {participants.map((participant) => (
                                    <div key={participant.id} className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                                            <span className="text-brand-400 font-medium text-sm">
                                                {participant.name?.[0]?.toUpperCase() || '?'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-medium truncate flex items-center space-x-2">
                                                <span>{participant.name}</span>
                                                {participant.stream === localStreamRef.current && <span className="text-brand-400 text-xs">(You)</span>}
                                                {participant.isAdmin && <span className="text-warning-400 text-xs">(Admin)</span>}
                                            </div>
                                            <div className="flex items-center space-x-2 text-xs text-neutral-400">
                                                <span className={`flex items-center space-x-1 ${participant.micOn ? 'text-success-400' : 'text-error-400'}`}>
                                                    {participant.micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                                                    {participant.micOn ? 'Unmuted' : 'Muted'}
                                                </span>
                                                <span className={`flex items-center space-x-1 ${participant.cameraOn ? 'text-success-400' : 'text-error-400'}`}>
                                                    {participant.cameraOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                                                    {participant.cameraOn ? 'Video On' : 'Video Off'}
                                                </span>
                                            </div>
                                        </div>
                                        {isAdmin && participant.stream !== localStreamRef.current && !participant.isAdmin && (
                                            <button
                                                onClick={() => kickUser(participant.id)}
                                                className="p-1.5 rounded-lg bg-error-500/20 hover:bg-error-500/30 text-error-400 transition-all duration-200"
                                                title="Remove from meeting"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Waiting Users Modal */}
            <AnimatePresence>
                {showWaitingUsers && isAdmin && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowWaitingUsers(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-neutral-900 border border-white/10 rounded-lg p-6 w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Waiting Users</h3>
                                <button
                                    onClick={() => setShowWaitingUsers(false)}
                                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all duration-200"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                {waitingUsers.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                                                <span className="text-brand-400 font-medium text-sm">
                                                    {user.name?.[0]?.toUpperCase() || '?'}
                                                </span>
                                            </div>
                                            <span className="text-white font-medium">{user.name}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => {
                                                    console.log('[frontend] Approve button clicked for user:', user.id, user.name);
                                                    approveUser(user.id);
                                                }}
                                                className="px-3 py-1 bg-success-500/20 hover:bg-success-500/30 text-success-400 rounded transition-all duration-200 text-sm"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => {
                                                    console.log('[frontend] Reject button clicked for user:', user.id, user.name);
                                                    rejectUser(user.id);
                                                }}
                                                className="px-3 py-1 bg-error-500/20 hover:bg-error-500/30 text-error-400 rounded transition-all duration-200 text-sm"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Responsive Controls */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: showControls ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="h-20 px-2 sm:px-4 bg-white/5 backdrop-blur-md border-t border-white/10 flex items-center justify-between fixed bottom-0 left-0 right-0 z-50"
            >
                {/* Left side - Invite link */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <button
                        onClick={copyInviteLink}
                        className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white rounded-lg transition-all duration-200 text-xs sm:text-sm"
                    >
                        {copied ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
                        <span className="hidden sm:inline">COPY INVITE LINK</span>
                        <span className="sm:hidden">COPY</span>
                    </button>
                </div>

                {/* Center - Main controls */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleMic}
                        className={`p-2 sm:p-3 rounded-full font-medium transition-all duration-200 ${micOn
                            ? 'bg-white/10 hover:bg-white/20 text-white shadow-soft'
                            : 'bg-error-500/20 hover:bg-error-500/30 text-error-400 border border-error-500/30'
                            }`}
                    >
                        {micOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleCam}
                        className={`p-2 sm:p-3 rounded-full font-medium transition-all duration-200 ${camOn
                            ? 'bg-white/10 hover:bg-white/20 text-white shadow-soft'
                            : 'bg-error-500/20 hover:bg-error-500/30 text-error-400 border border-error-500/30'
                            }`}
                    >
                        {camOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleScreenShare}
                        className={`p-2 sm:p-3 rounded-full font-medium transition-all duration-200 ${isScreenSharing
                            ? 'bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 border border-brand-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-white shadow-soft'
                            }`}
                    >
                        {isScreenSharing ? <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={endCall}
                        className="p-2 sm:p-3 rounded-full bg-error-500 hover:bg-error-600 text-white font-medium shadow-soft transition-all duration-200"
                    >
                        <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.button>
                </div>

                {/* Right side - Leave button */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <button
                        onClick={endCall}
                        className="px-3 sm:px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all duration-200 border border-white/20 text-sm"
                    >
                        Leave
                    </button>
                </div>
            </motion.div>
        </div>
    );
}