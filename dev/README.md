# Splatwing — Spark.js Gaussian Flight MVP

A browser-based arcade flight prototype with a cinematic intro, control onboarding, and two Gaussian-splat worlds.

## Experience flow

1. Intro page presents the airplane and adventure premise.
2. Onboarding explains WASD, Shift boost, exploration, and portals.
3. Clicking **Start adventure** loads and reveals world one.
4. Once world one is playable, world two begins loading in the background with:
   - `opacity = 0`
   - `lod = true`
   - `enableLod = true`
   - `lodScale = 0.25`
5. Entering the portal reuses the initialized second mesh, restores `opacity = 1`, and raises `lodScale = 1`.

## Run

```bash
npm install
npm run dev
```

## Add your two Gaussian worlds

Place the files here:

```text
public/assets/worlds/chinese-world.ply
public/assets/worlds/japanese-world.ply
```

Then edit `src/worlds.ts`:

```ts
splatUrl: "/assets/worlds/chinese-world.ply"
```

Each world has independent position, rotation, scale, spawn, portal, and movement bounds.

## Controls

- `WASD` or arrow keys: steer
- `Shift`: boost
- Fly through the portal: move to the next scene

For production delivery, preprocess large `.ply` files into LoD `.rad` files and enable paged streaming for a materially faster first-frame experience.
