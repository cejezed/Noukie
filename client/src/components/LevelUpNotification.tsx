import { useEffect } from 'react';
import { Card } from './ui/card';
import { Star, Zap, X } from 'lucide-react';
import { Button } from './ui/button';

interface LevelUpNotificationProps {
  show: boolean;
  level: number;
  onDismiss: () => void;
}

export function LevelUpNotification({ show, level, onDismiss }: LevelUpNotificationProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 duration-500">
      <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-6 shadow-2xl border-0 max-w-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-3">
              <Star className="w-8 h-8 text-yellow-300 fill-yellow-300" />
            </div>
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2">
                Level Up!
                <Zap className="w-6 h-6 text-yellow-300" />
              </h3>
              <p className="text-sm opacity-90">Je bent nu level {level}!</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2 text-sm opacity-90">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-300 rounded-full"></span>
            Blijf studeren om meer te ontgrendelen!
          </p>
          {level >= 5 && level < 10 && (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-300 rounded-full"></span>
              2048 is nu ontgrendeld!
            </p>
          )}
          {level >= 10 && (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-300 rounded-full"></span>
              Je bent een studie-expert!
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
