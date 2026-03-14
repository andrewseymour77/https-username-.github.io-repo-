export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

function pointsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function movePoint(point, direction) {
  return { x: point.x + direction.x, y: point.y + direction.y };
}

function isOutOfBounds(point, gridSize) {
  return (
    point.x < 0 ||
    point.y < 0 ||
    point.x >= gridSize ||
    point.y >= gridSize
  );
}

function isOppositeDirection(currentDirection, nextDirection) {
  return (
    currentDirection.x + nextDirection.x === 0 &&
    currentDirection.y + nextDirection.y === 0
  );
}

export function placeFood(snake, gridSize, rng = Math.random) {
  const occupied = new Set(snake.map(pointKey));
  const freeCells = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const point = { x, y };
      if (!occupied.has(pointKey(point))) {
        freeCells.push(point);
      }
    }
  }

  if (freeCells.length === 0) {
    return null;
  }

  const index = Math.floor(rng() * freeCells.length);
  return freeCells[index];
}

export function createInitialState({ gridSize = 20, rng = Math.random } = {}) {
  const center = Math.floor(gridSize / 2);
  const snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];

  return {
    gridSize,
    snake,
    direction: DIRECTIONS.RIGHT,
    food: placeFood(snake, gridSize, rng),
    score: 0,
    gameOver: false,
    won: false,
    paused: false,
  };
}

export function setDirection(state, nextDirection) {
  if (!nextDirection || state.gameOver) {
    return state;
  }

  if (
    state.snake.length > 1 &&
    isOppositeDirection(state.direction, nextDirection)
  ) {
    return state;
  }

  return {
    ...state,
    direction: nextDirection,
  };
}

export function togglePause(state) {
  if (state.gameOver) {
    return state;
  }

  return {
    ...state,
    paused: !state.paused,
  };
}

export function restartState(state, rng = Math.random) {
  return createInitialState({ gridSize: state.gridSize, rng });
}

export function advanceState(state, rng = Math.random) {
  if (state.gameOver || state.paused) {
    return state;
  }

  const nextHead = movePoint(state.snake[0], state.direction);

  if (isOutOfBounds(nextHead, state.gridSize)) {
    return {
      ...state,
      gameOver: true,
    };
  }

  const isGrowing = state.food !== null && pointsEqual(nextHead, state.food);
  const bodyToCheck = isGrowing ? state.snake : state.snake.slice(0, -1);
  const hitsBody = bodyToCheck.some((segment) => pointsEqual(segment, nextHead));

  if (hitsBody) {
    return {
      ...state,
      gameOver: true,
    };
  }

  if (isGrowing) {
    const snake = [nextHead, ...state.snake];
    const food = placeFood(snake, state.gridSize, rng);
    const won = food === null;

    return {
      ...state,
      snake,
      food,
      score: state.score + 1,
      gameOver: won,
      won,
    };
  }

  return {
    ...state,
    snake: [nextHead, ...state.snake.slice(0, -1)],
  };
}
