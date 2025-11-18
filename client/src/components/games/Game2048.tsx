import { useEffect, useState } from 'react';
import { GameChildProps } from './MiniGameShell';

const GRID_SIZE = 4;
type Grid = number[][];

const COLORS: Record<number, { bg: string; text: string }> = {
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
};

export function Game2048({ onScoreChange, onGameOver, isActive }: GameChildProps) {
  const [grid, setGrid] = useState<Grid>(() => initializeGrid());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  function initializeGrid(): Grid {
    const newGrid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
    addNewTile(newGrid);
    addNewTile(newGrid);
    return newGrid;
  }

  function addNewTile(grid: Grid): void {
    const emptyCells: [number, number][] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 0) {
          emptyCells.push([r, c]);
        }
      }
    }

    if (emptyCells.length > 0) {
      const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  function compress(grid: Grid): { grid: Grid; changed: boolean } {
    const newGrid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
    let changed = false;

    for (let r = 0; r < GRID_SIZE; r++) {
      let pos = 0;
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] !== 0) {
          newGrid[r][pos] = grid[r][c];
          if (c !== pos) changed = true;
          pos++;
        }
      }
    }

    return { grid: newGrid, changed };
  }

  function merge(grid: Grid): { grid: Grid; scoreGained: number; changed: boolean } {
    let scoreGained = 0;
    let changed = false;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE - 1; c++) {
        if (grid[r][c] !== 0 && grid[r][c] === grid[r][c + 1]) {
          grid[r][c] *= 2;
          grid[r][c + 1] = 0;
          scoreGained += grid[r][c];
          changed = true;

          // Check for win condition
          if (grid[r][c] === 2048 && !won) {
            setWon(true);
          }
        }
      }
    }

    return { grid, scoreGained, changed };
  }

  function reverse(grid: Grid): Grid {
    return grid.map(row => [...row].reverse());
  }

  function transpose(grid: Grid): Grid {
    const newGrid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        newGrid[r][c] = grid[c][r];
      }
    }

    return newGrid;
  }

  function moveLeft(grid: Grid): { grid: Grid; scoreGained: number; moved: boolean } {
    const compressed1 = compress(grid);
    const merged = merge(compressed1.grid);
    const compressed2 = compress(merged.grid);

    return {
      grid: compressed2.grid,
      scoreGained: merged.scoreGained,
      moved: compressed1.changed || merged.changed || compressed2.changed,
    };
  }

  function moveRight(grid: Grid): { grid: Grid; scoreGained: number; moved: boolean } {
    const reversed = reverse(grid);
    const result = moveLeft(reversed);
    return { ...result, grid: reverse(result.grid) };
  }

  function moveUp(grid: Grid): { grid: Grid; scoreGained: number; moved: boolean } {
    const transposed = transpose(grid);
    const result = moveLeft(transposed);
    return { ...result, grid: transpose(result.grid) };
  }

  function moveDown(grid: Grid): { grid: Grid; scoreGained: number; moved: boolean } {
    const transposed = transpose(grid);
    const result = moveRight(transposed);
    return { ...result, grid: transpose(result.grid) };
  }

  function isGameOver(grid: Grid): boolean {
    // Check if there are any empty cells
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 0) return false;
      }
    }

    // Check if any adjacent cells can be merged
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
        if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
      }
    }

    return true;
  }

  function handleMove(direction: 'left' | 'right' | 'up' | 'down'): void {
    if (gameOver) return;

    let result: { grid: Grid; scoreGained: number; moved: boolean };

    switch (direction) {
      case 'left':
        result = moveLeft(JSON.parse(JSON.stringify(grid)));
        break;
      case 'right':
        result = moveRight(JSON.parse(JSON.stringify(grid)));
        break;
      case 'up':
        result = moveUp(JSON.parse(JSON.stringify(grid)));
        break;
      case 'down':
        result = moveDown(JSON.parse(JSON.stringify(grid)));
        break;
    }

    if (result.moved) {
      addNewTile(result.grid);
      setGrid(result.grid);

      const newScore = score + result.scoreGained;
      setScore(newScore);
      onScoreChange(newScore);

      if (isGameOver(result.grid)) {
        setGameOver(true);
        onGameOver();
      }
    }
  }

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isActive || gameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          e.preventDefault();
          handleMove('left');
          break;
        case 'ArrowRight':
        case 'd':
          e.preventDefault();
          handleMove('right');
          break;
        case 'ArrowUp':
        case 'w':
          e.preventDefault();
          handleMove('up');
          break;
        case 'ArrowDown':
        case 's':
          e.preventDefault();
          handleMove('down');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [grid, score, gameOver, isActive]);

  const getTileColor = (value: number) => {
    return COLORS[value] || { bg: '#3c3a32', text: '#f9f6f2' };
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-2">
          Gebruik pijltjestoetsen of WASD om tegels te verschuiven
        </p>
        <p className="text-lg font-bold text-blue-600">
          Score: {score}
        </p>
        {won && !gameOver && (
          <p className="text-lg font-bold text-green-600 mt-2">
            Je hebt 2048 bereikt! 🎉 Ga door!
          </p>
        )}
      </div>

      <div
        className="grid gap-2 p-4 bg-[#bbada0] rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, 100px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 100px)`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            const colors = getTileColor(value);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="rounded-md flex items-center justify-center font-bold text-3xl transition-all duration-150"
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                  width: '100px',
                  height: '100px',
                }}
              >
                {value !== 0 ? value : ''}
              </div>
            );
          })
        )}
      </div>

      {gameOver && (
        <div className="text-center">
          <p className="text-xl font-bold text-red-600">Game Over!</p>
          <p className="text-gray-600">Final Score: {score}</p>
        </div>
      )}
    </div>
  );
}
