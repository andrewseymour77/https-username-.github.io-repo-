import test from "node:test";
import assert from "node:assert/strict";

import {
  DIRECTIONS,
  advanceState,
  createInitialState,
  placeFood,
  setDirection,
} from "../src/gameLogic.js";

test("moves one cell in the current direction", () => {
  const state = createInitialState({ gridSize: 8, rng: () => 0 });
  const next = advanceState(state, () => 0);

  assert.deepEqual(next.snake[0], { x: state.snake[0].x + 1, y: state.snake[0].y });
  assert.equal(next.score, 0);
  assert.equal(next.gameOver, false);
});

test("prevents reversing direction directly", () => {
  const state = createInitialState({ gridSize: 8, rng: () => 0 });
  const next = setDirection(state, DIRECTIONS.LEFT);

  assert.equal(next.direction, DIRECTIONS.RIGHT);
});

test("grows and increments score after eating food", () => {
  const state = {
    gridSize: 8,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
    ],
    direction: DIRECTIONS.RIGHT,
    food: { x: 4, y: 3 },
    score: 0,
    gameOver: false,
    won: false,
    paused: false,
  };

  const next = advanceState(state, () => 0);

  assert.equal(next.snake.length, 4);
  assert.equal(next.score, 1);
  assert.deepEqual(next.snake[0], { x: 4, y: 3 });
});

test("ends game when colliding with wall", () => {
  const state = {
    gridSize: 5,
    snake: [
      { x: 4, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 1 },
    ],
    direction: DIRECTIONS.RIGHT,
    food: { x: 0, y: 0 },
    score: 0,
    gameOver: false,
    won: false,
    paused: false,
  };

  const next = advanceState(state, () => 0);
  assert.equal(next.gameOver, true);
});

test("ends game on self collision", () => {
  const state = {
    gridSize: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
    ],
    direction: DIRECTIONS.RIGHT,
    food: { x: 0, y: 0 },
    score: 0,
    gameOver: false,
    won: false,
    paused: false,
  };

  const next = advanceState(state, () => 0);
  assert.equal(next.gameOver, true);
});

test("food placement avoids snake cells", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  const food = placeFood(snake, 2, () => 0);

  assert.deepEqual(food, { x: 1, y: 1 });
});
