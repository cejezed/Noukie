import { useEffect, useRef, useState } from 'react';
import { GameChildProps } from './MiniGameShell';

interface Position {
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SNAKE: Position[] = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const GAME_SPEED = 150; // milliseconds

export function Snake({ onScoreChange, onGameOver, isActive }: GameChildProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Position>(INITIAL_DIRECTION);
  const [nextDirection, setNextDirection] = useState<Position>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);

  // Generate random food position
  const generateFood = (currentSnake: Position[]): Position => {
    while (true) {
      const newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };

      // Check if food is not on snake
      const onSnake = currentSnake.some(
        segment => segment.x === newFood.x && segment.y === newFood.y
      );

      if (!onSnake) {
        return newFood;
      }
    }
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isActive || gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          if (direction.y === 0) setNextDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
          if (direction.y === 0) setNextDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
          if (direction.x === 0) setNextDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
          if (direction.x === 0) setNextDirection({ x: 1, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, isActive, gameOver]);

  // Game loop
  useEffect(() => {
    if (!isActive || gameOver) return;

    const gameLoop = setInterval(() => {
      setDirection(nextDirection);

      setSnake(prevSnake => {
        const head = prevSnake[0];
        const newHead = {
          x: head.x + nextDirection.x,
          y: head.y + nextDirection.y,
        };

        // Check collision with walls
        if (
          newHead.x < 0 ||
          newHead.x >= GRID_SIZE ||
          newHead.y < 0 ||
          newHead.y >= GRID_SIZE
        ) {
          setGameOver(true);
          onGameOver();
          return prevSnake;
        }

        // Check collision with self
        const hitSelf = prevSnake.some(
          segment => segment.x === newHead.x && segment.y === newHead.y
        );

        if (hitSelf) {
          setGameOver(true);
          onGameOver();
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Check if food is eaten
        if (newHead.x === food.x && newHead.y === food.y) {
          const newScore = score + 10;
          setScore(newScore);
          onScoreChange(newScore);
          setFood(generateFood(newSnake));
          // Don't remove tail (snake grows)
        } else {
          // Remove tail (snake moves)
          newSnake.pop();
        }

        return newSnake;
      });
    }, GAME_SPEED);

    return () => clearInterval(gameLoop);
  }, [isActive, gameOver, nextDirection, food, score]);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#e0e7ff';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw snake
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#16a34a' : '#22c55e';
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );

      // Draw eyes on head
      if (index === 0) {
        ctx.fillStyle = 'white';
        const eyeSize = 3;
        const eyeOffset = 6;

        if (direction.x === 1) {
          ctx.fillRect(segment.x * CELL_SIZE + eyeOffset + 5, segment.y * CELL_SIZE + 5, eyeSize, eyeSize);
          ctx.fillRect(segment.x * CELL_SIZE + eyeOffset + 5, segment.y * CELL_SIZE + 12, eyeSize, eyeSize);
        } else if (direction.x === -1) {
          ctx.fillRect(segment.x * CELL_SIZE + 5, segment.y * CELL_SIZE + 5, eyeSize, eyeSize);
          ctx.fillRect(segment.x * CELL_SIZE + 5, segment.y * CELL_SIZE + 12, eyeSize, eyeSize);
        } else if (direction.y === 1) {
          ctx.fillRect(segment.x * CELL_SIZE + 5, segment.y * CELL_SIZE + eyeOffset + 5, eyeSize, eyeSize);
          ctx.fillRect(segment.x * CELL_SIZE + 12, segment.y * CELL_SIZE + eyeOffset + 5, eyeSize, eyeSize);
        } else {
          ctx.fillRect(segment.x * CELL_SIZE + 5, segment.y * CELL_SIZE + 5, eyeSize, eyeSize);
          ctx.fillRect(segment.x * CELL_SIZE + 12, segment.y * CELL_SIZE + 5, eyeSize, eyeSize);
        }
      }
    });

    // Draw food
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }, [snake, food, direction]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-2">
          Gebruik pijltjestoetsen of WASD om te bewegen
        </p>
        <p className="text-lg font-bold text-blue-600">
          Score: {score}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={GRID_SIZE * CELL_SIZE}
        height={GRID_SIZE * CELL_SIZE}
        className="border-2 border-gray-300 rounded-lg shadow-lg"
      />

      {gameOver && (
        <div className="text-center">
          <p className="text-xl font-bold text-red-600">Game Over!</p>
          <p className="text-gray-600">Final Score: {score}</p>
        </div>
      )}
    </div>
  );
}
