const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Initialize new player
  players[socket.id] = {
    x: Math.floor(Math.random() * 500) + 50,
    y: Math.floor(Math.random() * 500) + 50,
    color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'), // Random color for "pokemon"
    id: socket.id
  };

  // Send all current players to the new player
  socket.emit('currentPlayers', players);

  // Tell all other players about the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Listen for player movement
  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      // Broadcast new position to everyone else
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
