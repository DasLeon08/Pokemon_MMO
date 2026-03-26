const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      players: {}
    };
    socket.join(roomId);
    socket.roomId = roomId;

    // Initialize new player
    rooms[roomId].players[socket.id] = {
      x: 100,
      y: 100,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      id: socket.id,
      level: 1,
      exp: 0
    };

    socket.emit('roomCreated', roomId);
    socket.emit('currentPlayers', rooms[roomId].players);
  });

  socket.on('joinRoom', (roomId) => {
    roomId = roomId.toUpperCase();
    if (rooms[roomId]) {
      socket.join(roomId);
      socket.roomId = roomId;

      // Initialize new player
      rooms[roomId].players[socket.id] = {
        x: Math.floor(Math.random() * 500) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        id: socket.id,
        level: 1,
        exp: 0
      };

      socket.emit('roomJoined', roomId);
      // Send all current players to the new player
      socket.emit('currentPlayers', rooms[roomId].players);
      // Tell all other players in the room about the new player
      socket.to(roomId).emit('newPlayer', rooms[roomId].players[socket.id]);
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  // Listen for player movement
  socket.on('playerMovement', (movementData) => {
    if (socket.roomId && rooms[socket.roomId] && rooms[socket.roomId].players[socket.id]) {
      rooms[socket.roomId].players[socket.id].x = movementData.x;
      rooms[socket.roomId].players[socket.id].y = movementData.y;
      // Broadcast new position to everyone else in the room
      socket.to(socket.roomId).emit('playerMoved', rooms[socket.roomId].players[socket.id]);
    }
  });

  // Leveling up / EXP gain
  socket.on('gainExp', () => {
    if (socket.roomId && rooms[socket.roomId] && rooms[socket.roomId].players[socket.id]) {
      const p = rooms[socket.roomId].players[socket.id];
      p.exp += Math.floor(Math.random() * 20) + 10; // Gain 10-30 EXP

      const expNeeded = p.level * 100;
      if (p.exp >= expNeeded) {
        p.level += 1;
        p.exp = p.exp - expNeeded; // carry over
        console.log(`Player ${socket.id} leveled up to ${p.level}!`);
      }

      // Send update back to all players in the room
      io.in(socket.roomId).emit('playerStatsUpdate', {
        id: socket.id,
        level: p.level,
        exp: p.exp
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    if (socket.roomId && rooms[socket.roomId]) {
      delete rooms[socket.roomId].players[socket.id];
      socket.to(socket.roomId).emit('playerDisconnected', socket.id);

      // Clean up empty rooms
      if (Object.keys(rooms[socket.roomId].players).length === 0) {
        delete rooms[socket.roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
