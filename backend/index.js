require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { socketCorsOptions } = require('./utils/corsConfig');
const { initAuctionSockets } = require('./socket/auctionSocketHandler');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: socketCorsOptions
});
app.set('io', io);

app.use(cors({
    origin: socketCorsOptions.origin,
    credentials: true
}));
app.use(express.json());

// Initialize Socket.IO Handlers & Event Subscriptions
initAuctionSockets(io);

// 🌟 जादू यहाँ है: कल मुझसे यह पहली लाइन (auth) छूट गई थी! 🌟
app.use('/api/auth', require('./routes/auth')); 
app.use('/api/teams', require('./routes/team'));
app.use('/api/players', require('./routes/player'));
app.use('/api/auction', require('./routes/auction'));
app.use('/api/tournament', require('./routes/tournament'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/plans', require('./routes/plan'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cricket_auction')
    .then(() => console.log('Database Connection Successful! (गोडाउन से जुड़ गए)'))
    .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
