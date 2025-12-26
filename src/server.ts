import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { createServer } from 'http';
import app from './app';
import { initializeSocket, handleConnection } from './libs/websocket/socket.handler';
import { authenticateSocket } from './libs/websocket/socket.middleware';
import { ExtendedSocket } from './libs/websocket/socket.types';

mongoose.connect(process.env.MONGO_URL as string, {})
    .then((data) => {
        console.log("MongoDB connection succeed");
        const PORT = process.env.PORT ?? 3003;

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
        httpServer.listen(PORT, function () {
            console.info(`The server is running successfully on port: ${PORT}`);
            console.info(`API available on http://localhost:${PORT}`);
            console.info(`WebSocket available on ws://localhost:${PORT} \n`);
        });
    })
    .catch((err) => console.log("ERROR on connection MongoDB", err));
