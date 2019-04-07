const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const app = express();
const { redisSet, redisGet } = require('./utils/redis')

const PORT = process.env.PORT || 8999;

const server = app.listen(PORT, () => {
  console.log(`Server started on port ${PORT} :)`);
});

const io = require('socket.io').listen(server);

io.origins('*:*');

io.on('connection', (socket) => {
  socket.on('initReserve', async () => {
    const reservedBox = await getReservedBox();

    socket.emit('initReserve:receive', reservedBox);
  });

  socket.on('initSelected', async ({ userId }) => {
    const selectedBox = await getSelectedBox(userId);

    socket.emit('initSelected:receive', selectedBox);
  });

  socket.on('broadCastReserve', async ({ boxId, userId }) => {
    const reservedBox = await updateReservedBox({ boxId, userId }) || [];

    socket.broadcast.emit(`broadCastReserve:receive`, JSON.parse(reservedBox));
  });

  socket.on('updateSelected', async ({ boxId, userId }) => {
    const selectedBox = await updateSelectedBox({ boxId, userId }) || [];

    socket.emit('updateSelected:receive', JSON.parse(selectedBox));
  });

  socket.on('getRooms', async () => {
    const rooms = await getRooms();

    socket.emit('getRooms:receive', rooms);    
  });

  socket.on('createRoom', async ({ roomId }) => {
    const rooms = await createRoom(roomId);

    socket.broadcast.emit(`broadCastRooms:receive`, rooms);
  });
});

async function updateReservedBox({ boxId, userId }) {
  const result = await redisGet('next-web-socket:reservedBox');
  const reservedBox = JSON.parse(result) || {};

  if (reservedBox[userId]) {
    reservedBox[userId].push(boxId);
  } else {
    reservedBox[userId] = [boxId];
  }

  await redisSet('next-web-socket:reservedBox', JSON.stringify(reservedBox));

  return redisGet('next-web-socket:reservedBox');  
}

async function updateSelectedBox({ boxId, userId }) {
  const result = await redisGet(`next-web-socket:selectedBox:${userId}`);
  const selectedBox = JSON.parse(result) || [];

  selectedBox.push(boxId);

  await redisSet(`next-web-socket:selectedBox:${userId}`, JSON.stringify(selectedBox));

  return redisGet(`next-web-socket:selectedBox:${userId}`);  
}

async function getReservedBox() {
  const reservedBox = await redisGet('next-web-socket:reservedBox');

  return JSON.parse(reservedBox) || {};
}

async function getSelectedBox(userId) {
  const selectedBox = await redisGet(`next-web-socket:selectedBox:${userId}`);

  return JSON.parse(selectedBox) || [];
}

async function getRooms() {
  const rooms = await redisGet('next-web-socket:rooms');

  return JSON.parse(rooms) || [];
}

async function createRoom(roomId) {
  let rooms = await getRooms();

  rooms = _.uniq([...rooms, roomId])

  await redisSet(`next-web-socket:rooms`, JSON.stringify(rooms));

  const updatedRooms = await getRooms();

  return updatedRooms;
}