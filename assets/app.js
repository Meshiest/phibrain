const socket = io();

const $ = document.querySelector.bind(document);
const timers = {};
const setup = {};

const clickSound = new Audio('snap.mp3');
clickSound.volume = 0.2;

// play a click sound
function playClickSound() {
  if (!setup.done)
    return;

  // allows the sound to be played quickly in succession
  clickSound.currentTime = 0;
  clickSound.play();
}

document.addEventListener('keyup', e => {
  let focused = $('.cell.focused');

  switch(e.code) {
  // show complete pieces
  case 'Tab':
    e.preventDefault();
    document.body.classList.remove('complete');
    break;
  }
});

document.addEventListener('keydown', e => {
  let focused = $('.cell.focused');

  if (focused) {
    checkSet(focused);
    if (focused.classList.contains('set')) {
      focused.classList.remove('focused');
      focused = null;
    }
  }

  const findCellInDirection = offset => {
    // find next cell to swap
    let pos = posFromCell(focused);
    let next;

    // loop until we find a non-set cell
    do {
      pos = translate(pos, offset);
      next = findCell(...pos);
    } while(next && next.classList.contains('set'));

    return next;
  };

  // helper function for wasd moving cells
  const moveCell = offset => {
    if (!focused)
      return;

    const target = findCellInDirection(offset);
    // swap the cells
    socket.emit('swap', indexFromCell(focused), indexFromCell(target));
  };

  const moveFocus = offset => {
    e.preventDefault();
    if (!focused)
      return;

    const next = findCellInDirection(offset);
    focused.classList.remove('focused');
    next.classList.add('focused');
  };

  switch(e.code) {
  case 'Space':
    e.preventDefault();
    $('.grid').setAttribute('side',
      (Number($('.grid').getAttribute('side')) + (e.shiftKey ? setup.sides - 1 : 1)) % setup.sides,
    );
    $('#side').innerText = (Number($('.grid').getAttribute('side')) + 1) + '/' + setup.sides;
    break;

  // show complete pieces
  case 'Tab':
    e.preventDefault();
    document.body.classList.add('complete');
    break;

  // un focus selected piece
  case 'Escape':
  case 'KeyX':
    if (!focused)
      return;
    focused.classList.remove('focused');
    break;

  case 'KeyE':
    e.preventDefault();
    // remove focus from the currently focused cell
    if (focused)
      focused.classList.remove('focused');

    // find the first not set cell
    const unset = $('.cell:not(.set)');
    if (unset)
      unset.classList.add('focused');
    break;

  case 'KeyF':
    if (!focused)
      return;
    socket.emit('flip', indexFromCell(focused),
      (Number(focused.getAttribute('side')) + (e.shiftKey ? setup.sides - 1 : 1)) % setup.sides
    );
    break;

  // moving cell
  case 'KeyW':
    moveCell([0, -1]);
    break;
  case 'KeyS':
    moveCell([0, 1]);
    break;
  case 'KeyA':
    moveCell([-1, 0]);
    break;
  case 'KeyD':
    moveCell([1, 0]);
    break;

  // moving cursor
  case 'ArrowUp':
    moveFocus([0, -1]);
    break;
  case 'ArrowDown':
    moveFocus([0, 1]);
    break;
  case 'ArrowLeft':
    moveFocus([-1, 0]);
    break;
  case 'ArrowRight':
    moveFocus([1, 0]);
    break;

  }
  // flip puzzle
});

let clickTime = 0;

// translate
function translate(pos, offset) {
  return [
    (pos[0] + offset[0] + setup.width) % setup.width,
    (pos[1] + offset[1] + setup.height) % setup.height,
  ];
}

// handle clicking on cells and toggling things
document.addEventListener('click', e => {
  const focused = $('.cell.focused');
  const target = e.target;
  const now = Date.now()

  // ignore non-cell clicks
  if (!target.classList.contains('cell'))
    return;

  checkSet(target);

  // flash green when correct cell is clicked
  if (target.classList.contains('set')) {
    clearTimeout(timers[target.getAttribute('pos')]);

    target.style.border = '2px solid #0f0';
    timers[target.getAttribute('pos')] = setTimeout(() => {
      target.style.border = 'none';
    }, 500);
    return;
  }

  // if there's a focused cell
  if (focused) {
    focused.classList.remove('focused');

    // and it's the same as the one that's clicked
    if (target === focused) {
      target.classList.remove('focused');

      // flip if you're double clicking
      if (now - clickTime < 500) {
        socket.emit('flip', indexFromCell(target), (Number(target.getAttribute('side')) + 1) % setup.sides);
      }

    } else {
      // otherwise, swap if the two cells
      socket.emit('swap', indexFromCell(target), indexFromCell(focused));
    }
  } else {

    // make this cell the focused cell
    target.classList.add('focused');
  }

  clickTime = now;
});

// check if a cell is set
function checkSet(e) {
  if (e.getAttribute('real') === e.getAttribute('pos') && Number(e.getAttribute('side')) === 0) {
    if (!e.classList.contains('set'))
      playClickSound();
    e.classList.add('set');

    const numDone = document.querySelectorAll('.set').length;
    const numPieces = setup.width*setup.height;

    $('.progress').style.width = (
      numDone / numPieces * 100
    ) + '%';

    progressInfo.innerText = `${numDone}/${numPieces}`;
  } else {
    e.classList.remove('set');
  }
}

// get position from cell
function posFromCell(e) {
  return parsePos(e.getAttribute('pos'));
}

// get a position index from a cell position
function indexFromCell(e) {
  return posToIndex(posFromCell(e));
}

// convert a cell into a state
function stateFromCell(e) {
  return [
    posToIndex(parsePos(a.getAttribute('real'))),
    posToIndex(parsePos(a.getAttribute('pos'))),
    Number(e.getAttribute('side')),
  ];
}

// split a comma split position into an array of numbers
function parsePos(pos) {
  return pos.split(',').map(Number);
}

// set coords of a cell
function setPos(e, x, y) {
  e.style.gridColumnStart = x + 1;
  e.style.gridRowStart = y + 1;
  e.setAttribute('pos', x+','+y);

  // update set status
  checkSet(e);
}

// set the side of a cell
function setSide(e, side) {
  e.setAttribute('side', side);
}

// find cell by position
function findCell(x, y) {
  return $(`[pos="${x},${y}"]`);
}

// find cell by real position
function findRealCell(x, y) {
  return $(`[real="${x},${y}"]`);
}

// update the position and side of a cell
function setCellState(real, pos, side) {
  const e = findRealCell(...real);
  setPos(e, pos[0], pos[1]);
  setSide(e, side);
}

// create a new cell
function createCell(realX, realY, x, y, side=0) {
  const exists = findRealCell(realX, realY);
  const e = exists || document.createElement('div');

  // if the cell doesn't exist, create a new one
  if (!exists) {
    e.className = 'cell';
    e.style.backgroundPosition = `${-realX*60}px ${-realY*60}px`;
    e.setAttribute('real', realX+','+realY);
    e.onclick="";
    $('.grid').appendChild(e);
  }

  setPos(e, x, y);
  setSide(e, side);
}

// convert an index into a position
function posFromIndex(i) {
  return [i % setup.width, Math.floor(i / setup.width)];
}

// convert a position to an index
function posToIndex(pos) {
  return pos[0] + pos[1] * setup.width;
}

// set game size settings
function gameSetup(width, height, sides, side) {
  setup.width = width;
  setup.height = height;
  const numSides = sides.length;
  setup.sides = numSides;

  const cellStyle = $('#cellSetup');

  $('.grid').setAttribute('side', side);
  $('#side').innerText = (side+1) + '/' + numSides;

  const cellSize = 60;
  const previewScale = 8;

  cellStyle.innerHTML = `
  .grid {
    width: ${cellSize * width}px;
    height: ${cellSize * height}px;
    grid-template-columns: repeat(${width}, ${cellSize}px);
    grid-template-rows: repeat(${height}, ${cellSize}px);
  }
  .preview {
    width: ${previewScale * width}px;
    height: ${previewScale * height}px;
    background-size: ${previewScale * width}px ${previewScale * height}px;
  }
  .cell {
    background-size: ${cellSize * width}px ${cellSize * height}px;
  }
  .complete .cell {
    background-image: none !important;
    background-color: red;
  }
  .complete .cell.set {
    background-color: #4f4;
  }

  ${Array.from({length: numSides}).map((_, i) => `
    .grid[side="${i}"] + .info .preview {
      background-image: url(${sides[i]});
    }
    ` +
    Array.from({length: numSides}).map((_, j) => `
    .grid[side="${i}"] .cell[side="${j}"] {
      background-image: url(${sides[(i + j) % numSides]});
    }
  `).join('\n')).join('\n')}
  `;
}

socket.on('setup', ({width, height, sides, side}) => gameSetup(width, height, sides, side));
socket.on('info', info => {
  $('#helpers').innerText = info.helpers;
});

// load state into the game from the setup
socket.on('state', state => {
  setup.done = false;
  state.forEach(([real, side], pos) => {
    createCell(...posFromIndex(real), ...posFromIndex(pos), side);
  });
  setup.done = true;
});

// update a cell
socket.on('change', (real, pos, side) => {
  setCellState(posFromIndex(real), posFromIndex(pos), side);
});