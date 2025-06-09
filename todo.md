NOTE:

# To-Do List for Building Typing RPG

This document outlines the steps to develop the Typing RPG web app, broken into phases for a structured and manageable process.

---

## Phase 1: Project Setup (1 Week)

### Backend Setup

- [ ] **Install Bun**

  - Install Bun using: `curl -fsSL https://bun.sh/install | bash`.
  - Confirm it works: `bun --version`.

- [ ] **Set Up Hono Server**

  - Create a backend folder: `mkdir typing-rpg-backend && cd typing-rpg-backend`.
  - Initialize a Bun project: `bun init`.
  - Install Hono: `bun install hono`.
  - Create `server.js` with a basic API:
    ```javascript
    import { Hono } from "hono";
    const app = new Hono();
    app.get("/", (c) => c.text("Typing RPG API"));
    export default app;
    ```
  - Start the server: `bun run server.js`.

- [ ] **Add Authentication with better-auth**

  - Install: `bun install better-auth better-auth/adapters/d1`.
  - Update `server.js` to include authentication:
    ```javascript
    import { betterAuth } from "better-auth";
    import { D1Adapter } from "better-auth/adapters/d1";
    const auth = betterAuth({
      database: new D1Adapter(c.env.D1_DATABASE),
      secret: c.env.AUTH_SECRET,
    });
    app.use("/auth/*", auth.handler);
    ```

- [ ] **Configure Cloudflare D1 Database**
  - Create a D1 database: `wrangler d1 create typing-rpg`.
  - Add to `wrangler.toml`:
    ```toml
    [[d1_databases]]
    binding = "D1_DATABASE"
    database_name = "typing-rpg"
    database_id = "<your-d1-id>"
    ```
  - Set up tables for users, inventory, and leaderboards:
    ```sql
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, avg_wpm REAL DEFAULT 0, total_slimes INTEGER DEFAULT 0);
    CREATE TABLE inventory (user_id TEXT, item_id TEXT, type TEXT, name TEXT, equipped BOOLEAN DEFAULT FALSE, PRIMARY KEY (user_id, item_id));
    CREATE TABLE leaderboard (user_id TEXT PRIMARY KEY, score INTEGER, country TEXT, updated_at TIMESTAMP);
    ```

### Frontend Setup

- [ ] **Initialize React Frontend**

  - Create a frontend folder: `cd .. && mkdir typing-rpg-frontend && cd typing-rpg-frontend`.
  - Set up a React app: `bun create react-app .`.
  - Install Tailwind CSS (follow [Tailwind’s guide](https://tailwindcss.com/docs/guides/create-react-app)) and Three.js: `bun install three @react-three/fiber`.

- [ ] **Set Up Cloudflare Pages**

  - In the Cloudflare dashboard, create a Pages project.
  - Link your GitHub repo, set the build command to `npm run build`, and output directory to `dist`.

- [ ] **Create Basic Components**
  - Add placeholder components: `TypingArea.js`, `SlimeDisplay.js`, `InventoryModal.js`, `Leaderboard.js`.
  - Use React state or routing to switch between screens (start, game, inventory, leaderboards).

---

## Phase 2: Typing and Combat Features (2 Weeks)

### Typing Interface

- [ ] **Build Typing Functionality**

  - In `TypingArea.js`, show a static paragraph of words.
  - Highlight the current word (green for correct, red for incorrect).
  - Calculate WPM, accuracy, and session time in real-time.
  - Require correct typing before moving to the next word.

- [ ] **Handle Typing Errors**
  - Track errors per slime in React state.
  - If errors exceed a limit (e.g., 5), disable item drops.

### Slime Combat

- [ ] **Design Slime with Three.js**

  - In `SlimeDisplay.js`, use React Three Fiber to create a 3D slime (e.g., a green sphere).
  - Add a shake animation when hit and an explode effect on defeat (e.g., scale or particles).

- [ ] **Implement Health Bar**

  - Base slime health on the number of words in the paragraph.
  - Reduce one health segment per correct word.
  - On zero health, defeat the slime, check for item drops, and spawn a new slime.

- [ ] **Support Guest and Logged-In Modes**
  - Check user login status with better-auth.
  - Store guest progress in React state; save logged-in user data to D1 via API.

---

## Phase 3: RPG Mechanics (2 Weeks)

### XP and Leveling

- [ ] **Calculate XP**

  - Set base XP (e.g., 10 for regular slimes, 50 for bosses).
  - Apply a WPM multiplier: `XP = base XP * (WPM / 50)`.
  - Update XP in state (guests) or backend (logged-in users).

- [ ] **Create Leveling System**
  - Define XP thresholds (e.g., 100 XP for Level 2).
  - Show a progress bar with current XP and level.
  - Unlock tougher slimes or bosses at higher levels.

### Inventory and Items

- [ ] **Add Item Drops**

  - After defeating a slime with few errors, roll for an item (e.g., 20% chance).
  - Assign a type (theme, cursor, font) and save to inventory (D1 for logged-in, state for guests).

- [ ] **Build Inventory UI**

  - In `InventoryModal.js`, display items with an equip button.
  - Apply equipped items (e.g., change theme, cursor, or font).

- [ ] **Add Difficulty Modes**
  - Create modes: Easy (1k/5k words), Normal (5k/10k), Hard (10k/25k), Insane (25k/450k).
  - Load word lists based on mode and slime type.

---

## Phase 4: Leaderboards and Final Touches (1 Week)

### Leaderboards

- [ ] **Retrieve Leaderboard Data**

  - Add an API endpoint in Hono:
    ```javascript
    app.get("/leaderboard", async (c) => {
      const db = c.env.D1_DATABASE;
      const { results } = await db
        .prepare(
          "SELECT username, score, country FROM leaderboard ORDER BY score DESC LIMIT 10"
        )
        .all();
      return c.json(results);
    });
    ```
  - Display results in `Leaderboard.js`.

- [ ] **Support Daily and All-Time Rankings**
  - Add a daily filter (e.g., `WHERE updated_at > CURRENT_DATE - INTERVAL '1 day'`).
  - Show the user’s rank and stats.

### Polish and Animations

- [ ] **Improve Slime Animations**

  - Enhance shake and explode effects with Three.js or GSAP.
  - Ensure animations run smoothly without slowing typing.

- [ ] **Refine UI**

  - Use a minimalist design with RPG flair (e.g., styled health bars).
  - Test responsiveness across screen sizes.

- [ ] **Enhance Authentication UX**
  - Prompt guests to log in to save progress.
  - Integrate better-auth’s client library for smooth login/signup.

---

## Testing and Deployment

### Testing

- [ ] **Write Unit Tests**

  - Test typing logic (word progression, errors) and combat (health, drops).

- [ ] **Run Integration Tests**

  - Verify authentication (guest vs. logged-in) and database interactions.

- [ ] **Conduct User Testing**
  - Get feedback from 5-10 beta testers.
  - Refine typing UX and RPG elements based on input.

### Deployment

- [ ] **Automate Deployment**

  - Set up GitHub Actions for Cloudflare:
    ```yaml
    name: Deploy to Cloudflare
    on: [push]
    jobs:
      deploy:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v2
          - run: bun install
          - run: bun run build
          - uses: cloudflare/pages-action@v1
            with:
              apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
              projectName: typing-rpg
    ```

- [ ] **Monitor and Optimize**
  - Check Cloudflare analytics for performance.
  - Optimize D1 queries and asset loading if needed.

---

## Additional Notes

- **Word Lists**: Prepare word lists for each difficulty (e.g., 1k, 5k, 10k, 25k, 450k) as JSON or in D1.
- **Assets**: Source or design themes, cursors, and fonts; host on Cloudflare R2.
- **Security**: Protect API routes with better-auth middleware.
- **Performance**: Optimize the slime model and Three.js rendering for all devices.

This to-do list ensures a systematic build of the Typing RPG, covering all key features and leading to a polished, deployable app. Let me know if you need more details on any step!
