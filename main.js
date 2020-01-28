const express = require('express');

const app = express();
const http = require('http').createServer(app);
const path = require('path');
const io = require('socket.io')(http);
const _ = require('lodash');

const WIDTH = 32;
const HEIGHT = 18;

// this set is made up of multiple photos that complement useless space
const SIDES = [
  'https://w.wallhaven.cc/full/dg/wallhaven-dgw5mo.png',
  'https://w.wallhaven.cc/full/qd/wallhaven-qdgr95.jpg',
  'https://w.wallhaven.cc/full/47/wallhaven-476z1v.jpg',
  'https://w.wallhaven.cc/full/ne/wallhaven-ne829w.jpg',
  'https://w.wallhaven.cc/full/0p/wallhaven-0py6ep.jpg',
  'https://w.wallhaven.cc/full/4y/wallhaven-4ymgyk.jpg',
  'https://w.wallhaven.cc/full/0j/wallhaven-0j8q7w.png',
];

// older puzzles, worse quality images
const SIDES_old_1 = [
  'https://w.wallhaven.cc/full/4x/wallhaven-4xll3v.jpg',
  'https://w.wallhaven.cc/full/4y/wallhaven-4yj6vl.jpg',
  'https://w.wallhaven.cc/full/4o/wallhaven-4opovm.jpg',
  'https://w.wallhaven.cc/full/6q/wallhaven-6q2w8x.png',
  'https://w.wallhaven.cc/full/4y/wallhaven-4yj2lx.jpg',
  'https://w.wallhaven.cc/full/43/wallhaven-435oz3.jpg',
];

const NUM_SIDES = SIDES.length;

const gameState = _
  .chain(WIDTH * HEIGHT)
  .range()
  .shuffle()
  .map(i => [i, _.random(NUM_SIDES - 1)])
  .value();

let userCount = 0;
let moves = 0;

function emitInfo() {
  io.emit('info', {
    helpers: userCount,
    moves,
  });
}

io.on('connection', socket => {
  const id = _.uniqueId('user');
  userCount++;
  emitInfo();
  console.log('new user', id);

  socket.emit('setup', {
    width: WIDTH,
    height: HEIGHT,
    sides: SIDES,
    side: _.random(NUM_SIDES - 1),
  });
  socket.emit('state', gameState);

  // check if a position is in range
  const inRange = p => _.inRange(p % WIDTH, 0, WIDTH) && _.inRange(Math.floor(p / WIDTH), 0, HEIGHT);

  // set flipped state of a cell
  socket.on('flip', (pos, side) => {
    if (typeof pos !== 'number' || !inRange(pos))
      return;

    side = Math.floor(side);

    if (typeof side !== 'number' || !_.inRange(side, 0, NUM_SIDES))
      return;

    console.log('flip', pos % WIDTH, ~~(pos / WIDTH), side);

    gameState[pos][1] = side;

    io.emit('change', gameState[pos][0], pos, gameState[pos][1]);
    moves++;
    emitInfo();
  });

  // swap positions of two cells
  socket.on('swap', (a, b) => {
    if (typeof a !== 'number' || typeof b !== 'number')
      return;

    const temp = gameState[a];
    gameState[a] = gameState[b];
    gameState[b] = temp;

    console.log('swap', a % WIDTH, ~~(a / WIDTH), b % WIDTH, ~~(b / WIDTH));

    io.emit('change', gameState[a][0], a, gameState[a][1]);
    io.emit('change', gameState[b][0], b, gameState[b][1]);
    moves++;
    emitInfo();
  });

  socket.on('disconnect', () => {
    userCount --;
    emitInfo();
    console.log('dropped user', id);
  });
});

app.use('/', express.static('assets'))
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'assets/index.html'));
});

http.listen(7777, function(){
  console.log('listening on *:7777');
});
