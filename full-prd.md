# Product Requirements Document (PRD): Typing RPG

## Introduction

**Typing RPG** is a web application that combines typing practice with role-playing game (RPG) elements. Inspired by the minimalist design and competitive features of [MonkeyType](https://monkeytype.com/), this app introduces a unique twist where players battle slimes by typing words correctly. Each word typed correctly deals damage to the slime, and defeating slimes can yield item drops that enhance the player's experience.

## Objectives

The main objectives of Typing RPG are:

- To provide an engaging and fun way to practice typing skills.
- To introduce RPG elements that motivate users to improve their typing speed and accuracy.
- To foster a competitive environment through leaderboards and daily challenges.
- To offer a customizable experience through item drops and themes.

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

After entering the website, user can start typing right away in daily mode without logging in. There is only one page in this website.

## Design and Aesthetics

- **Minimalist UI**: Clean and simple, inspired by MonkeyType.
- **RPG Elements**: Health bar for slimes and leveling progress.
- **Animations**: Slimes shake when hit and explode upon defeat.
- **Customizable**: Themes change color schemes, cursors, and fonts.

## Development Plan

1. **Phase 1: Setup (1 Week)**:

   - Set up Bun, Hono, Clerk, and Cloudflare D1.
   - Initialize React with Three.js and Tailwind CSS.
   - Deploy a skeleton frontend to Cloudflare Pages.

2. **Phase 2: Typing and Combat (2 Weeks)**:

   - Implement the typing interface with real-time feedback.
   - Create the slime display with Three.js animations.
   - Integrate guest mode and logged-in mode with better-auth.

3. **Phase 3: RPG Mechanics (2 Weeks)**:

   - Develop the XP and leveling system.
   - Add difficulty modes with corresponding word lists.

4. **Phase 4: Leaderboards and Polish (1 Week)**:
   - Implement leaderboards fetching data from D1.
   - Polish animations and UI elements.
   - Ensure seamless guest/login experience.

## Testing and Deployment

- **Testing**:

  - Unit tests for typing logic and combat mechanics.
  - Integration tests for authentication and database interactions.
  - User testing with a small group to gather feedback.

- **Deployment**:
  - Continuous deployment via GitHub Actions or similar.
  - Monitor performance and errors using Cloudflare's analytics.

## Future Considerations

- **Achievements**: Badges for milestones like defeating 100 slimes or reaching 80 WPM.
- **Multiplayer Elements**: Optional real-time typing races or co-op battles.
- **More Customization**: Additional themes, cursors, and fonts.
