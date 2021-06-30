const express = require('express');

const app = express();
const http = require('http').createServer(app);
const path = require('path');
const io = require('socket.io')(http);
const _ = require('lodash');

const SIDES = [
  '/puzzles/rainbow.png',
];
const PIECE_SIZE = 60;
const [WIDTH, HEIGHT] = [1920/PIECE_SIZE, 1080/PIECE_SIZE];

const NUM_SIDES = SIDES.length;
const RANDOMIZE_SIDES = false;

const gameState = _
  .chain(WIDTH * HEIGHT)
  .range()
  .shuffle()
  .map(i => [i, RANDOMIZE_SIDES ? _.random(NUM_SIDES - 1) : 0])
  .value();

let userCount = 0;
let moves = 0;
const focused = {};

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
    size: PIECE_SIZE,
    sides: SIDES,
    side: _.random(NUM_SIDES - 1),
  });
  socket.emit('state', gameState);
  for (const key in focused) {
    if (focused[key])
      socket.emit('focus', key, focused[key]);
  }
  socket.broadcast.emit('join', id);

  // check if a position is in range
  const inRange = p => _.inRange(p % WIDTH, 0, WIDTH) && _.inRange(Math.floor(p / WIDTH), 0, HEIGHT);

  socket.on('focus', cell => {
    // cell must be null or a string
    if (cell !== null && typeof cell !== 'string') return;
    // if cell is a string, it must match this regex
    if (typeof cell === 'string' && !cell.match(/\d+,\d+/)) return;
    socket.broadcast.emit('focus', id, cell);
    focused[id] = cell;
  });

  socket.on('chat', msg => {
    msg = msg.toString().trim();
    if (msg.length === 0 || msg.length > 100)
      return;
    console.log(`<${id}> ${msg}`);
    io.emit('chat', id, msg);
  });

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
    socket.broadcast.emit('drop', id);
    focused[id] = null;
    userCount --;
    emitInfo();
    console.log('dropped user', id);
  });
});

app.use('/', express.static('assets'))
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'assets/index.html'));
});

http.listen(process.env.PORT ?? 7700, function(){
  console.log('listening on *:7700');
});
