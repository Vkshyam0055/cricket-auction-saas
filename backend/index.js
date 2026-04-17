require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const http = require('http');
const { Server } = require('socket.io');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Unauthorized'));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.organizerId = decoded.id;
        next();
    } catch (error) {
        next(new Error('Unauthorized'));
    }
});

io.on('connection', (socket) => {
    const room = `organizer:${socket.organizerId}`;
    socket.join(room);
    console.log(`⚡ organizer ${socket.organizerId} connected to live socket`);

    socket.on('newLiveBid', (data) => {
        io.to(room).emit('updateAudienceScreen', data); 
    });

    socket.on('disconnect', () => {
        console.log(`❌ organizer ${socket.organizerId} disconnected from live socket`);
    });
});

// 🌟 जादू यहाँ है: कल मुझसे यह पहली लाइन (auth) छूट गई थी! 🌟
app.use('/api/auth', require('./routes/auth')); 
app.use('/api/teams', require('./routes/team'));
app.use('/api/players', require('./routes/player'));
app.use('/api/tournament', require('./routes/tournament'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/plans', require('./routes/plan'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cricket_auction')
    .then(() => console.log('Database Connection Successful! (गोडाउन से जुड़ गए)'))
    .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));