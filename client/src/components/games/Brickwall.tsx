import { useEffect, useRef, useState } from 'react';
import { GameChildProps } from './MiniGameShell';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_RADIUS = 8;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_WIDTH = CANVAS_WIDTH / BRICK_COLS - 4;
const BRICK_HEIGHT = 20;

interface Brick {
  x: number;
  y: number;
  visible: boolean;
  color: string;
}

export function Brickwall({ onScoreChange, onGameOver, isActive }: GameChildProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paddleX, setPaddleX] = useState(CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2);
  const [ballX, setBallX] = useState(CANVAS_WIDTH / 2);
  const [ballY, setBallY] = useState(CANVAS_HEIGHT - 40);
  const [ballDX, setBallDX] = useState(3);
  const [ballDY, setBallDY] = useState(-3);
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const mouseXRef = useRef(paddleX);

  // Initialize bricks
  useEffect(() => {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
    const newBricks: Brick[] = [];

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        newBricks.push({
          x: col * (BRICK_WIDTH + 4) + 2,
          y: row * (BRICK_HEIGHT + 4) + 30,
          visible: true,
          color: colors[row],
        });
      }
    }

    setBricks(newBricks);
  }, []);

  // Mouse movement for paddle
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isActive || gameOver) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      // Keep paddle within bounds
      const newPaddleX = Math.max(
        0,
        Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2)
      );

      mouseXRef.current = newPaddleX;
      setPaddleX(newPaddleX);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive, gameOver]);

  // Game loop
  useEffect(() => {
    if (!isActive || gameOver) return;

    const gameLoop = setInterval(() => {
      setBallX(prevX => {
        let newX = prevX + ballDX;

        // Ball collision with walls
        if (newX - BALL_RADIUS < 0 || newX + BALL_RADIUS > CANVAS_WIDTH) {
          setBallDX(prev => -prev);
          newX = prevX; // Don't move for this frame
        }

        return newX;
      });

      setBallY(prevY => {
        let newY = prevY + ballDY;

        // Ball collision with top
        if (newY - BALL_RADIUS < 0) {
          setBallDY(prev => -prev);
          newY = prevY;
        }

        // Ball collision with paddle
        if (
          newY + BALL_RADIUS >= CANVAS_HEIGHT - PADDLE_HEIGHT &&
          newY + BALL_RADIUS <= CANVAS_HEIGHT &&
          ballX >= paddleX &&
          ballX <= paddleX + PADDLE_WIDTH
        ) {
          setBallDY(prev => -Math.abs(prev));

          // Add some angle based on where ball hits paddle
          const hitPos = (ballX - paddleX) / PADDLE_WIDTH; // 0 to 1
          const newDX = (hitPos - 0.5) * 6; // -3 to 3
          setBallDX(newDX);

          newY = CANVAS_HEIGHT - PADDLE_HEIGHT - BALL_RADIUS;
        }

        // Ball falls below paddle
        if (newY > CANVAS_HEIGHT) {
          setGameOver(true);
          onGameOver();
        }

        return newY;
      });

      // Check brick collisions
      setBricks(prevBricks => {
        let newScore = score;
        const newBricks = prevBricks.map(brick => {
          if (!brick.visible) return brick;

          // Check collision
          if (
            ballX + BALL_RADIUS > brick.x &&
            ballX - BALL_RADIUS < brick.x + BRICK_WIDTH &&
            ballY + BALL_RADIUS > brick.y &&
            ballY - BALL_RADIUS < brick.y + BRICK_HEIGHT
          ) {
            // Brick hit!
            setBallDY(prev => -prev);
            newScore += 10;

            return { ...brick, visible: false };
          }

          return brick;
        });

        if (newScore !== score) {
          setScore(newScore);
          onScoreChange(newScore);

          // Check if all bricks destroyed
          const allDestroyed = newBricks.every(b => !b.visible);
          if (allDestroyed) {
            setGameOver(true);
            onGameOver();
          }
        }

        return newBricks;
      });
    }, 16); // ~60 FPS

    return () => clearInterval(gameLoop);
  }, [isActive, gameOver, ballX, ballY, ballDX, ballDY, paddleX, score]);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw bricks
    bricks.forEach(brick => {
      if (brick.visible) {
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);

        // Add shading
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT / 3);
      }
    });

    // Draw paddle
    const gradient = ctx.createLinearGradient(
      paddleX,
      CANVAS_HEIGHT - PADDLE_HEIGHT,
      paddleX,
      CANVAS_HEIGHT
    );
    gradient.addColorStop(0, '#60a5fa');
    gradient.addColorStop(1, '#3b82f6');

    ctx.fillStyle = gradient;
    ctx.fillRect(paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw ball
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Add glow effect to ball
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fbbf24';
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [paddleX, ballX, ballY, bricks]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-2">
          Beweeg je muis om de peddel te besturen
        </p>
        <p className="text-lg font-bold text-blue-600">
          Score: {score}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-300 rounded-lg shadow-lg"
      />

      {gameOver && (
        <div className="text-center">
          <p className="text-xl font-bold text-red-600">
            {bricks.every(b => !b.visible) ? 'Gewonnen! 🎉' : 'Game Over!'}
          </p>
          <p className="text-gray-600">Final Score: {score}</p>
        </div>
      )}
    </div>
  );
}
