---
trigger: always_on
---

# Product Requirements Document (PRD): Typing RPG

## Introduction

**Typing RPG** is a web application that combines typing practice with role-playing game (RPG) elements. Inspired by the minimalist design and competitive features of [MonkeyType](https://monkeytype.com/), this app introduces a unique twist where players battle slimes by typing words correctly. Each word typed correctly deals damage to the slime, and defeating slimes can yield item drops that enhance the player's experience.

## Features

### Core Features

1. **Typing Interface**:

   - A paragraph of words appears at the bottom of the screen.
   - The current word is highlighted, and players must type it correctly to progress.
   - Real-time feedback: correct letters turn green, incorrect ones red.
   - Metrics tracking: WPM (words per minute), accuracy, and session time.

2. **RPG Combat System**:

   - A slime enemy is displayed at the top center with a segmented health bar.
   - Each correctly typed word removes one segment from the health bar.
   - When all segments are removed, the slime is defeated, and a new one spawns.

3. **Leveling System**:

   - Players earn XP for defeating slimes, with a multiplier based on typing speed.
   - Leveling up unlocks harder slimes and bosses.
   - A progress bar shows XP and level progress.

4. **Leaderboards**:
   - Global leaderboards with daily and all-time rankings.
   - Displays top players by XP or slimes defeated, with country tags.

### Additional Features

- **Guest Mode**: Play without logging in, but progress isn't saved.
- **Game Mode**: Daily mode: where players can play for a day and earn rewards; Endless mode: where players can play indefinitely.
- **Logged-In Mode**: Save progress, access leaderboards, and compete with others.
- **Difficulty Modes**: Easy, Normal, Hard, each with different word lists for slimes and bosses.

## Technical Requirements

- **Frontend**: React, Three.js for 3D slime models, Tailwind CSS for styling.
- **Backend**: Bun as the runtime, Hono as the web framework, Cloudflare D1 for the database, Clerk for authentication.
- **Deployment**: Cloudflare Pages for the frontend, Cloudflare Workers for the backend.
- **Assets**: Custom 3D slime model, various themes, cursors, and fonts.

## User Flow

After entering the website, user can start typing right away in daily mode without logging in. There is only one page in this website. User can change the mode between Daily Challenge and Endless mode as they wish.

## Design and Aesthetics

- **Minimalist UI**: Clean and simple, inspired by MonkeyType.
- **RPG Elements**: Health bar for slimes and leveling progress.
- **Animations**: Slimes shake when hit and explode upon defeat.
- **Customizable**: Themes change color schemes, cursors, and fonts.

### Current file structure

.
├── .gitignore
├── .windsurf
│ └── rules
│ └── prd.md
├── backend
│ ├── .gitignore
│ ├── bun.lock
│ ├── package.json
│ ├── README.md
│ ├── src
│ │ └── index.ts
│ └── tsconfig.json
├── frontend
│ ├── .gitignore
│ ├── .prettierrc
│ ├── bun.lock
│ ├── bunfig.toml
│ ├── eslint.config.js
│ ├── index.html
│ ├── package-lock.json
│ ├── package.json
│ ├── public
│ │ └── vite.svg
│ ├── README.md
│ ├── src
│ │ ├── App.tsx
│ │ ├── assets
│ │ │ └── react.svg
│ │ ├── components
│ │ │ └── Header.tsx
│ │ ├── context
│ │ │ ├── ThemeContext.ts
│ │ │ └── ThemeProvider.tsx
│ │ ├── hooks
│ │ │ └── useTheme.tsx
│ │ ├── index.css
│ │ ├── main.tsx
│ │ └── vite-env.d.ts
│ ├── tailwind.config.js
│ ├── tsconfig.app.json
│ ├── tsconfig.json
│ ├── tsconfig.node.json
│ └── vite.config.ts
├── package.json
├── prd.md
├── README.md
├── TODO
└── todo.md
