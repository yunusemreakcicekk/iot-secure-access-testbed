const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// Always load .env from the backend directory, regardless of where node is launched
dotenv.config({ path: path.join(__dirname, '.env') });

const StateService = require('./services/state.service');
const SerialService = require('./services/serial.service');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // allow all for dev
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// --- REST API Endpoints ---

// Get current system state
app.get('/api/status', (req, res) => {
    res.json(StateService.getState());
});

// Get recent logs
app.get('/api/logs', (req, res) => {
    res.json(StateService.getLogs());
});

// Manual trigger for testing (simulates serial line)
app.post('/api/test-event', (req, res) => {
    const { line } = req.body;
    if (line) {
        SerialService.testEvent(line);
        res.json({ success: true, message: `Dispatched test event: ${line}` });
    } else {
        res.status(400).json({ success: false, message: "Missing serial line in request body." });
    }
});

// Force system reset
app.post('/api/reset', (req, res) => {
    StateService.reset();
    res.json({ success: true, message: "System reset complete." });
});

// Send direct command to hardware
app.post('/api/send-command', (req, res) => {
    const { command } = req.body;
    if (command) {
        const normalizedCommand = String(command).trim();
        const isPinUpdate = /^(?:PIN|SET_PIN)=([0-9]{3}|[0-9]{9})$/i.test(normalizedCommand);
        if (isPinUpdate && StateService.getState().mode === 'SECURE') {
            StateService.addLog('Remote PIN update rejected: secure mode is active', 'WARNING', 'SERIAL_SERVICE');
            return res.status(403).json({ success: false, message: "Remote PIN updates are disabled in secure mode" });
        }

        const success = SerialService.sendCommand(normalizedCommand);
        res.json({ success, message: success ? `Command sent: ${normalizedCommand}` : "Hardware not connected" });
    } else {
        res.status(400).json({ success: false, message: "Missing command in request body." });
    }
});

// --- Socket.IO Real-time Updates ---

io.on('connection', (socket) => {
    console.log(`Frontend client connected: ${socket.id}`);
    
    // Send initial state on connection
    socket.emit('system_state', StateService.getState());
    socket.emit('logs_history', StateService.getLogs());

    socket.on('disconnect', () => {
        console.log(`Frontend client disconnected: ${socket.id}`);
    });
});

// Broadcast state updates and new logs to all connected clients
StateService.onUpdate((state, newLog) => {
    io.emit('system_state', state);
    if (newLog) {
        io.emit('new_log', newLog);
    }
});

// --- Start Services ---

server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`GUARD_PROTOCOL BACKEND RUNNING ON PORT ${PORT}`);
    console.log(`=========================================`);
    
    // Initialize serial communication
    SerialService.start();
});
