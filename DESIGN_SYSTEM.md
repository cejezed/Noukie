# Design System - Noukie App

Alle styling wordt gestuurd via CSS variabelen in `/client/src/index.css` en Tailwind classes. **Gebruik geen hardcoded kleuren** zoals `bg-blue-500` of `text-red-600` in pagina's.

## Kleuren

### Base Kleuren (gebruik deze in plaats van gray-X)
```tsx
// ❌ NIET DOEN
<div className="bg-gray-100 text-gray-900">

// ✅ WEL DOEN
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<div className="bg-muted text-muted-foreground">
```

### Semantische Kleuren
```tsx
// Success (groen)
<button className="bg-success text-success-foreground">Opslaan</button>

// Warning (oranje/geel)
<div className="bg-warning text-warning-foreground">Let op!</div>

// Error/Destructive (rood)
<button className="bg-destructive text-destructive-foreground">Verwijderen</button>

// Info (blauw)
<div className="bg-info text-info-foreground">Tip: ...</div>
```

### Feature-Specifieke Kleuren

#### Quiz Kleuren
```tsx
// Oefenmodus
<button className="bg-quiz-practice text-white">📚 Oefenen</button>
// Of gebruik de utility class:
<button className="btn-quiz-practice">📚 Oefenen</button>

// Game modus (gradient)
<button className="bg-gradient-to-r from-quiz-game to-quiz-game-secondary text-white">
  🎮 Game
</button>
// Of gebruik de utility class:
<button className="btn-quiz-game">🎮 Game</button>
```

#### Mental Health Kleuren
```tsx
// Status badges
<span className="mental-ok">Goed</span>
<span className="mental-warning">Let op</span>
<span className="mental-alert">Hulp nodig</span>

// In graphics/charts
<div className="bg-mental-ok">...</div>
<div className="bg-mental-warning">...</div>
<div className="bg-mental-alert">...</div>
```

#### Games & Features
```tsx
// Games pagina
<div className="bg-games-primary">Games</div>

// Compliments
<div className="bg-compliments-primary">Complimenten</div>

// LeerChat
<div className="bg-leerchat-primary">Uitleg</div>
```

## Spacing

Gebruik de spacing scale in plaats van hardcoded values:

```tsx
// ❌ NIET DOEN
<div className="p-4 mb-6 gap-2">

// ✅ WEL DOEN
<div className="p-md mb-lg gap-sm">
```

Spacing scale:
- `xs` = 0.25rem (4px)
- `sm` = 0.5rem (8px)
- `md` = 1rem (16px)
- `lg` = 1.5rem (24px)
- `xl` = 2rem (32px)
- `2xl` = 3rem (48px)
- `3xl` = 4rem (64px)

## Border Radius

```tsx
// ❌ NIET DOEN
<div className="rounded-lg">

// ✅ WEL DOEN
<div className="rounded-xl">  // Voor cards
<div className="rounded-2xl"> // Voor grote sections
<button className="rounded-md"> // Voor buttons
```

Radius scale:
- `sm` = 0.375rem
- `md` = 0.75rem (default voor cards)
- `lg` = 1rem
- `xl` = 1.5rem
- `2xl` = 2rem
- `full` = volledig rond

## Shadows

```tsx
// ❌ NIET DOEN
<div className="shadow-lg">

// ✅ WEL DOEN
<div className="shadow-md">  // Voor cards
<div className="shadow-lg">  // Voor modals/dialogs
```

## Cards

```tsx
// Basic card
<div className="card-elevated">
  <h2>Title</h2>
  <p>Content</p>
</div>

// Hoverable card
<div className="card-hover bg-card rounded-2xl p-lg shadow-md">
  <h2>Title</h2>
</div>
```

## Buttons

```tsx
// Primary button (gebruik shadcn/ui Button component)
<Button>Klikken</Button>

// Quiz buttons
<Button className="btn-quiz-practice">📚 Oefenen</Button>
<Button className="btn-quiz-game">🎮 Game</Button>

// Semantic buttons
<Button className="btn-success">Opslaan</Button>
<Button className="btn-warning">Waarschuwing</Button>
```

## Badges

```tsx
// Quiz badge
<span className="badge-quiz">Quiz</span>

// Game badge
<span className="badge-game">Game Mode</span>

// Of custom met Tailwind
<span className="bg-success/10 text-success px-sm py-xs rounded text-xs font-medium">
  Nieuw
</span>
```

## Transitions

```tsx
// ❌ NIET DOEN
<button className="transition duration-200">

// ✅ WEL DOEN
<button className="transition duration-base">
<div className="transition-all duration-fast">
<div className="transition-all duration-slow">
```

## Voorbeeld: Quiz Card

### Oude manier (hardcoded):
```tsx
<div className="bg-white border rounded-2xl p-4 hover:shadow">
  <div className="text-sm text-gray-500">
    Aardrijkskunde · Hoofdstuk 3
  </div>
  <div className="font-semibold mb-2">Rijn & Maas</div>
  <div className="flex gap-2 mt-3">
    <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
      📚 Oefenen
    </button>
    <button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg">
      🎮 Game
    </button>
  </div>
</div>
```

### Nieuwe manier (design system):
```tsx
<div className="card-hover bg-card border rounded-2xl p-md">
  <div className="text-sm text-muted-foreground">
    Aardrijkskunde · Hoofdstuk 3
  </div>
  <div className="font-semibold mb-sm">Rijn & Maas</div>
  <div className="flex gap-sm mt-md">
    <button className="flex-1 btn-quiz-practice px-md py-sm rounded-lg transition duration-base">
      📚 Oefenen
    </button>
    <button className="flex-1 btn-quiz-game px-md py-sm rounded-lg transition duration-base">
      🎮 Game
    </button>
  </div>
</div>
```

## Kleuren Aanpassen

Als je een kleur wilt wijzigen voor de hele app, pas deze aan in `/client/src/index.css`:

```css
:root {
  /* Bijvoorbeeld: Game mode kleur aanpassen */
  --quiz-game: hsl(280, 85%, 60%);  /* Paars */
  --quiz-game-secondary: hsl(330, 85%, 60%);  /* Roze */
}
```

Dan worden automatisch alle `btn-quiz-game`, `bg-quiz-game`, etc. aangepast in de hele app!

## Dark Mode

Alle kleuren hebben automatisch dark mode variants in de `.dark` class. Voeg gewoon `dark:` prefix toe:

```tsx
<div className="bg-card dark:bg-card text-foreground dark:text-foreground">
  Auto dark mode!
</div>
```
