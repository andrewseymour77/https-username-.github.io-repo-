import {
  DIRECTIONS,
  advanceState,
  createInitialState,
  restartState,
  setDirection,
  togglePause,
} from "./gameLogic.js";

const GRID_SIZE = 20;
const TICK_MS = 140;
const CELL_SIZE = 20;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const directionButtons = Array.from(document.querySelectorAll("[data-dir]"));

canvas.width = GRID_SIZE * CELL_SIZE;
canvas.height = GRID_SIZE * CELL_SIZE;

let state = createInitialState({ gridSize: GRID_SIZE });

function statusText(nextState) {
  if (nextState.won) {
    return "You win. Press Restart to play again.";
  }

  if (nextState.gameOver) {
    return "Game over. Press Restart to play again.";
  }

  if (nextState.paused) {
    return "Paused.";
  }

  return "Use arrows or WASD to move.";
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#ececec";
  ctx.lineWidth = 1;

  for (let i = 0; i <= GRID_SIZE; i += 1) {
    const p = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p);
    ctx.stroke();
  }
}

function drawSnake(snake) {
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? "#23663a" : "#2f8f50";
    ctx.fillRect(
      segment.x * CELL_SIZE + 1,
      segment.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
    );
  });
}

function drawFood(food) {
  if (!food) {
    return;
  }

  ctx.fillStyle = "#c63b3b";
  ctx.fillRect(
    food.x * CELL_SIZE + 2,
    food.y * CELL_SIZE + 2,
    CELL_SIZE - 4,
    CELL_SIZE - 4,
  );
}

function render() {
  drawBoard();
  drawSnake(state.snake);
  drawFood(state.food);
  scoreEl.textContent = String(state.score);
  statusEl.textContent = statusText(state);
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
}

function updateDirectionByName(name) {
  const direction = DIRECTIONS[name];
  if (!direction) {
    return;
  }
  state = setDirection(state, direction);
  render();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const directionByKey = {
    arrowup: "UP",
    w: "UP",
    arrowdown: "DOWN",
    s: "DOWN",
    arrowleft: "LEFT",
    a: "LEFT",
    arrowright: "RIGHT",
    d: "RIGHT",
  };

  const dirName = directionByKey[key];
  if (dirName) {
    event.preventDefault();
    updateDirectionByName(dirName);
    return;
  }

  if (key === " ") {
    event.preventDefault();
    state = togglePause(state);
    render();
    return;
  }

  if (key === "r") {
    state = restartState(state);
    render();
  }
});

pauseBtn.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartBtn.addEventListener("click", () => {
  state = restartState(state);
  render();
});

directionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateDirectionByName(button.dataset.dir);
  });
});

setInterval(() => {
  state = advanceState(state);
  render();
}, TICK_MS);

render();
