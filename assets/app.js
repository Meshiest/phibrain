const socket = io();

const $ = document.querySelector.bind(document);
const timers = {};
const setup = {};


let clickTime = 0;


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
        socket.emit('flip', indexFromCell(target), !target.classList.contains('flipped'));
        // target.classList.toggle('flipped');
      }

    } else {
      // otherwise, swap if the two cells
      socket.emit('swap', indexFromCell(target), indexFromCell(focused));
      // swapPos(target, focused);
    }
  } else {

    // make this cell the focused cell
    target.classList.add('focused');
  }

  clickTime = now;
});

// check if a cell is set
function checkSet(e) {
  if(e.getAttribute('real') === e.getAttribute('pos') && !e.classList.contains('flipped')) {
    $('.progress').style.width = (
      document.querySelectorAll('.set').length / (setup.width*setup.height) * 100
    ) + '%';
    e.classList.add('set');
  } else {
    e.classList.remove('set');
  }
}

// get a position index from a cell position
function indexFromCell(e) {
  return posToIndex(parsePos(e.getAttribute('pos')));
}

// convert a cell into a state
function stateFromCell(e) {
  return [
    posToIndex(parsePos(a.getAttribute('real'))),
    posToIndex(parsePos(a.getAttribute('pos'))),
    e.classList.contains('flipped'),
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

// set the flip of a cell
function setFlip(e, flipped) {
  if(e.classList.contains('flipped') !== flipped)
    e.classList.toggle('flipped');
}

// swap coords of two cells
function swapPos(a, b) {
  const apos = parsePos(a.getAttribute('pos'));
  const bpos = parsePos(b.getAttribute('pos'));
  setPos(a, ...bpos);
  setPos(b, ...apos);
}

// find cell by real position
function findCell(x, y) {
  return $(`[real="${x},${y}"]`);
}

// update the position and flip of a cell
function setCellState(real, pos, flipped) {
  const e = findCell(...real);
  setPos(e, pos[0], pos[1]);
  setFlip(e, flipped);
}

// create a new cell
function createCell(realX, realY, x, y, flipped=false) {
  const exists = findCell(realX, realY);
  const e = exists || document.createElement('div');

  // if the cell doesn't exist, create a new one
  if (!exists) {
    e.className = 'cell';
    e.style.backgroundPosition = `${-realX*60}px ${-realY*60}px`;
    e.setAttribute('real', realX+','+realY);
    $('.grid').appendChild(e);
  }

  setPos(e, x, y);
  setFlip(e, flipped);
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
function gameSetup(width, height, flipped) {
  setup.width = width;
  setup.height = height;
  const cellStyle = $('#cellSetup');
  const sideA = 'https://w.wallhaven.cc/full/4o/wallhaven-4opovm.jpg';
  const sideB = 'https://w.wallhaven.cc/full/6q/wallhaven-6q2w8x.png';

  console.log(flipped);

  cellStyle.innerHTML = `
  .grid {
    grid-template-columns: repeat(${width}, 60px);
    grid-template-rows: repeat(${height}, 60px);
  }
  .cell {
    background-size: 1920px 1080px;
    background-image: url(${flipped ? sideA : sideB});
  }
  .cell.flipped {
    background-image: url(${flipped ? sideB : sideA});
  }
  `;
}

socket.on('setup', ({width, height, flipped}) => gameSetup(width, height, flipped));

// load state into the game from the setup
socket.on('state', state => {
  state.forEach(([real, flip], pos) => {
    createCell(...posFromIndex(real), ...posFromIndex(pos), flip);
  });
});

// update a cell
socket.on('change', (real, pos, flipped) => {
  setCellState(posFromIndex(real), posFromIndex(pos), flipped);
});