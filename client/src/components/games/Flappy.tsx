import { useEffect, useRef, useState } from 'react';
import { GameChildProps } from './MiniGameShell';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BIRD_SIZE = 30;
const BIRD_X = 80;
const GRAVITY = 0.5;
const JUMP_STRENGTH = -8;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const PIPE_SPEED = 3;

interface Pipe {
  x: number;
  topHeight: number;
  scored: boolean;
}

export function Flappy({ onScoreChange, onGameOver, isActive }: GameChildProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [birdY, setBirdY] = useState(CANVAS_HEIGHT / 2);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([
    { x: CANVAS_WIDTH, topHeight: 150, scored: false },
  ]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Handle space bar or click to jump
  useEffect(() => {
    const handleJump = () => {
      if (!isActive) return;

      if (!gameStarted) {
        setGameStarted(true);
      }

      if (!gameOver) {
        setBirdVelocity(JUMP_STRENGTH);
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleJump();
      }
    };

    const handleClick = () => {
      handleJump();
    };

    window.addEventListener('keydown', handleKeyPress);
    const canvas = canvasRef.current;
    canvas?.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      canvas?.removeEventListener('click', handleClick);
    };
  }, [isActive, gameStarted, gameOver]);

  // Game loop
  useEffect(() => {
    if (!isActive || !gameStarted || gameOver) return;

    const gameLoop = setInterval(() => {
      // Update bird position
      setBirdVelocity(prev => prev + GRAVITY);
      setBirdY(prev => {
        const newY = prev + birdVelocity;

        // Check ground/ceiling collision
        if (newY < 0 || newY + BIRD_SIZE > CANVAS_HEIGHT) {
          setGameOver(true);
          onGameOver();
          return prev;
        }

        return newY;
      });

      // Update pipes
      setPipes(prevPipes => {
        let newScore = score;
        let newPipes = prevPipes.map(pipe => {
          const newX = pipe.x - PIPE_SPEED;

          // Score when bird passes pipe
          if (!pipe.scored && newX + PIPE_WIDTH < BIRD_X) {
            newScore += 1;
            return { ...pipe, x: newX, scored: true };
          }

          return { ...pipe, x: newX };
        });

        // Remove pipes that are off screen
        newPipes = newPipes.filter(pipe => pipe.x > -PIPE_WIDTH);

        // Add new pipe when needed
        const lastPipe = newPipes[newPipes.length - 1];
        if (!lastPipe || lastPipe.x < CANVAS_WIDTH - 250) {
          const minHeight = 50;
          const maxHeight = CANVAS_HEIGHT - PIPE_GAP - 50;
          const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;

          newPipes.push({
            x: CANVAS_WIDTH,
            topHeight,
            scored: false,
          });
        }

        // Check collision with pipes
        newPipes.forEach(pipe => {
          const birdLeft = BIRD_X;
          const birdRight = BIRD_X + BIRD_SIZE;
          const birdTop = birdY;
          const birdBottom = birdY + BIRD_SIZE;

          const pipeLeft = pipe.x;
          const pipeRight = pipe.x + PIPE_WIDTH;

          // Check if bird is within pipe's x range
          if (birdRight > pipeLeft && birdLeft < pipeRight) {
            // Check if bird hits top or bottom pipe
            if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + PIPE_GAP) {
              setGameOver(true);
              onGameOver();
            }
          }
        });

        if (newScore !== score) {
          setScore(newScore);
          onScoreChange(newScore);
        }

        return newPipes;
      });
    }, 16); // ~60 FPS

    return () => clearInterval(gameLoop);
  }, [isActive, gameStarted, gameOver, birdY, birdVelocity, score]);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw pipes
    pipes.forEach(pipe => {
      // Top pipe
      ctx.fillStyle = '#10b981';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);

      // Top pipe cap
      ctx.fillStyle = '#059669';
      ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, PIPE_WIDTH + 10, 20);

      // Bottom pipe
      const bottomPipeY = pipe.topHeight + PIPE_GAP;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, CANVAS_HEIGHT - bottomPipeY);

      // Bottom pipe cap
      ctx.fillStyle = '#059669';
      ctx.fillRect(pipe.x - 5, bottomPipeY, PIPE_WIDTH + 10, 20);
    });

    // Draw bird
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(BIRD_X + BIRD_SIZE / 2, birdY + BIRD_SIZE / 2, BIRD_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Bird eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(BIRD_X + BIRD_SIZE / 2 + 8, birdY + BIRD_SIZE / 2 - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(BIRD_X + BIRD_SIZE / 2 + 10, birdY + BIRD_SIZE / 2 - 5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bird beak
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(BIRD_X + BIRD_SIZE, birdY + BIRD_SIZE / 2);
    ctx.lineTo(BIRD_X + BIRD_SIZE + 10, birdY + BIRD_SIZE / 2 - 5);
    ctx.lineTo(BIRD_X + BIRD_SIZE + 10, birdY + BIRD_SIZE / 2 + 5);
    ctx.closePath();
    ctx.fill();

    // Score display
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(score.toString(), CANVAS_WIDTH / 2, 60);
    ctx.fillText(score.toString(), CANVAS_WIDTH / 2, 60);
  }, [birdY, pipes, score]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-2">
          {!gameStarted ? 'Klik of druk op spatie om te beginnen' : 'Klik of druk op spatie om te springen'}
        </p>
        <p className="text-lg font-bold text-blue-600">
          Score: {score}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-300 rounded-lg shadow-lg cursor-pointer"
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
