const express = require('express');

const app = express();
const http = require('http').createServer(app);
const path = require('path');
const io = require('socket.io')(http);
const _ = require('lodash');

const WIDTH = 32;
const HEIGHT = 18;

const gameState = _
  .chain(WIDTH * HEIGHT)
  .range()
  .shuffle()
  .map(i => [i, Math.random() < .5])
  .value();

let userCount = 0;
let flipCount = 0;

io.on('connection', socket => {
  const id = _.uniqueId('user');
  const ratio = flipCount / userCount;
  const shouldFlip = userCount > 0 && ratio === 0.5 || Math.random() < 0.5;
  if (shouldFlip)
    flipCount++;
  userCount++;
  console.log('new user', id, shouldFlip);

  socket.emit('setup', {width: WIDTH, height: HEIGHT, flipped: shouldFlip});
  socket.emit('state', gameState);

  // check if a position is in range
  const inRange = p => _.inRange(p % WIDTH, 0, WIDTH) && _.inRange(Math.floor(p / WIDTH), 0, HEIGHT);

  // set flipped state of a cell
  socket.on('flip', (pos, flipped) => {
    if (typeof pos === 'number' && !inRange(pos))
      return;

    console.log('flip', pos % WIDTH, ~~(pos / WIDTH), flipped)

    gameState[pos][1] = !!flipped;

    io.emit('change', gameState[pos][0], pos, gameState[pos][1]);
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
  });

  socket.on('disconnect', () => {
    userCount --;
    if(shouldFlip)
      flipCount --;
    console.log('dropped user', id);
  });
});

app.use('/', express.static('assets'))
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'assets/index.html'));
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
