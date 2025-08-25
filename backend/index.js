// SFU server with Express, Socket.IO, and mediasoup
// Runs on port 3001

require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mediasoup = require("mediasoup");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Mediasoup server state
let worker;
const rooms = new Map();

async function createWorker() {
  worker = await mediasoup.createWorker({
    rtcMinPort: Number(process.env.RTC_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.RTC_MAX_PORT) || 49999,
    logLevel: process.env.MEDIASOUP_LOG_LEVEL || "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"]
  });
  worker.on("died", () => {
    // In production, you may want to restart the worker process
    console.error("mediasoup Worker died, exiting...");
    process.exit(1);
  });
  return worker;
}

function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  const room = {
    id: roomId,
    router: null,
    peers: new Map() // socketId -> peer
  };
  rooms.set(roomId, room);
  return room;
}

async function createRouter() {
  const mediaCodecs = [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2
    },
    // Add H264 for Safari/iOS compatibility
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
        "x-google-start-bitrate": 1000
      }
    },
    // Keep VP8 for Chrome/Firefox
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: { "x-google-start-bitrate": 1000 }
    }
  ];
  const r = await worker.createRouter({ mediaCodecs });
  return r;
}

function getPeer(room, socketId) {
  if (!room.peers.has(socketId)) {
    room.peers.set(socketId, {
      id: socketId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      dataProducers: new Map(),
      dataConsumers: new Map(),
      name: null
    });
  }
  return room.peers.get(socketId);
}

io.on("connection", (socket) => {
  console.log(
    "[socket] connected:",
    socket.id,
    "from",
    socket.handshake.headers.origin
  );
  let currentRoomId = null;

  socket.on("createRoom", async (callback) => {
    try {
      const roomId = uuidv4();
      const room = getOrCreateRoom(roomId);
      if (!worker) await createWorker();
      if (!room.router) room.router = await createRouter();
      callback({ roomId });
    } catch (err) {
      console.error("createRoom error", err);
      callback({ error: "Failed to create room" });
    }
  });

  socket.on("joinRoom", async ({ roomId, name }, callback) => {
    try {
      if (!worker) await createWorker();
      const room = getOrCreateRoom(roomId);
      if (!room.router) room.router = await createRouter();

      currentRoomId = roomId;
      socket.join(roomId);
      const peer = getPeer(room, socket.id);
      peer.name = name || "Guest";

      const rtpCapabilities = room.router.rtpCapabilities;

      // collect existing producers so the new peer can consume immediately
      const existingProducers = [];
      for (const [peerId, existingPeer] of room.peers.entries()) {
        if (peerId === socket.id) continue;
        for (const [producerId, producer] of existingPeer.producers.entries()) {
          existingProducers.push({
            producerId,
            peerId: existingPeer.id,
            kind: producer.kind
          });
        }
      }

      socket.to(roomId).emit("peerJoined", { id: socket.id, name: peer.name });
      callback({
        rtpCapabilities,
        peers: Array.from(room.peers.values()).map((p) => ({
          id: p.id,
          name: p.name
        })),
        producers: existingProducers
      });
    } catch (err) {
      console.error("joinRoom error", err);
      callback({ error: "Failed to join room" });
    }
  });

  socket.on(
    "createWebRtcTransport",
    async ({ roomId, direction }, callback) => {
      try {
        const room = rooms.get(roomId);
        if (!room) return callback({ error: "room not found" });
        const peer = getPeer(room, socket.id);

        const { transport, params } = await createWebRtcTransport(room.router);
        peer.transports.set(transport.id, transport);

        transport.on("dtlsstatechange", (dtlsState) => {
          if (dtlsState === "closed") {
            transport.close();
            peer.transports.delete(transport.id);
          }
        });

        transport.on("close", () => {
          peer.transports.delete(transport.id);
        });

        callback(params);
      } catch (err) {
        console.error("createWebRtcTransport error", err);
        callback({ error: "Failed to create transport" });
      }
    }
  );

  socket.on(
    "connectTransport",
    async ({ roomId, transportId, dtlsParameters }, callback) => {
      try {
        const room = rooms.get(roomId);
        if (!room) return callback({ error: "room not found" });
        const peer = getPeer(room, socket.id);
        const transport = peer.transports.get(transportId);
        await transport.connect({ dtlsParameters });
        callback({ connected: true });
      } catch (err) {
        console.error("connectTransport error", err);
        callback({ error: "Failed to connect transport" });
      }
    }
  );

  socket.on(
    "produce",
    async ({ roomId, transportId, kind, rtpParameters }, callback) => {
      try {
        const room = rooms.get(roomId);
        if (!room) return callback({ error: "room not found" });
        const peer = getPeer(room, socket.id);
        const transport = peer.transports.get(transportId);
        const producer = await transport.produce({ kind, rtpParameters });
        peer.producers.set(producer.id, producer);

        // Inform others of new producer
        socket.to(roomId).emit("newProducer", {
          producerId: producer.id,
          peerId: socket.id,
          kind
        });

        producer.on("transportclose", () => {
          peer.producers.delete(producer.id);
        });

        callback({ id: producer.id });
      } catch (err) {
        console.error("produce error", err);
        callback({ error: "Failed to produce" });
      }
    }
  );

  socket.on(
    "consume",
    async ({ roomId, producerId, rtpCapabilities, transportId }, callback) => {
      try {
        const room = rooms.get(roomId);
        if (!room) return callback({ error: "room not found" });
        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ error: "cannot consume" });
        }
        const peer = getPeer(room, socket.id);
        const transport = peer.transports.get(transportId);
        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true
        });
        peer.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => {
          peer.consumers.delete(consumer.id);
        });

        const params = {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused
        };
        callback(params);
      } catch (err) {
        console.error("consume error", err);
        callback({ error: "Failed to consume" });
      }
    }
  );

  socket.on("resumeConsumer", async ({ roomId, consumerId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) return callback({ error: "room not found" });
      const peer = getPeer(room, socket.id);
      const consumer = peer.consumers.get(consumerId);
      await consumer.resume();
      callback({ resumed: true });
    } catch (err) {
      console.error("resumeConsumer error", err);
      callback({ error: "Failed to resume consumer" });
    }
  });

  socket.on("getRouterRtpCapabilities", ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ error: "room not found" });
    callback({ rtpCapabilities: room.router.rtpCapabilities });
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", socket.id, reason);
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const peer = room.peers.get(socket.id);
    if (peer) {
      for (const transport of peer.transports.values()) transport.close();
      room.peers.delete(socket.id);
    }
    socket.to(currentRoomId).emit("peerLeft", { id: socket.id });
    if (room.peers.size === 0) {
      // Optional: close router when empty to free resources
      try {
        room.router && room.router.close();
      } catch (_) {}
      rooms.delete(currentRoomId);
    }
  });
});

async function createWebRtcTransport(router) {
  const { listenIps, initialAvailableOutgoingBitrate, maxIncomingBitrate } =
    getWebRtcTransportOptions();
  const transport = await router.createWebRtcTransport({
    listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate
  });
  if (maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(maxIncomingBitrate);
    } catch (_) {}
  }
  const params = {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters
  };
  return { transport, params };
}

function getWebRtcTransportOptions() {
  const listenIp = process.env.LISTEN_IP || "0.0.0.0";
  const announcedIp = process.env.ANNOUNCED_IP || undefined; // set for public IP if behind NAT
  return {
    listenIps: [{ ip: listenIp, announcedIp }],
    initialAvailableOutgoingBitrate: 1000000,
    maxIncomingBitrate: 1500000
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

httpServer.listen(PORT, () => {
  console.log(`SFU server listening on http://localhost:${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("UnhandledRejection", err);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
