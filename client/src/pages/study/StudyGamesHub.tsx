import { useState } from 'react';
import { usePlaytime } from '../../hooks/usePlaytime';
import { useProfile } from '../../hooks/useProfile';
import { useHighScore } from '../../hooks/useLeaderboard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Battery, Trophy, Star, Lock, Zap, ArrowLeft, TrendingUp } from 'lucide-react';
import { MiniGameShell } from '../../components/games/MiniGameShell';
import { Snake } from '../../components/games/Snake';
import { Brickwall } from '../../components/games/Brickwall';
import { Flappy } from '../../components/games/Flappy';
import { Game2048 } from '../../components/games/Game2048';

interface GameConfig {
  id: string;
  name: string;
  costMinutes: number;
  durationSeconds: number;
  unlockLevel: number;
  description: string;
  icon: string;
}

const GAMES: GameConfig[] = [
  {
    id: 'snake',
    name: 'Snake',
    costMinutes: 2,
    durationSeconds: 120,
    unlockLevel: 1,
    description: 'Klassieke snake game - verzamel appels!',
    icon: '🐍',
  },
  {
    id: 'brickwall',
    name: 'Brickwall',
    costMinutes: 2,
    durationSeconds: 180,
    unlockLevel: 1,
    description: 'Breek alle stenen met de bal!',
    icon: '🧱',
  },
  {
    id: 'flappy',
    name: 'Flappy',
    costMinutes: 2,
    durationSeconds: 120,
    unlockLevel: 3,
    description: 'Vlieg door de obstakels!',
    icon: '🐦',
  },
  {
    id: '2048',
    name: '2048',
    costMinutes: 3,
    durationSeconds: 300,
    unlockLevel: 5,
    description: 'Combineer tegels om 2048 te bereiken!',
    icon: '🔢',
  },
];

export default function StudyGamesHub() {
  const { balanceMinutes, isLoading: playtimeLoading } = usePlaytime();
  const { level, streakDays, isLoading: profileLoading } = useProfile();
  const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);

  const handleGameClose = () => {
    setSelectedGame(null);
  };

  const handlePlayGame = (game: GameConfig) => {
    setSelectedGame(game);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">🎮 Speelhal</h1>
          </div>
        </div>

        {/* Playtime & Streak Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Playtime Card */}
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Speeltijd</p>
                  <p className="text-3xl font-bold">{balanceMinutes} min</p>
                  <p className="text-xs opacity-75 mt-1">Beschikbaar om te spelen</p>
                </div>
                <Battery className="w-12 h-12 opacity-90" />
              </div>
            </CardContent>
          </Card>

          {/* Level Card */}
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Level</p>
                  <p className="text-3xl font-bold">Lv {level}</p>
                  <p className="text-xs opacity-75 mt-1">Globale progressie</p>
                </div>
                <Star className="w-12 h-12 opacity-90" />
              </div>
            </CardContent>
          </Card>

          {/* Streak Card */}
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Streak</p>
                  <p className="text-3xl font-bold">{streakDays} dagen</p>
                  <p className="text-xs opacity-75 mt-1">
                    {streakDays % 3 === 2 ? '+2 min morgen!' : 'Blijf actief!'}
                  </p>
                </div>
                <Zap className="w-12 h-12 opacity-90" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How to Earn Playtime */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Speelminuten verdienen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-3">
              Verdien speelminuten door te studeren en je mentale check-in in te vullen:
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Toets afgerond: <strong>+3 minuten</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Mentale check-in ingevuld: <strong>+2 minuten</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Compliment gegeven: <strong>+1 minuut</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>3-daagse streak: <strong>+2 bonus minuten</strong></span>
              </li>
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              Maximaal 15 minuten per dag te verdienen via studeren.
            </p>
          </CardContent>
        </Card>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GAMES.map(game => (
            <GameCard
              key={game.id}
              game={game}
              userLevel={level}
              balanceMinutes={balanceMinutes}
              onPlay={handlePlayGame}
            />
          ))}
        </div>
      </div>

      {/* Game Modal */}
      {selectedGame && (
        <MiniGameShell
          gameId={selectedGame.id}
          name={selectedGame.name}
          costMinutes={selectedGame.costMinutes}
          durationSeconds={selectedGame.durationSeconds}
          onClose={handleGameClose}
        >
          {(props) => {
            if (selectedGame.id === 'snake') return <Snake {...props} />;
            if (selectedGame.id === 'brickwall') return <Brickwall {...props} />;
            if (selectedGame.id === 'flappy') return <Flappy {...props} />;
            if (selectedGame.id === '2048') return <Game2048 {...props} />;
            return null;
          }}
        </MiniGameShell>
      )}
    </div>
  );
}

interface GameCardProps {
  game: GameConfig;
  userLevel: number;
  balanceMinutes: number;
  onPlay: (game: GameConfig) => void;
}

function GameCard({ game, userLevel, balanceMinutes, onPlay }: GameCardProps) {
  const isLocked = userLevel < game.unlockLevel;
  const hasEnoughMinutes = balanceMinutes >= game.costMinutes;
  const { highScore } = useHighScore(game.id);

  const canPlay = !isLocked && hasEnoughMinutes;

  return (
    <Card className={`relative ${isLocked ? 'opacity-60' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="text-4xl">{game.icon}</div>
          {isLocked && (
            <Lock className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <CardTitle className="text-lg">{game.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">{game.description}</p>

        {/* High Score */}
        {highScore > 0 && (
          <div className="flex items-center gap-2 mb-3 text-sm text-amber-600">
            <Trophy className="w-4 h-4" />
            <span>Best: {highScore}</span>
          </div>
        )}

        {/* Cost */}
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-700">
          <Battery className="w-4 h-4" />
          <span>{game.costMinutes} min per sessie</span>
        </div>

        {/* Play Button */}
        {isLocked ? (
          <Button disabled className="w-full" variant="outline">
            <Lock className="w-4 h-4 mr-2" />
            Level {game.unlockLevel} vereist
          </Button>
        ) : !hasEnoughMinutes ? (
          <Button disabled className="w-full" variant="outline">
            Te weinig minuten
          </Button>
        ) : (
          <Button
            onClick={() => onPlay(game)}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            Spelen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
