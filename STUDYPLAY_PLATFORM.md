# StudyPlay Game Platform - Implementation Documentation

## Overview

The StudyPlay Game Platform is a gamification system that rewards students for studying with playtime minutes that can be spent on mini-games. It includes a global XP/level system, leaderboards, and integrates seamlessly with the existing mental check-in and rewards systems.

## Architecture

### Core Concepts

1. **Focus → Fun**: Students earn playtime minutes by completing study activities
2. **Global XP & Levels**: Progression system across all activities
3. **Mini-Games**: 4 games accessible through the Games Hub
4. **Leaderboards**: Competition with privacy-friendly display names
5. **Separation of Concerns**:
   - `reward_points` (existing) → Mental check-in rewards for parents
   - `study_playtime` (new) → Game playtime earned through study
   - `study_profile` (new) → Global XP and level progression

## Database Schema

### Tables Created

#### `study_playtime`
Tracks available game minutes for each user.

```sql
- user_id (uuid, PK) → references users.id
- balance_minutes (integer) → Available minutes
- updated_at (timestamptz) → Last update
```

#### `study_playtime_log`
Audit log of all playtime transactions.

```sql
- id (uuid, PK)
- user_id (uuid) → references users.id
- delta (integer) → Positive = earned, negative = spent
- reason (text) → 'quiz_completed', 'mental_checkin', 'game_session', etc.
- meta (jsonb) → Optional metadata
- created_at (timestamptz)
```

#### `study_profile`
Global user progression profile.

```sql
- user_id (uuid, PK) → references users.id
- xp_total (integer) → Total XP earned
- level (integer) → Current level (calculated from XP)
- games_played (integer) → Total games played
- tests_completed (integer) → Total tests completed
- streak_days (integer) → Consecutive active days
- last_activity_date (date) → Last activity date
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `study_xp_log`
Audit log of all XP transactions.

```sql
- id (uuid, PK)
- user_id (uuid) → references users.id
- delta (integer) → XP change
- reason (text) → Source of XP
- meta (jsonb) → Optional metadata
- created_at (timestamptz)
```

#### `study_scores`
All game and quiz scores for leaderboards.

```sql
- id (uuid, PK)
- user_id (uuid) → references users.id
- game_id (text) → 'snake', 'brickwall', 'flappy', '2048', etc.
- score (integer) → Score achieved
- level_reached (integer) → Optional level reached
- created_at (timestamptz)
```

### RLS Policies

All tables have Row Level Security enabled:

- **Students**: Can read/write their own data
- **Parents**: Can read confirmed children's data (via `parent_child_relationships`)
- **Leaderboards**: Public read access (display names anonymized in API layer)

## API Endpoints

### Playtime System

#### `GET /api/playtime`
Get current playtime balance.

**Headers**: `x-user-id`

**Response**:
```json
{
  "balanceMinutes": 7
}
```

#### `POST /api/playtime/add` (Internal use only)
Add playtime minutes for a user.

**Body**:
```json
{
  "userId": "uuid",
  "delta": 3,
  "reason": "quiz_completed",
  "meta": { "quizId": "uuid" }
}
```

**Rules**:
- Maximum 15 minutes per day can be earned from focus activities
- Reasons: `quiz_completed`, `test_completed`, `mental_checkin`, `compliment_given`, `streak_bonus`

#### `POST /api/playtime/use`
Deduct playtime to start a game.

**Headers**: `x-user-id`

**Body**:
```json
{
  "costMinutes": 2
}
```

**Response**:
```json
{
  "success": true,
  "balanceMinutes": 5
}
```

### Profile & XP System

#### `GET /api/profile`
Get user's progression profile.

**Headers**: `x-user-id`

**Response**:
```json
{
  "xpTotal": 1234,
  "level": 7,
  "gamesPlayed": 42,
  "testsCompleted": 15,
  "streakDays": 5,
  "lastActivityDate": "2025-11-18"
}
```

#### `POST /api/profile/xp` (Internal use only)
Award XP to a user.

**Body**:
```json
{
  "userId": "uuid",
  "delta": 50,
  "reason": "quiz_completed",
  "meta": { "quizId": "uuid" }
}
```

**Response**:
```json
{
  "success": true,
  "newLevel": 7,
  "leveledUp": false,
  "xpTotal": 1234
}
```

**XP Sources**:
- Quiz/test completed: +50 XP
- Game session: +10-25 XP (based on score)
- Mental check-in: +15 XP
- Compliment given: +5 XP

**Level Formula**: `level = floor(sqrt(xp_total / 10))` with minimum 1

### Scores & Leaderboards

#### `POST /api/score/submit`
Submit a game score (also awards XP, updates streak, increments games_played).

**Headers**: `x-user-id`

**Body**:
```json
{
  "gameId": "snake",
  "score": 150,
  "levelReached": null
}
```

**Response**:
```json
{
  "success": true,
  "xpAwarded": 15,
  "newLevel": 7,
  "leveledUp": false
}
```

#### `GET /api/leaderboard?game=snake&limit=50`
Get leaderboard for a game.

**Response**:
```json
[
  {
    "userId": "uuid",
    "displayName": "AB",
    "score": 1234,
    "rank": 1,
    "levelReached": null
  }
]
```

**Privacy**: Display names are initials only (e.g., "AB" for "Anna Bakker")

#### `GET /api/user/highscore?gameId=snake`
Get user's high score for a game.

**Headers**: `x-user-id`

**Response**:
```json
{
  "highScore": 150
}
```

## Frontend Components

### Pages

#### `StudyGamesHub` (`/study/games`)
Main game hub page showing:
- Playtime balance, level, and streak
- How to earn playtime instructions
- Grid of available games with unlock status
- Game cards with high scores and play buttons

### Hooks

#### `usePlaytime()`
```typescript
const {
  balanceMinutes,
  isLoading,
  usePlaytime, // Function to deduct minutes
  isUsing
} = usePlaytime();
```

#### `useProfile()`
```typescript
const {
  profile,
  xpTotal,
  level,
  gamesPlayed,
  testsCompleted,
  streakDays,
  xpNeededForNextLevel,
  progressPercent,
  showLevelUp, // Auto-detected level up
  dismissLevelUp,
  isLoading
} = useProfile();
```

#### `useLeaderboard(gameId, limit)`
```typescript
const {
  leaderboard,
  userRank,
  userEntry,
  percentile,
  isLoading
} = useLeaderboard('snake', 50);
```

#### `useHighScore(gameId)`
```typescript
const {
  highScore,
  isLoading
} = useHighScore('snake');
```

### Components

#### `MiniGameShell`
Wrapper component for all mini-games. Handles:
- Playtime deduction at start
- Timer countdown
- Score tracking and submission
- XP/level-up feedback display
- Game over state

**Usage**:
```tsx
<MiniGameShell
  gameId="snake"
  name="Snake"
  costMinutes={2}
  durationSeconds={120}
  onClose={() => setSelectedGame(null)}
>
  {(props) => <Snake {...props} />}
</MiniGameShell>
```

**Props passed to children**:
```typescript
interface GameChildProps {
  onScoreChange: (score: number) => void;
  onGameOver: () => void;
  timeRemaining: number;
  isActive: boolean;
}
```

#### `LevelUpNotification`
Shows when user levels up (auto-dismisses after 5 seconds).

```tsx
<LevelUpNotification
  show={showLevelUp}
  level={level}
  onDismiss={dismissLevelUp}
/>
```

### Mini-Games

All games are located in `/client/src/components/games/`:

1. **Snake** (`Snake.tsx`) - Classic snake game with keyboard controls
2. **Brickwall** (`Brickwall.tsx`) - Breakout-style brick breaker with mouse control
3. **Flappy** (`Flappy.tsx`) - Flappy Bird clone with space/click to jump
4. **Game2048** (`Game2048.tsx`) - 2048 puzzle game with keyboard controls

Each game:
- Uses canvas for rendering (except 2048 which uses CSS grid)
- Implements `GameChildProps` interface
- Calls `onScoreChange()` when score updates
- Calls `onGameOver()` when game ends
- Respects `isActive` prop

## Integration with Existing Systems

### Mental Check-ins Integration

**IMPORTANT**: Mental check-ins continue to award `reward_points` as before (NOT modified).

**NEW**: Mental check-ins now ALSO:
1. Award **+2 playtime minutes** (via `storage.addPlaytime()`)
2. Award **+15 XP** (via `storage.awardXp()`)
3. Update streak (via `storage.updateStreak()`)

**Implementation location**: Where mental check-in is saved in backend.

### Quiz/Test Completion Integration

When a quiz or test is completed, call:

```typescript
// In backend after quiz submission
await storage.incrementTestsCompleted(userId);
await storage.awardXp(userId, 50, 'quiz_completed', { quizId });
await storage.addPlaytime(userId, 3, 'quiz_completed', { quizId });
await storage.updateStreak(userId);

// Return to client with feedback
return {
  // ... existing quiz result data
  xpAwarded: 50,
  playtimeAwarded: 3,
  leveledUp: result.leveledUp,
  newLevel: result.newLevel
};
```

### Compliment System Integration

When a compliment is given:

```typescript
await storage.awardXp(userId, 5, 'compliment_given');
await storage.addPlaytime(userId, 1, 'compliment_given');
```

### Event Logging for Parent Portal

Game sessions are logged to `app_events` table:

```typescript
await storage.createAppEvent({
  user_id: userId,
  event_type: 'study_session',
  metadata: JSON.stringify({ type: 'game', gameId, score }),
});
```

This makes game activity visible in parent usage metrics.

## Playtime Earning Rules

### Daily Limits
- **Maximum 15 minutes per day** from focus activities (quiz, mental, compliments)
- **No limit** on streak bonuses

### Sources

| Activity | Minutes | XP | Notes |
|----------|---------|----|----|
| Quiz completed | +3 | +50 | Counts toward 15min/day cap |
| Mental check-in | +2 | +15 | Counts toward 15min/day cap |
| Compliment given | +1 | +5 | Counts toward 15min/day cap |
| 3-day streak bonus | +2 | 0 | Does NOT count toward cap |

### Spending
- Each game session costs 2-3 minutes (defined per game)
- Deducted at game start (before playing)
- If insufficient minutes, game won't start

## Level System

### Level Calculation
```
level = floor(sqrt(xp_total / 10))
```

Minimum level: 1

### XP for Next Level
```
xp_for_level = (level^2) * 10
```

### Example Progression

| Level | XP Required | Total XP | Difference from Previous |
|-------|-------------|----------|--------------------------|
| 1 | 0 | 0 | - |
| 2 | 10 | 10 | +10 |
| 3 | 20 | 30 | +20 |
| 4 | 30 | 60 | +30 |
| 5 | 40 | 100 | +40 |
| 10 | 90 | 900 | - |
| 20 | 190 | 3900 | - |

### Unlocks

Game unlocks based on level:

- **Level 1**: Snake, Brickwall
- **Level 3**: Flappy
- **Level 5**: 2048

## Server-Side Helpers

### `addPlaytime(userId, delta, reason, meta?)`
Adds playtime minutes with daily cap enforcement.

```typescript
await storage.addPlaytime(
  'user-uuid',
  3, // minutes to add
  'quiz_completed',
  { quizId: 'quiz-uuid' }
);
```

### `awardXp(userId, delta, reason, meta?)`
Awards XP and recalculates level.

```typescript
const result = await storage.awardXp(
  'user-uuid',
  50, // XP to award
  'quiz_completed',
  { quizId: 'quiz-uuid' }
);

console.log(result.newLevel, result.leveledUp);
```

### `updateStreak(userId)`
Updates consecutive activity days and awards bonus playtime for milestones.

```typescript
await storage.updateStreak('user-uuid');
// Automatically awards +2 playtime every 3 days
```

### `incrementTestsCompleted(userId)`
Increments test counter in profile.

```typescript
await storage.incrementTestsCompleted('user-uuid');
```

### `incrementGamesPlayed(userId)`
Increments games counter in profile (called automatically by score submission).

```typescript
await storage.incrementGamesPlayed('user-uuid');
```

## Migration Guide

### Database Migration

Run the migration:

```bash
cd supabase
psql -U postgres -d [database] -f migrations/20251118170000_studyplay_platform.sql
```

### Existing Code Integration Points

1. **Quiz/Test Completion Endpoint**:
   - Add XP award
   - Add playtime award
   - Update streak
   - Increment tests_completed

2. **Mental Check-in Endpoint**:
   - Add XP award
   - Add playtime award
   - Update streak
   - **DO NOT modify** existing reward_points logic

3. **Compliment Endpoint** (if exists):
   - Add XP award
   - Add playtime award

4. **Student Dashboard/HUD**:
   - Add XP meter display
   - Add level badge
   - Add playtime indicator
   - Add "🎮 Games" navigation button to `/study/games`

## Testing Checklist

### Backend
- [ ] Create user profile automatically on first activity
- [ ] Playtime daily cap works (max 15 min/day)
- [ ] XP awards and level calculation correct
- [ ] Streak logic works (consecutive days, 3-day bonus)
- [ ] Score submission awards XP
- [ ] Leaderboard shows anonymized names
- [ ] RLS policies work for students and parents

### Frontend
- [ ] Games Hub displays correct playtime balance
- [ ] Games unlock at correct levels
- [ ] MiniGameShell deducts playtime on start
- [ ] Games work properly (controls, scoring)
- [ ] Score submission shows XP reward
- [ ] Level-up notification appears
- [ ] Leaderboards display correctly
- [ ] High scores update after playing

## Future Enhancements

Possible additions:

1. **More Games**: Pacman, Tetris, Outrun (placeholders exist)
2. **Multiplayer**: Real-time or turn-based challenges
3. **Achievements**: Badges for milestones
4. **Class Leaderboards**: Filter by classroom
5. **Friends System**: Friend leaderboards and challenges
6. **Customization**: Unlockable themes, avatars
7. **Power-ups**: Earn power-ups through study
8. **Tournaments**: Weekly/monthly competitions

## Support & Maintenance

### Monitoring

Key metrics to track:

- Daily active users playing games
- Average playtime earned per day
- Average playtime spent per day
- Most popular games
- Level distribution
- Streak retention

### Common Issues

**Issue**: User not earning playtime
- Check if daily cap (15min) reached
- Verify `study_playtime_log` for transactions
- Check RLS policies

**Issue**: Level not updating
- Verify XP calculation formula
- Check `study_xp_log` for transactions
- Ensure profile exists (auto-created on first XP award)

**Issue**: Games not unlocking
- Verify user level in `study_profile`
- Check unlock levels in `StudyGamesHub.tsx`

## Code Locations

### Backend
- **Schema**: `/shared/schema.ts` (lines 220-295)
- **Storage**: `/server/storage.ts` (lines 155-179 interface, 836-1209 implementation)
- **Routes**: `/server/routes.ts` (lines 1197-1409)
- **Migration**: `/supabase/migrations/20251118170000_studyplay_platform.sql`

### Frontend
- **Hooks**: `/client/src/hooks/usePlaytime.ts`, `useProfile.ts`, `useLeaderboard.ts`
- **Games Hub**: `/client/src/pages/study/StudyGamesHub.tsx`
- **MiniGameShell**: `/client/src/components/games/MiniGameShell.tsx`
- **Games**: `/client/src/components/games/` (Snake.tsx, Brickwall.tsx, Flappy.tsx, Game2048.tsx)
- **Notification**: `/client/src/components/LevelUpNotification.tsx`
- **Routing**: `/client/src/App.tsx` (route: `/study/games`)

## Summary

The StudyPlay Game Platform provides a complete gamification layer that:

✅ Rewards studying with playtime minutes (Focus → Fun)
✅ Tracks global progression with XP and levels
✅ Provides 4 fun mini-games with unlock system
✅ Shows competitive leaderboards with privacy
✅ Integrates seamlessly with existing mental check-ins and rewards
✅ Logs activity for parent portal visibility
✅ Encourages daily streaks and consistency

The system is fully decoupled from existing `reward_points`, using separate `study_playtime` and `study_profile` tables, ensuring no conflicts with parent-configured rewards.
