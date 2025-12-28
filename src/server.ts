import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { createServer } from 'http';
import app from './app';
import { initializeSocket, handleConnection } from './libs/websocket/socket.handler';
import { authenticateSocket } from './libs/websocket/socket.middleware';
import { ExtendedSocket } from './libs/websocket/socket.types';

// MongoDB connection with better error handling
const mongoUrl = process.env.MONGO_URL;
if (!mongoUrl) {
    console.error("ERROR: MONGO_URL environment variable is not set!");
    process.exit(1);
}

mongoose.connect(mongoUrl, {
    // Production-ready connection options
    retryWrites: true,
    w: 'majority',
})
    .then((data) => {
        console.log("MongoDB connection succeed");
        const PORT = Number(process.env.PORT) || 3003;

        // Create HTTP server
        const httpServer = createServer(app);

        // Initialize Socket.io
        const io = initializeSocket(httpServer);

        // Socket.io authentication middleware
        io.use(authenticateSocket);

        // Handle socket connections
        io.on("connection", (socket) => {
            handleConnection(socket as ExtendedSocket);
        });

        // Start server
        // Bind to 0.0.0.0 for Render.com (allows external connections)
        httpServer.listen(PORT, '0.0.0.0', function () {
            console.info(`The server is running successfully on port: ${PORT}`);
            console.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.info(`API available on http://0.0.0.0:${PORT}`);
            console.info(`WebSocket available on ws://0.0.0.0:${PORT} \n`);
        });
    })
    .catch((err) => {
        console.error("ERROR on connection MongoDB:", err);
        process.exit(1);
    });
