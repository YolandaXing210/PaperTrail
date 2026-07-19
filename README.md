# PaperTrail

A browser-based arcade flight experience: pilot a paper plane through a
Gaussian-splat **Ancient Egyptian** world, glide past story characters, and
collect scorable props. Built with **Vite + TypeScript**, **three.js**, and
**[@sparkjsdev/spark](https://sparkjs.dev)** for real-time Gaussian-splat rendering.

## Experience flow

1. **Intro** — a cinematic video sets up the adventure.
2. **Onboarding** — explains steering (keyboard or hand-tracking) and boost.
3. **Start** — loads the Gaussian-splat world and drops you into flight.
4. **Play** — fly through the scene; touch the collidable props (cat, pyramid,
   vase) to score them. Reach every prop to win. Story characters (dad, child)
   play voiceover lines.

An **Admin** panel (⚙️) exposes free-cam, live model transforms, and spawn
tuning for editing the scene.

## Run

```bash
npm install
npm run dev        # local dev server (Vite)
npm run build      # type-check + production build to dist/
npm run preview    # serve the built dist/ locally
```

## Project structure

```text
index.html            # entry point
src/
  main.ts             # app: scene, flight, models, HUD, admin panel
  worlds.ts           # world/splat definitions (position, spawn, portal, bounds)
  captions.ts         # voiceover captions
  style.css
public/
  assets/
    worlds/           # Gaussian splat (.spz) + collider mesh (.glb)
    models/           # character & prop models (Draco + WebP compressed .glb)
    ui/               # images
    voiceovers/       # .mp3 narration
    *.mp4             # intro videos
  draco/              # Draco decoder (served locally, no CDN)
media-src/            # source media kept out of the shipped build
```

## 3D asset pipeline

Models are shipped as **Draco-compressed geometry + WebP textures** and decoded
in-browser via three.js `DRACOLoader` pointed at `/draco/`. This keeps large
meshes small over the wire (the character models compress from ~75 MB → ~6 MB
each with no topology loss).

To optimize a **new** `.glb` before adding it, using
[`@gltf-transform/cli`](https://gltf-transform.dev):

```bash
npx @gltf-transform/cli webp  input.glb  tmp.glb   # WebP textures first
npx @gltf-transform/cli draco tmp.glb   output.glb # Draco LAST (encodes on write)
```

> Order matters: Draco must be the final step, because `gltf-transform` applies
> Draco encoding at serialization time — running another transform afterward
> re-writes the mesh uncompressed.

Any model loaded through a `GLTFLoader` that lacks a `DRACOLoader` will fail to
open a Draco file, so make sure the loader has one wired up (see `src/main.ts`).

## Deploy (Netlify)

A [`netlify.toml`](netlify.toml) is included (build `npm run build`, publish
`dist/`). To deploy:

1. Push this branch and open a PR / merge to `main`.
2. In Netlify: **Add new site → Import an existing project → GitHub →
   `PaperTrail`**.
3. Netlify reads `netlify.toml` — just confirm and **Deploy**.

The built site is ~125 MB, dominated by the ~61 MB Gaussian-splat world
(`.spz`); everything is under Netlify's limits. For an even lighter first load,
the `.spz` could be regenerated with fewer splats, but that trades visual
fidelity.
