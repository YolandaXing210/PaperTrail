import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SparkRenderer, SplatMesh, SplatFileType } from "@sparkjsdev/spark";
import { WORLDS, type WorldConfig } from "./worlds";
import { CAPTION_SCRIPT, CaptionPlayer } from "./captions";

type ExperiencePhase = "intro" | "onboarding" | "loading" | "playing";

// --- IndexedDB Storage Helper for Custom Worlds ---
const DB_NAME = "SplatwingDB";
const DB_VERSION = 1;
const STORE_NAME = "customWorlds";

export interface CustomWorldConfig extends WorldConfig {
  blob: Blob;
  timestamp: number;
  fileType?: string;
}

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveCustomWorld(world: CustomWorldConfig): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(world);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function getCustomWorlds(): Promise<CustomWorldConfig[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function deleteCustomWorld(id: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <section id="intro" class="experience-screen intro-screen">
    <div style="position: absolute; top: 22px; left: 22px; z-index: 10;">
      <button class="admin-btn">⚙️ Admin</button>
    </div>
    <div class="intro-glow"></div>
    <div class="intro-plane" aria-hidden="true">
      <div class="plane-art"></div>
      <div class="flight-line flight-line-one"></div>
      <div class="flight-line flight-line-two"></div>
    </div>
    <div class="intro-copy">
      <div class="eyebrow">A Gaussian Splat Adventure</div>
      <h1>Fly across worlds<br/>built from memories.</h1>
      <p>Guide a tiny airplane through ancient Chinese and Japanese-inspired spaces reconstructed as Gaussian splats.</p>
      <button id="continue-button" class="primary-button">Continue</button>
    </div>
    <div class="intro-footer">Two worlds · One continuous flight</div>
  </section>

  <section id="onboarding" class="experience-screen onboarding-screen hidden-screen">
    <div style="position: absolute; top: 22px; left: 22px; z-index: 10;">
      <button class="admin-btn">⚙️ Admin</button>
    </div>
    <div class="onboarding-card">
      <div class="eyebrow">Flight briefing</div>
      <h2>Your adventure begins in the first memory world.</h2>
      <p>Steer through the environment, explore its details, and fly into the luminous portal to cross into the next culture.</p>
      <div class="control-briefing-wrapper" style="display: flex; gap: 32px; justify-content: center; align-items: center; margin: 20px auto 28px; flex-wrap: wrap;">
        <div class="key-layout" aria-label="WASD controls" style="margin: 0;">
          <div></div><div class="keycap">W<span>Up</span></div><div></div>
          <div class="keycap">A<span>Left</span></div><div class="keycap">S<span>Down</span></div><div class="keycap">D<span>Right</span></div>
        </div>
        <div class="space-layout" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div class="keycap" style="width: 180px; height: 50px; font-size: 16px;">Space Bar<span>Thrust</span></div>
          <div class="keycap" style="width: 180px; height: 50px; font-size: 16px;">Shift<span>Boost</span></div>
        </div>
      </div>
      <div class="briefing-grid">
        <div><strong>Thrust</strong><span>Hold Space to fly forward.</span></div>
        <div><strong>Steer</strong><span>Use WASD or Arrow keys to guide.</span></div>
        <div><strong>Transition</strong><span>Enter the portal to reach world two.</span></div>
      </div>
      <button id="start-button" class="primary-button">Start adventure</button>
    </div>
  </section>

  <div id="video-intro" class="video-intro hidden-screen">
    <video id="intro-video" playsinline preload="auto">
      <source src="/assets/VideoIntro.mp4" type="video/mp4" />
    </video>
    <button id="skip-video-btn" class="skip-video-btn">Skip intro ▸</button>
  </div>

  <div id="loader" class="loader hidden">
    <div class="loader-card">
      <div class="loader-ring"></div>
      <strong id="loader-title">Loading your first world</strong>
      <div id="loader-progress">Preparing flight...</div>
    </div>
  </div>

  <div id="transition" class="transition hidden"><span id="transition-name"></span></div>

  <div id="game-ui" class="game-ui hidden-ui">
    <div id="flight-crosshair" class="flight-crosshair">
      <div class="crosshair-ring"></div>
      <div class="crosshair-dot"></div>
      <svg class="crosshair-line-svg">
        <line id="crosshair-line" x1="0" y1="0" x2="0" y2="0" />
      </svg>
    </div>
    <div class="hud">
      <div class="topbar">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="brand">Splatwing</div>
          <button id="admin-toggle-btn" class="admin-btn">⚙️ Admin</button>
        </div>
        <div class="world-card">
          <strong id="world-name">World</strong>
          <span id="world-subtitle">Loading...</span>
        </div>
      </div>
      <div class="bottom">
        <div class="controls">
          <b>WASD / Arrows</b> steer &nbsp;·&nbsp; <b>Space</b> thrust &nbsp;·&nbsp; <b>Shift</b> boost<br/>
          Fly into the glowing portal to change worlds.
        </div>
        <div class="status">
          <small>Airspeed</small>
          <strong><span id="speed">0</span> km/h</strong>
          <em id="preload-status">World two queued</em>
        </div>
      </div>
    </div>
    <div class="mobile-controls">
      <div class="pad">
        <button class="up" data-key="ArrowUp">▲</button>
        <button class="left" data-key="ArrowLeft">◀</button>
        <button class="right" data-key="ArrowRight">▶</button>
        <button class="down" data-key="ArrowDown">▼</button>
      </div>
      <div class="actions">
        <button class="advance" data-key="Space">THRUST</button>
        <button class="boost" data-key="ShiftLeft">BOOST</button>
      </div>
    </div>
    <div id="caption-view" class="caption-view caption-hidden" aria-live="polite">
      <div class="caption-bubble">
        <span class="caption-speaker"></span>
        <p class="caption-text"></p>
      </div>
    </div>
  </div>

  <div id="admin-panel" class="admin-panel-overlay hidden-panel">
    <div class="admin-card">
      <div class="admin-header">
        <h2>Admin Control Center</h2>
        <button id="admin-close-btn" class="admin-close-btn">×</button>
      </div>

      <!-- Tabs Header -->
      <div class="admin-tabs">
        <button class="tab-btn active-tab" data-tab="tab-upload">Upload & Worlds</button>
        <button class="tab-btn" data-tab="tab-orient" id="tab-btn-orient">Splat Orientation</button>
        <button class="tab-btn" data-tab="tab-objects" id="tab-btn-objects">Scene Objects</button>
      </div>
      
      <div class="admin-body">
        <!-- Tab 1: Upload & Worlds -->
        <div id="tab-upload" class="tab-content">
          <!-- Portal Transitions Settings -->
          <div class="admin-section" style="margin-bottom: 16px;">
            <h3>Transitions Settings</h3>
            <label class="switch-label">
              <input type="checkbox" id="portal-transition-toggle" />
              <span>Enable Portals & Transitions</span>
            </label>
          </div>

          <!-- Active World Selector -->
          <div class="admin-section" style="margin-bottom: 16px;">
            <h3>Select Active World</h3>
            <select id="world-select-dropdown" class="admin-select"></select>
          </div>

          <!-- Custom PLY Upload Section -->
          <div class="admin-section">
            <h3>Upload Custom World (.ply, .spz)</h3>
            <div id="ply-dropzone" class="dropzone">
              <span class="dropzone-text" id="dropzone-label">Drag & drop your .ply or .spz here or <strong>click to browse</strong></span>
              <input type="file" id="ply-file-input" accept=".ply,.spz" style="display: none;" />
            </div>
            <div id="upload-status" class="upload-status"></div>
          </div>
        </div>

        <!-- Tab 2: Orientation & Properties -->
        <div id="tab-orient" class="tab-content hidden-tab-content">
          <div id="custom-world-properties" class="admin-section">
            <h3>Customize Custom World Settings</h3>
            
            <div class="form-row">
              <label>World Name</label>
              <input type="text" id="prop-name" />
            </div>

            <!-- Position Offset (Translate Splat) -->
            <div class="form-section-title">Splat Position Offset</div>
            <div class="form-grid">
              <div>
                <label>Position X</label>
                <input type="number" id="prop-pos-x" step="0.5" />
              </div>
              <div>
                <label>Position Y</label>
                <input type="number" id="prop-pos-y" step="0.5" />
              </div>
              <div>
                <label>Position Z</label>
                <input type="number" id="prop-pos-z" step="0.5" />
              </div>
            </div>

            <!-- Rotation Sliders -->
            <div class="form-section-title">Splat Rotation (Degrees)</div>
            
            <div class="form-row-slider">
              <div class="slider-label-row">
                <label>Pitch (Rotation X)</label>
                <span id="label-rot-x">0°</span>
              </div>
              <input type="range" id="prop-rot-x" min="-180" max="180" step="1" />
            </div>

            <div class="form-row-slider">
              <div class="slider-label-row">
                <label>Yaw (Rotation Y)</label>
                <span id="label-rot-y">0°</span>
              </div>
              <input type="range" id="prop-rot-y" min="-180" max="180" step="1" />
            </div>

            <div class="form-row-slider">
              <div class="slider-label-row">
                <label>Roll (Rotation Z)</label>
                <span id="label-rot-z">0°</span>
              </div>
              <input type="range" id="prop-rot-z" min="-180" max="180" step="1" />
            </div>

            <!-- Scale Slider -->
            <div class="form-row-slider" style="margin-top: 12px;">
              <div class="slider-label-row">
                <label>Scale</label>
                <span id="label-scale">4.0</span>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="range" id="prop-scale-slider" min="0.1" max="20" step="0.1" style="flex: 1;" />
                <input type="number" id="prop-scale" step="0.1" style="width: 70px;" />
              </div>
            </div>

            <!-- Airplane Spawn Point -->
            <div class="form-section-title" style="margin-top: 16px;">Airplane Spawn Point</div>
            <div class="form-grid">
              <div>
                <label>Spawn X</label>
                <input type="number" id="prop-spawn-x" step="0.5" />
              </div>
              <div>
                <label>Spawn Y</label>
                <input type="number" id="prop-spawn-y" step="0.5" />
              </div>
              <div>
                <label>Spawn Z</label>
                <input type="number" id="prop-spawn-z" step="0.5" />
              </div>
            </div>

            <!-- Target Object (Collectible Target) Placement -->
            <div class="form-section-title" style="margin-top: 16px;">Collectible Target Object Placement</div>
            <div class="form-grid">
              <div>
                <label>Object X</label>
                <input type="number" id="prop-obj-x" step="0.5" />
              </div>
              <div>
                <label>Object Y</label>
                <input type="number" id="prop-obj-y" step="0.5" />
              </div>
              <div>
                <label>Object Z</label>
                <input type="number" id="prop-obj-z" step="0.5" />
              </div>
            </div>
            <div class="form-row-slider" style="margin-top: 12px;">
              <div class="slider-label-row">
                <label>Object Scale</label>
                <span id="label-obj-scale">1.0</span>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="range" id="prop-obj-scale-slider" min="0.1" max="5.0" step="0.1" value="1.0" style="flex: 1;" />
                <input type="number" id="prop-obj-scale" step="0.1" value="1.0" style="width: 70px;" />
              </div>
            </div>

            <!-- Bounds Min -->
            <div class="form-section-title">Flight Boundaries Min</div>
            <div class="form-grid">
              <div>
                <label>Min X</label>
                <input type="number" id="prop-min-x" step="1" />
              </div>
              <div>
                <label>Min Y</label>
                <input type="number" id="prop-min-y" step="1" />
              </div>
              <div>
                <label>Min Z</label>
                <input type="number" id="prop-min-z" step="1" />
              </div>
            </div>

            <!-- Bounds Max -->
            <div class="form-section-title">Flight Boundaries Max</div>
            <div class="form-grid">
              <div>
                <label>Max X</label>
                <input type="number" id="prop-max-x" step="1" />
              </div>
              <div>
                <label>Max Y</label>
                <input type="number" id="prop-max-y" step="1" />
              </div>
              <div>
                <label>Max Z</label>
                <input type="number" id="prop-max-z" step="1" />
              </div>
            </div>

            <button id="save-properties-btn" class="admin-btn" style="margin-top: 16px; width: 100%; height: 44px; display: block; border-radius: 999px;">Save & Apply Settings</button>
            <button id="delete-world-btn" class="danger-button" style="margin-top: 8px; width: 100%; height: 44px; display: block; border-radius: 999px;">Delete World</button>
          </div>
          
          <div id="orient-fallback-msg" class="admin-section" style="text-align: center; color: rgba(255,255,255,0.6); padding: 24px;">
             Select a <strong>Custom World</strong> to customize its orientation and settings.
          </div>
        </div>

        <!-- Tab 3: Scene Objects (GLB models, free camera, transform gizmo) -->
        <div id="tab-objects" class="tab-content hidden-tab-content">
          <div class="admin-section" style="margin-bottom: 16px;">
            <h3>Camera</h3>
            <button id="freecam-toggle-btn" class="admin-btn" style="width:100%; height:44px; display:block; border-radius:999px;">🎥 Free Camera: OFF</button>
            <p class="admin-hint">Detaches the camera from the airplane. Fly with <b>W A S D</b>, ascend / descend with <b>↑ ↓</b>, turn with <b>← →</b>, hold <b>Shift</b> to move faster, and drag the mouse to look around. Close this panel to roam the scene.</p>
          </div>

          <div class="admin-section" style="margin-bottom: 16px;">
            <h3>Placed Models</h3>
            <div id="model-load-status" class="admin-hint">Models load when the world starts or when Free Camera is enabled.</div>
            <div id="model-select-list" class="model-select-list"></div>
            <p class="admin-hint">Pick a model here — or click it directly in the scene — then set its position, rotation, and scale below.</p>
          </div>

          <div class="admin-section" style="margin-bottom: 16px;">
            <h3>Transform <span id="selected-model-name" class="selected-model-name">— none selected —</span></h3>

            <div class="form-section-title">Position</div>
            <div class="form-grid">
              <div><label>X</label><input type="number" id="model-pos-x" step="0.25" /></div>
              <div><label>Y</label><input type="number" id="model-pos-y" step="0.25" /></div>
              <div><label>Z</label><input type="number" id="model-pos-z" step="0.25" /></div>
            </div>

            <div class="form-section-title">Rotation (degrees)</div>
            <div class="form-grid">
              <div><label>X</label><input type="number" id="model-rot-x" step="5" /></div>
              <div><label>Y</label><input type="number" id="model-rot-y" step="5" /></div>
              <div><label>Z</label><input type="number" id="model-rot-z" step="5" /></div>
            </div>

            <div class="form-row-slider" style="margin-top: 12px;">
              <div class="slider-label-row">
                <label>Scale</label>
                <span id="model-scale-label">1.0</span>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="range" id="model-scale-slider" min="0.05" max="20" step="0.05" style="flex: 1;" />
                <input type="number" id="model-scale" step="0.05" style="width: 72px;" />
              </div>
            </div>
          </div>

          <div class="admin-section">
            <h3>Coordinates</h3>
            <button id="copy-coords-btn" class="admin-btn" style="width:100%; height:44px; display:block; border-radius:999px;">📋 Copy Model Coordinates</button>
            <pre id="coords-readout" class="coords-readout">No models loaded yet.</pre>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="edit-hud" class="edit-hud">
    <strong>EDIT MODE — FREE CAMERA</strong>
    <span><b>W A S D</b> fly &nbsp;·&nbsp; <b>↑ ↓</b> up / down &nbsp;·&nbsp; <b>← →</b> turn &nbsp;·&nbsp; <b>Shift</b> faster &nbsp;·&nbsp; drag mouse to look</span>
    <span><b>Click</b> a model or press <b>1–4</b> to select &nbsp;·&nbsp; set position / rotation / scale in the panel &nbsp;·&nbsp; <b>C</b> copy coordinates</span>
  </div>
`;

const intro = document.querySelector<HTMLElement>("#intro")!;
const onboarding = document.querySelector<HTMLElement>("#onboarding")!;
const continueButton = document.querySelector<HTMLButtonElement>("#continue-button")!;
const startButton = document.querySelector<HTMLButtonElement>("#start-button")!;
const loader = document.querySelector<HTMLDivElement>("#loader")!;
const loaderProgress = document.querySelector<HTMLDivElement>("#loader-progress")!;
const transition = document.querySelector<HTMLDivElement>("#transition")!;
const transitionName = document.querySelector<HTMLSpanElement>("#transition-name")!;

// Admin panel selectors
// Only the "⚙️ Admin" opener buttons (intro / onboarding / HUD) should toggle the
// panel — not the .admin-btn styled buttons that live inside the panel itself
// (Save, Free Camera, gizmo modes, model pickers, Copy Coordinates).
const adminToggleBtns = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".admin-btn")
).filter((btn) => !btn.closest("#admin-panel"));
const adminPanel = document.querySelector<HTMLDivElement>("#admin-panel")!;
const adminCloseBtn = document.querySelector<HTMLButtonElement>("#admin-close-btn")!;
const portalTransitionToggle = document.querySelector<HTMLInputElement>("#portal-transition-toggle")!;
const worldSelectDropdown = document.querySelector<HTMLSelectElement>("#world-select-dropdown")!;
const plyDropzone = document.querySelector<HTMLDivElement>("#ply-dropzone")!;
const plyFileInput = document.querySelector<HTMLInputElement>("#ply-file-input")!;
const uploadStatus = document.querySelector<HTMLDivElement>("#upload-status")!;
const customWorldProperties = document.querySelector<HTMLDivElement>("#custom-world-properties")!;
const orientFallbackMsg = document.querySelector<HTMLDivElement>("#orient-fallback-msg")!;

const propName = document.querySelector<HTMLInputElement>("#prop-name")!;
const propScale = document.querySelector<HTMLInputElement>("#prop-scale")!;
const propScaleSlider = document.querySelector<HTMLInputElement>("#prop-scale-slider")!;
const labelScale = document.querySelector<HTMLSpanElement>("#label-scale")!;

const propPosX = document.querySelector<HTMLInputElement>("#prop-pos-x")!;
const propPosY = document.querySelector<HTMLInputElement>("#prop-pos-y")!;
const propPosZ = document.querySelector<HTMLInputElement>("#prop-pos-z")!;

const propRotX = document.querySelector<HTMLInputElement>("#prop-rot-x")!;
const propRotY = document.querySelector<HTMLInputElement>("#prop-rot-y")!;
const propRotZ = document.querySelector<HTMLInputElement>("#prop-rot-z")!;
const labelRotX = document.querySelector<HTMLSpanElement>("#label-rot-x")!;
const labelRotY = document.querySelector<HTMLSpanElement>("#label-rot-y")!;
const labelRotZ = document.querySelector<HTMLSpanElement>("#label-rot-z")!;

const propSpawnX = document.querySelector<HTMLInputElement>("#prop-spawn-x")!;
const propSpawnY = document.querySelector<HTMLInputElement>("#prop-spawn-y")!;
const propSpawnZ = document.querySelector<HTMLInputElement>("#prop-spawn-z")!;
const propObjX = document.querySelector<HTMLInputElement>("#prop-obj-x")!;
const propObjY = document.querySelector<HTMLInputElement>("#prop-obj-y")!;
const propObjZ = document.querySelector<HTMLInputElement>("#prop-obj-z")!;
const propObjScale = document.querySelector<HTMLInputElement>("#prop-obj-scale")!;
const propObjScaleSlider = document.querySelector<HTMLInputElement>("#prop-obj-scale-slider")!;
const labelObjScale = document.querySelector<HTMLSpanElement>("#label-obj-scale")!;
const propMinX = document.querySelector<HTMLInputElement>("#prop-min-x")!;
const propMinY = document.querySelector<HTMLInputElement>("#prop-min-y")!;
const propMinZ = document.querySelector<HTMLInputElement>("#prop-min-z")!;
const propMaxX = document.querySelector<HTMLInputElement>("#prop-max-x")!;
const propMaxY = document.querySelector<HTMLInputElement>("#prop-max-y")!;
const propMaxZ = document.querySelector<HTMLInputElement>("#prop-max-z")!;
const savePropertiesBtn = document.querySelector<HTMLButtonElement>("#save-properties-btn")!;
const deleteWorldBtn = document.querySelector<HTMLButtonElement>("#delete-world-btn")!;
const gameUi = document.querySelector<HTMLDivElement>("#game-ui")!;
const captionPlayer = new CaptionPlayer(document.querySelector<HTMLElement>("#caption-view")!);
let captionsStarted = false;
const worldName = document.querySelector<HTMLElement>("#world-name")!;
const worldSubtitle = document.querySelector<HTMLElement>("#world-subtitle")!;
const speedLabel = document.querySelector<HTMLElement>("#speed")!;
const preloadStatus = document.querySelector<HTMLElement>("#preload-status")!;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x07111f);
renderer.domElement.classList.add("game-canvas");
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07111f, 0.012);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 1000);
const spark = new SparkRenderer({ renderer });
scene.add(spark);
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const keyLight = new THREE.DirectionalLight(0xb7ddff, 3);
keyLight.position.set(4, 9, 5);
scene.add(keyLight);

function create3DAirplane(): THREE.Group {
  const airplaneGroup = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xe34332,
    roughness: 0.4,
    metalness: 0.2,
  });

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f8fb,
    roughness: 0.4,
    metalness: 0.1,
  });

  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x14233b,
    roughness: 0.1,
    metalness: 0.9,
  });

  const propellerMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.6,
  });

  // Fuselage (cylinder aligned on Z)
  const bodyGeom = new THREE.CylinderGeometry(0.22, 0.12, 2.2, 8);
  bodyGeom.rotateX(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  airplaneGroup.add(bodyMesh);

  // Main wing
  const wingGeom = new THREE.BoxGeometry(3.2, 0.06, 0.55);
  const wingMesh = new THREE.Mesh(wingGeom, wingMaterial);
  wingMesh.position.set(0, 0.05, -0.2);
  wingMesh.castShadow = true;
  airplaneGroup.add(wingMesh);

  // Wing tips (red accents)
  const tipGeom = new THREE.BoxGeometry(0.1, 0.08, 0.57);
  const leftTip = new THREE.Mesh(tipGeom, bodyMaterial);
  leftTip.position.set(1.6, 0.05, -0.2);
  const rightTip = new THREE.Mesh(tipGeom, bodyMaterial);
  rightTip.position.set(-1.6, 0.05, -0.2);
  airplaneGroup.add(leftTip, rightTip);

  // Tail horizontal
  const tailHorizGeom = new THREE.BoxGeometry(1.1, 0.04, 0.3);
  const tailHorizMesh = new THREE.Mesh(tailHorizGeom, wingMaterial);
  tailHorizMesh.position.set(0, 0.08, 0.85);
  tailHorizMesh.castShadow = true;
  airplaneGroup.add(tailHorizMesh);

  // Tail vertical
  const tailVertGeom = new THREE.BoxGeometry(0.04, 0.5, 0.3);
  const tailVertMesh = new THREE.Mesh(tailVertGeom, bodyMaterial);
  tailVertMesh.position.set(0, 0.3, 0.85);
  tailVertMesh.castShadow = true;
  airplaneGroup.add(tailVertMesh);

  // Cockpit dome
  const cockpitGeom = new THREE.SphereGeometry(0.16, 8, 8);
  cockpitGeom.scale(1, 1.1, 1.9);
  const cockpitMesh = new THREE.Mesh(cockpitGeom, cockpitMaterial);
  cockpitMesh.position.set(0, 0.18, -0.25);
  airplaneGroup.add(cockpitMesh);

  // Propeller group
  const propGroup = new THREE.Group();
  propGroup.name = "propeller";
  propGroup.position.set(0, 0, -1.11);

  const hubGeom = new THREE.SphereGeometry(0.09, 8, 8);
  const hubMesh = new THREE.Mesh(hubGeom, bodyMaterial);
  propGroup.add(hubMesh);

  const bladeGeom = new THREE.BoxGeometry(0.85, 0.06, 0.02);
  const bladeMesh = new THREE.Mesh(bladeGeom, propellerMaterial);
  propGroup.add(bladeMesh);

  airplaneGroup.add(propGroup);

  return airplaneGroup;
}

const plane = new THREE.Group();
const planeModel = new THREE.Group();
plane.add(planeModel);
plane.visible = false;
scene.add(plane);

// Show the procedural airplane instantly as a placeholder while the GLB streams in.
planeModel.add(create3DAirplane());

// Swap in the paper plane GLB once it finishes loading. The loaded model is
// recentered and normalized inside a pivot group so the per-frame roll/scale
// animation on `planeModel` keeps working unchanged.
new GLTFLoader().load(
  "/assets/paper_plane.glb",
  (gltf) => {
    const model = gltf.scene;

    // Recenter geometry at the origin so roll/pitch/yaw pivot about the plane's center.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));

    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const pivot = new THREE.Group();
    pivot.add(model);
    // Normalize footprint to match the previous airplane (~3.2 units across).
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    pivot.scale.setScalar(3.2 / maxDim);
    // Model is authored nose->+X, wings along Z. Flight-forward is -Z with wings
    // along X, so rotate +90deg about Y (nose +X -> -Z, wings +Z -> +X).
    pivot.rotation.y = Math.PI / 2;

    planeModel.clear(); // drop the placeholder airplane
    planeModel.add(pivot);
  },
  undefined,
  (err) => console.error("Failed to load paper_plane.glb", err)
);

const portalGroup = new THREE.Group();
const portalRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.4, 0.16, 16, 80),
  new THREE.MeshBasicMaterial({ color: 0x78d8ff, transparent: true, opacity: 0.94 })
);
const portalCore = new THREE.Mesh(
  new THREE.CircleGeometry(2.16, 64),
  new THREE.MeshBasicMaterial({ color: 0x7adfff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
);
portalGroup.add(portalRing, portalCore);
portalGroup.visible = false;
scene.add(portalGroup);

const stars = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0x86cfff, size: 0.05, transparent: true, opacity: 0.5 })
);
const starPositions = new Float32Array(900 * 3);
for (let i = 0; i < starPositions.length; i += 3) {
  starPositions[i] = (Math.random() - 0.5) * 110;
  starPositions[i + 1] = (Math.random() - 0.5) * 70;
  starPositions[i + 2] = (Math.random() - 0.5) * 110;
}
stars.geometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
scene.add(stars);

// Spawn Helper (Wireframe cyan sphere and direction cone)
const spawnHelper = new THREE.Group();
const spawnSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x00a8ff, wireframe: true, transparent: true, opacity: 0.7 })
);
const spawnCone = new THREE.Mesh(
  new THREE.ConeGeometry(0.3, 1.0, 8),
  new THREE.MeshBasicMaterial({ color: 0x00a8ff, wireframe: true, transparent: true, opacity: 0.9 })
);
spawnCone.rotation.x = -Math.PI / 2; // Point forward along -Z
spawnCone.position.z = -0.5;
spawnHelper.add(spawnSphere, spawnCone);
spawnHelper.visible = false;
scene.add(spawnHelper);

// Collectible Target Group (Rotating gold ring + core)
const objectTargetGroup = new THREE.Group();
const objectTargetRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.8, 0.15, 12, 48),
  new THREE.MeshBasicMaterial({ color: 0xffd700 })
);
const objectTargetCore = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.3),
  new THREE.MeshBasicMaterial({ color: 0xffaa00 })
);
objectTargetGroup.add(objectTargetRing, objectTargetCore);
objectTargetGroup.visible = false;
scene.add(objectTargetGroup);

// Synthesized audio chime effect using Web Audio API
function playCollectChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Chime note 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.4);
    
    // Chime note 2 (slightly delayed and higher pitch)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
    gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc2.start(audioCtx.currentTime + 0.12);
    osc2.stop(audioCtx.currentTime + 0.5);

    // Chime note 3 (even higher pitch)
    const osc3 = audioCtx.createOscillator();
    const gain3 = audioCtx.createGain();
    osc3.connect(gain3);
    gain3.connect(audioCtx.destination);
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5
    gain3.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.24);
    gain3.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    osc3.start(audioCtx.currentTime + 0.24);
    osc3.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.warn("AudioContext chime error: ", e);
  }
}

const keys = new Set<string>();
window.addEventListener("keydown", (event) => keys.add(event.code));
window.addEventListener("keyup", (event) => keys.delete(event.code));
document.querySelectorAll<HTMLElement>("[data-key]").forEach((button) => {
  const code = button.dataset.key!;
  const press = (event: Event) => { event.preventDefault(); keys.add(code); };
  const release = (event: Event) => { event.preventDefault(); keys.delete(code); };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

// Mouse coordinates (normalized [-1, 1])
let mouseX = 0;
let mouseY = 0;

// Camera orbit drag coordinates
let isDragging = false;
let orbitYaw = 0;
let orbitPitch = 0;
let prevPointerX = 0;
let prevPointerY = 0;

// Stable 3D flight angles
let planeYaw = Math.PI;
let planePitch = 0;

// Dynamic worlds lists & state
let activeWorldId = localStorage.getItem("activeWorldId") || "world-one";
let enableTransitions = localStorage.getItem("enableTransitions") !== "false";
let customWorldsList: CustomWorldConfig[] = [];
let activeBlobUrl: string | null = null;

async function loadWorldsList() {
  try {
    customWorldsList = await getCustomWorlds();
  } catch (e) {
    console.error("Failed loading custom worlds", e);
  }
}

function getCurrentWorldConfig(id: string): WorldConfig | null {
  const staticWorld = WORLDS.find(w => w.id === id);
  if (staticWorld) return staticWorld;
  const customWorld = customWorldsList.find(w => w.id === id);
  if (customWorld) return customWorld;
  return WORLDS[0];
}

function getSplatUrlForWorld(world: WorldConfig): string {
  const customWorld = customWorldsList.find(w => w.id === world.id);
  if (customWorld) {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
    }
    activeBlobUrl = URL.createObjectURL(customWorld.blob);
    return activeBlobUrl;
  }
  return world.splatUrl;
}

window.addEventListener("mousemove", (event) => {
  mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  mouseY = (event.clientY / window.innerHeight) * 2 - 1;
  mouseX = THREE.MathUtils.clamp(mouseX, -1, 1);
  mouseY = THREE.MathUtils.clamp(mouseY, -1, 1);
});

window.addEventListener("mouseleave", () => {
  mouseX = 0;
  mouseY = 0;
});

let adminOrbitYaw = 0;
let adminOrbitPitch = 0.2;
let adminOrbitDistance = 15.0;
let isTargetCollected = false;

window.addEventListener("pointerdown", (event) => {
  const target = event.target as HTMLElement;
  if (target && (target.closest("button") || target.closest(".hud") || target.closest(".mobile-controls") || target.closest("#admin-panel") || target.closest(".admin-tabs") || target.closest("#edit-hud"))) {
    return;
  }

  // In free-camera / edit mode a left click picks the model under the cursor
  // (which populates the transform fields) instead of starting a look-drag.
  if (freeCamEnabled && event.button === 0 && modelHolders.size > 0) {
    const rect = renderer.domElement.getBoundingClientRect();
    modelPointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    modelRaycaster.setFromCamera(modelPointer, camera);
    const hits = modelRaycaster.intersectObjects(Array.from(modelHolders), true);
    if (hits.length > 0) {
      const holder = findModelHolder(hits[0].object);
      const model = sceneModels.find((m) => m.holder === holder) ?? null;
      if (model) {
        selectModel(model);
        return; // don't start a look-drag on this click
      }
    }
  }

  isDragging = true;
  prevPointerX = event.clientX;
  prevPointerY = event.clientY;
});

window.addEventListener("pointermove", (event) => {
  if (!isDragging) return;

  const deltaX = event.clientX - prevPointerX;
  const deltaY = event.clientY - prevPointerY;
  prevPointerX = event.clientX;
  prevPointerY = event.clientY;

  // Free-camera look: drag rotates the detached camera's yaw / pitch.
  if (freeCamEnabled) {
    freeCam.yaw -= deltaX * 0.005;
    freeCam.pitch = THREE.MathUtils.clamp(freeCam.pitch - deltaY * 0.005, -1.4, 1.4);
    return;
  }

  const adminPanel = document.querySelector("#admin-panel");
  const isAdminPanelOpen = adminPanel && !adminPanel.classList.contains("hidden-panel");
  if (isAdminPanelOpen) {
    adminOrbitYaw -= deltaX * 0.006;
    adminOrbitPitch = THREE.MathUtils.clamp(adminOrbitPitch - deltaY * 0.006, -Math.PI / 2.1, Math.PI / 2.1);
  } else {
    orbitYaw -= deltaX * 0.004;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch - deltaY * 0.004, -Math.PI / 3.2, Math.PI / 3.2);
  }
});

const stopDragging = () => {
  isDragging = false;
};
window.addEventListener("pointerup", stopDragging);
window.addEventListener("pointercancel", stopDragging);
window.addEventListener("pointerleave", stopDragging);

window.addEventListener("wheel", (event) => {
  const adminPanel = document.querySelector("#admin-panel");
  const isAdminPanelOpen = adminPanel && !adminPanel.classList.contains("hidden-panel");
  if (isAdminPanelOpen) {
    adminOrbitDistance = THREE.MathUtils.clamp(adminOrbitDistance + event.deltaY * 0.015, 2.0, 60.0);
  }
}, { passive: true });

let phase: ExperiencePhase = "intro";
let activeWorldIndex = 0;
let activeSplat: SplatMesh | null = null;
let preloadedSplat: SplatMesh | null = null;
let preloadPromise: Promise<SplatMesh> | null = null;
let isTransitioning = false;
const velocity = new THREE.Vector3();
const desiredVelocity = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const clock = new THREE.Clock();

function setHud(world: WorldConfig) {
  worldName.textContent = world.name;
  worldSubtitle.textContent = world.subtitle;
}

function configureSplat(splat: SplatMesh, world: WorldConfig) {
  splat.position.set(...world.position);
  splat.rotation.set(...world.rotation);
  splat.scale.setScalar(world.scale);
}

function clampPlane(world: WorldConfig) {
  plane.position.x = THREE.MathUtils.clamp(plane.position.x, world.bounds.min[0], world.bounds.max[0]);
  plane.position.y = THREE.MathUtils.clamp(plane.position.y, world.bounds.min[1], world.bounds.max[1]);
}

function createSplat(world: WorldConfig, lowDetail: boolean, onProgress?: (event: ProgressEvent) => void) {
  const url = getSplatUrlForWorld(world);
  const customWorld = customWorldsList.find(w => w.id === world.id);
  const fileType = customWorld?.fileType;

  const splat = new SplatMesh({
    url: url,
    fileType: fileType as any,
    lod: true,
    enableLod: true,
    lodScale: lowDetail ? 0.25 : 1,
    onProgress
  });
  configureSplat(splat, world);
  return splat;
}

async function preloadSecondWorld() {
  if (!enableTransitions || activeWorldId !== "world-one" || preloadedSplat || preloadPromise) return;
  const world = WORLDS[1];
  preloadStatus.textContent = "Preloading world two · low LOD";

  const splat = createSplat(world, true, (event) => {
    if (event.lengthComputable && event.total > 0) {
      preloadStatus.textContent = `Preloading world two · ${Math.round((event.loaded / event.total) * 100)}%`;
    }
  });

  // Keep it in the scene graph for background initialization, but fully transparent.
  splat.opacity = 0;
  scene.add(splat);

  preloadPromise = splat.initialized.then(() => {
    preloadedSplat = splat;
    preloadStatus.textContent = "World two ready · low LOD";
    return splat;
  }).catch((error) => {
    scene.remove(splat);
    splat.dispose();
    preloadPromise = null;
    preloadStatus.textContent = "World two will load at portal";
    throw error;
  });

  try { await preloadPromise; } catch (error) { console.warn("Background preload failed", error); }
}

async function startAdventure() {
  if (phase !== "onboarding") return;
  phase = "loading";
  onboarding.classList.add("hidden-screen");
  loader.classList.remove("hidden");
  loaderProgress.textContent = "Downloading the Gaussian world...";

  await loadWorldsList();

  const world = getCurrentWorldConfig(activeWorldId) || WORLDS[0];
  const splat = createSplat(world, false, (event) => {
    if (event.lengthComputable && event.total > 0) {
      loaderProgress.textContent = `${Math.round((event.loaded / event.total) * 100)}% loaded`;
    } else {
      loaderProgress.textContent = "Streaming Gaussian data...";
    }
  });
  scene.add(splat);
  await splat.initialized;

  activeSplat = splat;
  plane.position.set(...world.spawn);
  plane.visible = true;
  portalGroup.position.set(...world.portal);
  portalGroup.visible = enableTransitions;
  velocity.set(0, 0, -3);
  planeYaw = Math.PI;
  planePitch = 0;
  plane.quaternion.setFromEuler(new THREE.Euler(0, planeYaw, 0));
  setHud(world);
  camera.position.copy(plane.position).add(new THREE.Vector3(0, 4.8, 10));
  camera.lookAt(plane.position);

  isTargetCollected = false;
  if (world.objectPos) {
    objectTargetGroup.position.set(...world.objectPos);
    objectTargetGroup.scale.setScalar(world.objectScale ?? 1.0);
    objectTargetGroup.visible = true;
  } else {
    objectTargetGroup.visible = false;
  }

  gameUi.classList.remove("hidden-ui");
  loader.classList.add("hidden");
  phase = "playing";

  // Roll the Dad/Uti story captions along the bottom of the screen, once, as
  // the flight begins. Voiced lines sync to their audio; the rest read at pace.
  if (!captionsStarted) {
    captionsStarted = true;
    void captionPlayer.play(CAPTION_SCRIPT);
  }

  // Populate the world with the placed GLB models (dad, child, cat, pyramid).
  void loadSceneModels();

  if (enableTransitions && activeWorldId === "world-one") {
    void preloadSecondWorld();
  }
}

async function activateWorldById(id: string) {
  if (isTransitioning) return;
  const adminPanel = document.querySelector("#admin-panel");
  const isAdminPanelOpen = adminPanel && !adminPanel.classList.contains("hidden-panel");
  if (phase !== "playing" && !isAdminPanelOpen) return;

  isTransitioning = true;
  activeWorldId = id;
  localStorage.setItem("activeWorldId", id);

  const world = getCurrentWorldConfig(id)!;
  if (phase === "playing") {
    transitionName.textContent = world.name;
    transition.classList.remove("hidden");
    await new Promise((resolve) => setTimeout(resolve, 480));
  }

  if (activeSplat) {
    scene.remove(activeSplat);
    activeSplat.dispose();
    activeSplat = null;
  }

  // Preloaded splat logic only applies if transition is active and target is default world two
  let nextSplat: SplatMesh;
  if (id === "world-two" && enableTransitions && (preloadedSplat || preloadPromise)) {
    nextSplat = preloadedSplat ?? await preloadPromise!;
    nextSplat.opacity = 1;
    nextSplat.lodScale = 1;
    preloadedSplat = null;
    preloadPromise = null;
    preloadStatus.textContent = "World two active";
  } else {
    nextSplat = createSplat(world, false);
    scene.add(nextSplat);
    await nextSplat.initialized;
  }

  activeSplat = nextSplat;
  plane.position.set(...world.spawn);
  velocity.set(0, 0, -3);
  planeYaw = Math.PI;
  planePitch = 0;
  plane.quaternion.setFromEuler(new THREE.Euler(0, planeYaw, 0));
  portalGroup.position.set(...world.portal);
  portalGroup.visible = enableTransitions;
  setHud(world);
  camera.position.copy(plane.position).add(new THREE.Vector3(0, 4.8, 10));
  camera.lookAt(plane.position);

  isTargetCollected = false;
  if (world.objectPos) {
    objectTargetGroup.position.set(...world.objectPos);
    objectTargetGroup.scale.setScalar(world.objectScale ?? 1.0);
    objectTargetGroup.visible = true;
  } else {
    objectTargetGroup.visible = false;
  }

  if (phase === "playing") {
    transition.classList.add("hidden");
  }
  isTransitioning = false;
}

function updatePlane(delta: number) {
  const adminPanel = document.querySelector("#admin-panel");
  const isAdminPanelOpen = adminPanel && !adminPanel.classList.contains("hidden-panel");

  if (isAdminPanelOpen) {
    const crosshair = document.querySelector<HTMLElement>("#flight-crosshair");
    if (crosshair) crosshair.style.display = "none";

    const propeller = planeModel.getObjectByName("propeller");
    if (propeller) {
      propeller.rotation.z += delta * 10;
    }

    const spawnX = parseFloat(propSpawnX.value) || 0;
    const spawnY = parseFloat(propSpawnY.value) || 0;
    const spawnZ = parseFloat(propSpawnZ.value) || 0;
    const spawnPos = new THREE.Vector3(spawnX, spawnY, spawnZ);

    spawnHelper.visible = true;
    spawnHelper.position.copy(spawnPos);

    const offset = new THREE.Vector3(
      Math.sin(adminOrbitYaw) * Math.cos(adminOrbitPitch),
      Math.sin(adminOrbitPitch),
      Math.cos(adminOrbitYaw) * Math.cos(adminOrbitPitch)
    ).multiplyScalar(adminOrbitDistance);

    camera.position.copy(spawnPos).add(offset);
    camera.lookAt(spawnPos);

    if (objectTargetGroup.visible) {
      objectTargetGroup.rotation.y += delta * 0.8;
      objectTargetGroup.rotation.x = Math.sin(performance.now() * 0.002) * 0.15;
    }
    return;
  }

  spawnHelper.visible = false;

  if (phase !== "playing" || isTransitioning) {
    const crosshair = document.querySelector<HTMLElement>("#flight-crosshair");
    if (crosshair) crosshair.style.display = "none";
    return;
  }
  const world = getCurrentWorldConfig(activeWorldId) || WORLDS[0];

  const horizontal = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const vertical = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const boosting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const advancing = keys.has("Space");

  // Spin propeller
  const propeller = planeModel.getObjectByName("propeller");
  if (propeller) {
    const spinSpeed = advancing ? (boosting ? 60 : 40) : 15;
    propeller.rotation.z += delta * spinSpeed;
  }

  // Calculate yaw and pitch steer rates from keyboard and mouse
  const yawSteer = -horizontal * 1.5 - mouseX * 2.2;
  const pitchSteer = vertical * 1.3 - mouseY * 1.8;

  planeYaw += yawSteer * delta;
  planePitch = THREE.MathUtils.clamp(planePitch + pitchSteer * delta, -Math.PI / 2.2, Math.PI / 2.2);

  // Apply quaternions to maintain local axes rotation stably
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), planeYaw);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), planePitch);
  plane.quaternion.copy(qYaw).multiply(qPitch);

  // Apply bank (roll) visually relative to yaw steering rate
  const targetRoll = yawSteer * 0.38;
  planeModel.rotation.z = THREE.MathUtils.lerp(planeModel.rotation.z, targetRoll, 1 - Math.exp(-8 * delta));

  // Determine flying velocity based on forward direction
  const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
  const speed = advancing ? (boosting ? 16 : 8.5) : 1.8;
  desiredVelocity.copy(forwardVec).multiplyScalar(speed);
  velocity.lerp(desiredVelocity, 1 - Math.exp(-4 * delta));
  
  plane.position.addScaledVector(velocity, delta);


  // Model scale animation (bobbing + speed warp)
  const bob = Math.sin(performance.now() * 0.004) * 0.03;
  const targetScale = 1.0 + (boosting && advancing ? 0.08 : 0) + bob;
  planeModel.scale.setScalar(targetScale);

  // Smooth decay of camera orbit when user stops dragging
  if (!isDragging) {
    orbitYaw = THREE.MathUtils.lerp(orbitYaw, 0, 1 - Math.exp(-2.5 * delta));
    orbitPitch = THREE.MathUtils.lerp(orbitPitch, 0, 1 - Math.exp(-2.5 * delta));
  }

  // Camera follow offset calculations
  const baseCamOffset = new THREE.Vector3(0, 1.8, 6.8);
  const orbitQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(orbitPitch, orbitYaw, 0, 'YXZ'));
  const cameraOffset = baseCamOffset.clone().applyQuaternion(orbitQuat).applyQuaternion(plane.quaternion);
  cameraTarget.copy(plane.position).add(cameraOffset);

  // Lerp camera to target follow position
  camera.position.lerp(cameraTarget, 1 - Math.exp(-4 * delta));

  // Look at target slightly offset vertically
  const cameraLookTarget = plane.position.clone().add(new THREE.Vector3(0, 0.4, 0).applyQuaternion(plane.quaternion));
  camera.lookAt(cameraLookTarget);

  // Airspeed using magnitude of full 3D velocity
  speedLabel.textContent = String(Math.round(velocity.length() * 21));

  // Portal interactions - active only if portal transitions enabled
  if (enableTransitions) {
    const portalDistance = plane.position.distanceTo(portalGroup.position);
    portalRing.material.opacity = THREE.MathUtils.clamp(1.25 - portalDistance / 24, 0.35, 1);
    portalGroup.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.04);

    if (portalDistance < 2.7) {
      const allIds = [...WORLDS.map(w => w.id), ...customWorldsList.map(w => w.id)];
      const currentIndex = allIds.indexOf(activeWorldId);
      const nextIndex = (currentIndex + 1) % allIds.length;
      void activateWorldById(allIds[nextIndex]);
    }
  }

  // Rotate and check target object
  if (objectTargetGroup.visible) {
    objectTargetGroup.rotation.y += delta * 0.8;
    objectTargetGroup.rotation.x = Math.sin(performance.now() * 0.002) * 0.15;

    const distanceToTarget = plane.position.distanceTo(objectTargetGroup.position);
    if (distanceToTarget < 2.0 && !isTargetCollected) {
      isTargetCollected = true;

      const controlsHUD = document.querySelector<HTMLElement>(".controls");
      if (controlsHUD) {
        const originalHTML = controlsHUD.innerHTML;
        controlsHUD.innerHTML = `<span style="color: #4caf50; font-weight: bold; font-size: 14px; text-shadow: 0 0 10px #4caf50;">★ TARGET COLLECTED +500 PTS ★</span>`;
        setTimeout(() => {
          controlsHUD.innerHTML = originalHTML;
        }, 3000);
      }

      let scaleTime = 0;
      const targetScale = objectTargetGroup.scale.x;
      const scaleInterval = setInterval(() => {
        scaleTime += 0.05;
        if (scaleTime >= 0.5) {
          objectTargetGroup.visible = false;
          clearInterval(scaleInterval);
        } else {
          objectTargetGroup.scale.setScalar(THREE.MathUtils.lerp(targetScale, 0, scaleTime / 0.5));
        }
      }, 50);

      playCollectChime();
    }
  }

  // Draw HUD aiming crosshair
  const crosshair = document.querySelector<HTMLElement>("#flight-crosshair");
  const crosshairDot = document.querySelector<HTMLElement>(".crosshair-dot");
  const crosshairLine = document.querySelector<SVGLineElement>("#crosshair-line");

  if (crosshair && crosshairDot && crosshairLine) {
    if (!isDragging) {
      crosshair.style.display = "block";
      
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const cursorX = centerX + mouseX * centerX;
      const cursorY = centerY + mouseY * centerY;

      crosshairDot.style.left = `${cursorX}px`;
      crosshairDot.style.top = `${cursorY}px`;

      crosshairLine.setAttribute("x1", String(centerX));
      crosshairLine.setAttribute("y1", String(centerY));
      crosshairLine.setAttribute("x2", String(cursorX));
      crosshairLine.setAttribute("y2", String(cursorY));
    } else {
      crosshair.style.display = "none";
    }
  }
}

continueButton.addEventListener("click", () => {
  if (phase !== "intro") return;
  phase = "onboarding";
  intro.classList.add("hidden-screen");
  onboarding.classList.remove("hidden-screen");
});
// Video intro: plays after the flight-briefing "direction" page and before the world loads.
const videoIntro = document.querySelector<HTMLDivElement>("#video-intro")!;
const introVideo = document.querySelector<HTMLVideoElement>("#intro-video")!;
const skipVideoBtn = document.querySelector<HTMLButtonElement>("#skip-video-btn")!;
let videoIntroDone = false;

function finishVideoIntro() {
  if (videoIntroDone) return;
  videoIntroDone = true;
  introVideo.pause();
  videoIntro.classList.add("hidden-screen");
  void startAdventure();
}

introVideo.addEventListener("ended", finishVideoIntro);
skipVideoBtn.addEventListener("click", finishVideoIntro);
// Fail-safe: if the video errors while it's on screen, don't strand the user — go to the world.
introVideo.addEventListener("error", () => {
  if (!videoIntro.classList.contains("hidden-screen")) finishVideoIntro();
});

startButton.addEventListener("click", () => {
  if (phase !== "onboarding") return;
  videoIntroDone = false;
  onboarding.classList.add("hidden-screen");
  videoIntro.classList.remove("hidden-screen");
  introVideo.currentTime = 0;
  // The click is a user gesture, so playback with audio is allowed here.
  const playAttempt = introVideo.play();
  if (playAttempt) playAttempt.catch(() => finishVideoIntro()); // autoplay/load blocked -> skip
});

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.04);

  // Advance the sit animations (dad / child) and any other model clips.
  for (const model of sceneModels) model.mixer?.update(delta);

  if (freeCamEnabled) {
    updateFreeCamera(delta);
  } else {
    updatePlane(delta);
  }
  if (enableTransitions) {
    portalRing.rotation.z += delta * 0.45;
    portalCore.rotation.z -= delta * 0.2;
  }
  stars.rotation.y += delta * 0.004;
  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
});

// --- Admin Panel Functionality Bindings ---
adminToggleBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const wasHidden = adminPanel.classList.contains("hidden-panel");
    adminPanel.classList.toggle("hidden-panel");
    keys.clear();
    
    if (wasHidden) {
      // Just opened the admin panel!
      // If the splat is not loaded yet, load it now so they can preview it!
      if (!activeSplat) {
        void activateWorldById(activeWorldId);
      }
      
      // Focus on the spawn helper
      const world = getCurrentWorldConfig(activeWorldId);
      if (world) {
        spawnHelper.position.set(...world.spawn);
        spawnHelper.visible = true;
      }
    } else {
      // Just closed the admin panel (using button toggle)
      if (phase !== "playing") {
        if (activeSplat) {
          scene.remove(activeSplat);
          activeSplat.dispose();
          activeSplat = null;
        }
        spawnHelper.visible = false;
        objectTargetGroup.visible = false;
      }
    }
  });
});

adminCloseBtn.addEventListener("click", () => {
  adminPanel.classList.add("hidden-panel");
  if (phase !== "playing") {
    if (activeSplat) {
      scene.remove(activeSplat);
      activeSplat.dispose();
      activeSplat = null;
    }
    spawnHelper.visible = false;
    objectTargetGroup.visible = false;
  }
});

portalTransitionToggle.addEventListener("change", () => {
  enableTransitions = portalTransitionToggle.checked;
  localStorage.setItem("enableTransitions", String(enableTransitions));
  portalGroup.visible = enableTransitions;
  
  const controlsHUD = document.querySelector<HTMLElement>(".controls");
  if (controlsHUD) {
    controlsHUD.innerHTML = enableTransitions
      ? `<b>WASD / Arrows</b> steer &nbsp;·&nbsp; <b>Space</b> thrust &nbsp;·&nbsp; <b>Shift</b> boost<br/>Fly into the glowing portal to change worlds.`
      : `<b>WASD / Arrows</b> steer &nbsp;·&nbsp; <b>Space</b> thrust &nbsp;·&nbsp; <b>Shift</b> boost<br/>Single world mode (Portals disabled).`;
  }
});

function populateWorldDropdown() {
  worldSelectDropdown.innerHTML = "";
  
  WORLDS.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (Default)`;
    worldSelectDropdown.appendChild(opt);
  });
  
  customWorldsList.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (Custom)`;
    worldSelectDropdown.appendChild(opt);
  });
  
  worldSelectDropdown.value = activeWorldId;
}

function onWorldSelectChanged(id: string) {
  activeWorldId = id;
  localStorage.setItem("activeWorldId", id);
  
  const world = getCurrentWorldConfig(id);
  if (world) {
    const isCustom = customWorldsList.some(w => w.id === id);
    if (isCustom) {
      customWorldProperties.classList.remove("hidden-section-ui");
      orientFallbackMsg.classList.add("hidden-section-ui");
      
      propName.value = world.name;
      propScale.value = String(world.scale);
      propScaleSlider.value = String(world.scale);
      labelScale.textContent = world.scale.toFixed(1);
      
      // Radians to degrees
      const rotXDeg = Math.round((world.rotation?.[0] ?? Math.PI) * 180 / Math.PI);
      const rotYDeg = Math.round((world.rotation?.[1] ?? 0) * 180 / Math.PI);
      const rotZDeg = Math.round((world.rotation?.[2] ?? 0) * 180 / Math.PI);
      
      propRotX.value = String(rotXDeg);
      labelRotX.textContent = `${rotXDeg}°`;
      
      propRotY.value = String(rotYDeg);
      labelRotY.textContent = `${rotYDeg}°`;
      
      propRotZ.value = String(rotZDeg);
      labelRotZ.textContent = `${rotZDeg}°`;
      
      propPosX.value = String(world.position?.[0] ?? 0);
      propPosY.value = String(world.position?.[1] ?? -2.2);
      propPosZ.value = String(world.position?.[2] ?? -12);
      
      propSpawnX.value = String(world.spawn[0]);
      propSpawnY.value = String(world.spawn[1]);
      propSpawnZ.value = String(world.spawn[2]);
      propMinX.value = String(world.bounds.min[0]);
      propMinY.value = String(world.bounds.min[1]);
      propMinZ.value = String(world.bounds.min[2]);
      propMaxX.value = String(world.bounds.max[0]);
      propMaxY.value = String(world.bounds.max[1]);
      propMaxZ.value = String(world.bounds.max[2]);
    } else {
      customWorldProperties.classList.add("hidden-section-ui");
      orientFallbackMsg.classList.remove("hidden-section-ui");
    }
    
    if (phase === "playing" && !isTransitioning) {
      void activateWorldById(id);
    }
  }
}

worldSelectDropdown.addEventListener("change", () => {
  onWorldSelectChanged(worldSelectDropdown.value);
});

savePropertiesBtn.addEventListener("click", async () => {
  const id = worldSelectDropdown.value;
  const customIndex = customWorldsList.findIndex(w => w.id === id);
  if (customIndex !== -1) {
    const customWorld = customWorldsList[customIndex];
    customWorld.name = propName.value;
    customWorld.scale = parseFloat(propScale.value) || 4;
    
    // Save rotation in radians
    const rotX = (parseFloat(propRotX.value) || 0) * Math.PI / 180;
    const rotY = (parseFloat(propRotY.value) || 0) * Math.PI / 180;
    const rotZ = (parseFloat(propRotZ.value) || 0) * Math.PI / 180;
    customWorld.rotation = [rotX, rotY, rotZ];
    
    // Save position offsets
    customWorld.position = [
      parseFloat(propPosX.value) || 0,
      parseFloat(propPosY.value) || -2.2,
      parseFloat(propPosZ.value) || -12
    ];
    
    customWorld.spawn = [
      parseFloat(propSpawnX.value) || 0,
      parseFloat(propSpawnY.value) || 1.2,
      parseFloat(propSpawnZ.value) || 6
    ];
    customWorld.bounds = {
      min: [
        parseFloat(propMinX.value) || -40,
        parseFloat(propMinY.value) || -10,
        parseFloat(propMinZ.value) || -50
      ],
      max: [
        parseFloat(propMaxX.value) || 40,
        parseFloat(propMaxY.value) || 30,
        parseFloat(propMaxZ.value) || 30
      ]
    };
    
    await saveCustomWorld(customWorld);
    await loadWorldsList();
    populateWorldDropdown();
    
    if (phase === "playing" && !isTransitioning) {
      void activateWorldById(id);
    }
    
    uploadStatus.textContent = "Settings updated & loaded!";
    uploadStatus.style.color = "#4caf50";
    setTimeout(() => { uploadStatus.textContent = ""; }, 3000);
  }
});

deleteWorldBtn.addEventListener("click", async () => {
  const id = worldSelectDropdown.value;
  const customIndex = customWorldsList.findIndex(w => w.id === id);
  if (customIndex !== -1 && confirm("Are you sure you want to delete this custom world?")) {
    await deleteCustomWorld(id);
    await loadWorldsList();
    
    activeWorldId = "world-one";
    localStorage.setItem("activeWorldId", "world-one");
    populateWorldDropdown();
    onWorldSelectChanged("world-one");
    
    uploadStatus.textContent = "Custom world deleted.";
    uploadStatus.style.color = "#ff6b6b";
    setTimeout(() => { uploadStatus.textContent = ""; }, 3000);
  }
});

// Dropzone file handling
plyDropzone.addEventListener("click", () => plyFileInput.click());
plyDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  plyDropzone.classList.add("dragover");
});
plyDropzone.addEventListener("dragleave", () => {
  plyDropzone.classList.remove("dragover");
});
plyDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  plyDropzone.classList.remove("dragover");
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    void handleFileSelect(e.dataTransfer.files[0]);
  }
});
plyFileInput.addEventListener("change", () => {
  if (plyFileInput.files && plyFileInput.files.length > 0) {
    void handleFileSelect(plyFileInput.files[0]);
  }
});

async function handleFileSelect(file: File) {
  const ext = file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase();
  if (ext !== "ply" && ext !== "spz") {
    uploadStatus.textContent = "Error: File must be a .ply or .spz Gaussian Splat file.";
    uploadStatus.style.color = "#ff6b6b";
    return;
  }
  uploadStatus.textContent = "Uploading splat locally...";
  uploadStatus.style.color = "#82dcff";
  
  try {
    const id = "custom-" + Date.now();
    const name = file.name.replace(/\.(ply|spz)$/i, "");
    const blob = file;
    
    const newWorld: CustomWorldConfig = {
      id,
      name,
      subtitle: "Custom local splat world",
      splatUrl: "",
      position: [0, -2.2, -12],
      rotation: [Math.PI, 0, 0],
      scale: 4,
      spawn: [0, 1.2, 6],
      portal: [0, 3, -18],
      bounds: {
        min: [-40, -10, -50],
        max: [40, 30, 30]
      },
      blob,
      timestamp: Date.now(),
      fileType: ext === "spz" ? SplatFileType.SPZ : SplatFileType.PLY
    };
    
    await saveCustomWorld(newWorld);
    await loadWorldsList();
    populateWorldDropdown();
    
    worldSelectDropdown.value = id;
    onWorldSelectChanged(id);
    
    uploadStatus.textContent = "World uploaded successfully and loaded!";
    uploadStatus.style.color = "#4caf50";
    setTimeout(() => { uploadStatus.textContent = ""; }, 3000);
  } catch (err) {
    console.error(err);
    uploadStatus.textContent = "Error saving file locally.";
    uploadStatus.style.color = "#ff6b6b";
  }
}

// Initial Admin panel setup on startup
async function setupAdminPanel() {
  await loadWorldsList();
  populateWorldDropdown();
  portalTransitionToggle.checked = enableTransitions;
  
  const controlsHUD = document.querySelector<HTMLElement>(".controls");
  if (controlsHUD) {
    controlsHUD.innerHTML = enableTransitions
      ? `<b>WASD / Arrows</b> steer &nbsp;·&nbsp; <b>Space</b> thrust &nbsp;·&nbsp; <b>Shift</b> boost<br/>Fly into the glowing portal to change worlds.`
      : `<b>WASD / Arrows</b> steer &nbsp;·&nbsp; <b>Space</b> thrust &nbsp;·&nbsp; <b>Shift</b> boost<br/>Single world mode (Portals disabled).`;
  }
  
  const isCustom = customWorldsList.some(w => w.id === activeWorldId);
  if (isCustom) {
    onWorldSelectChanged(activeWorldId);
  }
}

// --- Tabs and Real-time Orientation Logic Bindings ---
const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const tabContents = document.querySelectorAll<HTMLDivElement>(".tab-content");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.remove("active-tab"));
    btn.classList.add("active-tab");
    
    tabContents.forEach(content => {
      if (content.id === tabId) {
        content.classList.remove("hidden-tab-content");
      } else {
        content.classList.add("hidden-tab-content");
      }
    });
  });
});

function updateSplatRealtime() {
  if (activeSplat) {
    const scaleVal = parseFloat(propScale.value) || 4;
    const rotXRad = (parseFloat(propRotX.value) || 0) * Math.PI / 180;
    const rotYRad = (parseFloat(propRotY.value) || 0) * Math.PI / 180;
    const rotZRad = (parseFloat(propRotZ.value) || 0) * Math.PI / 180;
    const posX = parseFloat(propPosX.value) || 0;
    const posY = parseFloat(propPosY.value) || -2.2;
    const posZ = parseFloat(propPosZ.value) || -12;
    
    activeSplat.scale.setScalar(scaleVal);
    activeSplat.rotation.set(rotXRad, rotYRad, rotZRad);
    activeSplat.position.set(posX, posY, posZ);
  }

  // Update spawnHelper position
  const spawnX = parseFloat(propSpawnX.value) || 0;
  const spawnY = parseFloat(propSpawnY.value) || 0;
  const spawnZ = parseFloat(propSpawnZ.value) || 0;
  spawnHelper.position.set(spawnX, spawnY, spawnZ);

  // Update object target position and scale
  const objX = parseFloat(propObjX.value) || 0;
  const objY = parseFloat(propObjY.value) || 0;
  const objZ = parseFloat(propObjZ.value) || 0;
  const objScale = parseFloat(propObjScale.value) || 1.0;
  objectTargetGroup.position.set(objX, objY, objZ);
  objectTargetGroup.scale.setScalar(objScale);
  objectTargetGroup.visible = true;
}

// Sync Scale input and slider
propScaleSlider.addEventListener("input", () => {
  propScale.value = propScaleSlider.value;
  labelScale.textContent = parseFloat(propScaleSlider.value).toFixed(1);
  updateSplatRealtime();
});

propScale.addEventListener("input", () => {
  propScaleSlider.value = propScale.value;
  labelScale.textContent = (parseFloat(propScale.value) || 1).toFixed(1);
  updateSplatRealtime();
});

// Sync Rotation sliders & labels
propRotX.addEventListener("input", () => {
  labelRotX.textContent = `${propRotX.value}°`;
  updateSplatRealtime();
});
propRotY.addEventListener("input", () => {
  labelRotY.textContent = `${propRotY.value}°`;
  updateSplatRealtime();
});
propRotZ.addEventListener("input", () => {
  labelRotZ.textContent = `${propRotZ.value}°`;
  updateSplatRealtime();
});

// Sync Position offsets
propPosX.addEventListener("input", updateSplatRealtime);
propPosY.addEventListener("input", updateSplatRealtime);
propPosZ.addEventListener("input", updateSplatRealtime);

// Sync Spawn inputs
propSpawnX.addEventListener("input", updateSplatRealtime);
propSpawnY.addEventListener("input", updateSplatRealtime);
propSpawnZ.addEventListener("input", updateSplatRealtime);

// Sync Target Object inputs and sliders
propObjScaleSlider.addEventListener("input", () => {
  propObjScale.value = propObjScaleSlider.value;
  labelObjScale.textContent = parseFloat(propObjScaleSlider.value).toFixed(1);
  updateSplatRealtime();
});
propObjScale.addEventListener("input", () => {
  propObjScaleSlider.value = propObjScale.value;
  labelObjScale.textContent = (parseFloat(propObjScale.value) || 1.0).toFixed(1);
  updateSplatRealtime();
});
propObjX.addEventListener("input", updateSplatRealtime);
propObjY.addEventListener("input", updateSplatRealtime);
propObjZ.addEventListener("input", updateSplatRealtime);

// ============================================================
// Scene Objects — GLB models, free-fly camera, and transform gizmo.
// Loads the cat / child / dad / pyramid models, lets you fly a detached
// camera to inspect them, drag a gizmo to place them, and copy the
// resulting coordinates to the clipboard.
// ============================================================

type SceneModel = {
  name: string;
  label: string;
  holder: THREE.Group;
  mixer: THREE.AnimationMixer | null;
};

type ModelDef = {
  name: string;
  label: string;
  url: string;
  pos: [number, number, number];
  target: number; // normalized max dimension, in world units
  sit: boolean;
};

const MODEL_DEFS: ModelDef[] = [
  { name: "dad",     label: "Dad",     url: "/assets/models/dad.glb",     pos: [-4.5, 0, -5], target: 3.4, sit: true },
  { name: "child",   label: "Child",   url: "/assets/models/child.glb",   pos: [-2, 0, -5],   target: 2.8, sit: true },
  { name: "cat",     label: "Cat",     url: "/assets/models/cat.glb",     pos: [2.5, 0, -4],  target: 2.2, sit: false },
  { name: "pyramid", label: "Pyramid", url: "/assets/models/pyramid.glb", pos: [0, 0, -12],   target: 7.0, sit: false },
];

const sceneModels: SceneModel[] = [];
const modelHolders = new Set<THREE.Object3D>();
const modelLoader = new GLTFLoader();
const modelRaycaster = new THREE.Raycaster();
const modelPointer = new THREE.Vector2();
let modelsLoadRequested = false;
let selectedModel: SceneModel | null = null;

// Scene Objects tab controls
const freeCamToggleBtn = document.querySelector<HTMLButtonElement>("#freecam-toggle-btn");
const modelPosX = document.querySelector<HTMLInputElement>("#model-pos-x");
const modelPosY = document.querySelector<HTMLInputElement>("#model-pos-y");
const modelPosZ = document.querySelector<HTMLInputElement>("#model-pos-z");
const modelRotX = document.querySelector<HTMLInputElement>("#model-rot-x");
const modelRotY = document.querySelector<HTMLInputElement>("#model-rot-y");
const modelRotZ = document.querySelector<HTMLInputElement>("#model-rot-z");
const modelScaleInput = document.querySelector<HTMLInputElement>("#model-scale");
const modelScaleSlider = document.querySelector<HTMLInputElement>("#model-scale-slider");
const modelScaleLabel = document.querySelector<HTMLSpanElement>("#model-scale-label");
const selectedModelName = document.querySelector<HTMLSpanElement>("#selected-model-name");
const modelSelectList = document.querySelector<HTMLDivElement>("#model-select-list");
const copyCoordsBtn = document.querySelector<HTMLButtonElement>("#copy-coords-btn");
const coordsReadout = document.querySelector<HTMLPreElement>("#coords-readout");
const modelLoadStatus = document.querySelector<HTMLDivElement>("#model-load-status");
const editHud = document.querySelector<HTMLDivElement>("#edit-hud");

function findModelHolder(obj: THREE.Object3D | null): THREE.Object3D | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (modelHolders.has(current)) return current;
    current = current.parent;
  }
  return null;
}

function setModelStatus(msg: string) {
  if (modelLoadStatus) modelLoadStatus.textContent = msg;
}

async function loadSceneModels() {
  if (modelsLoadRequested) return;
  modelsLoadRequested = true;
  setModelStatus("Loading scene models… these are large files, please wait.");

  for (const def of MODEL_DEFS) {
    try {
      setModelStatus(`Loading ${def.label}…`);
      const gltf = await modelLoader.loadAsync(def.url);
      const root = gltf.scene;

      // Recenter on the bounding-box center and normalize the size so every
      // model is visible regardless of its native scale/units.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      const holder = new THREE.Group();
      holder.name = `model-${def.name}`;
      holder.add(root);
      holder.position.set(...def.pos);
      holder.scale.setScalar(def.target / maxDim);
      scene.add(holder);
      modelHolders.add(holder);

      // Dad and child ship with a single "sit" clip (Blender exports it as
      // "NlaTrack"); play it. Others have no animation.
      let mixer: THREE.AnimationMixer | null = null;
      if (def.sit && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(root);
        const sitClip = gltf.animations.find((c) => /sit/i.test(c.name)) ?? gltf.animations[0];
        mixer.clipAction(sitClip).play();
      }

      sceneModels.push({ name: def.name, label: def.label, holder, mixer });
      refreshModelButtons();
      updateCoordsReadout();
    } catch (err) {
      console.error(`Failed to load model "${def.name}"`, err);
      setModelStatus(`Failed to load ${def.label} (see console).`);
    }
  }
  setModelStatus(`Loaded ${sceneModels.length} / ${MODEL_DEFS.length} models. Click one to edit.`);
}

function refreshModelButtons() {
  if (!modelSelectList) return;
  modelSelectList.innerHTML = "";
  for (const model of sceneModels) {
    const btn = document.createElement("button");
    btn.className = "admin-btn model-pick-btn" + (selectedModel === model ? " active-toggle" : "");
    btn.textContent = model.label;
    btn.addEventListener("click", () => selectModel(selectedModel === model ? null : model));
    modelSelectList.appendChild(btn);
  }
}

function selectModel(model: SceneModel | null) {
  selectedModel = model;
  populateTransformFields();
  refreshModelButtons();
  updateCoordsReadout();
}

// Fill the panel's numeric fields from the selected model's current transform.
function populateTransformFields() {
  const m = selectedModel;
  if (selectedModelName) selectedModelName.textContent = m ? m.label : "— none selected —";

  if (!m) {
    for (const el of [modelPosX, modelPosY, modelPosZ, modelRotX, modelRotY, modelRotZ, modelScaleInput, modelScaleSlider]) {
      if (el) el.value = "";
    }
    if (modelScaleLabel) modelScaleLabel.textContent = "—";
    return;
  }

  const setVal = (el: HTMLInputElement | null, v: number) => { if (el) el.value = String(round(v, 3)); };
  setVal(modelPosX, m.holder.position.x);
  setVal(modelPosY, m.holder.position.y);
  setVal(modelPosZ, m.holder.position.z);
  setVal(modelRotX, THREE.MathUtils.radToDeg(m.holder.rotation.x));
  setVal(modelRotY, THREE.MathUtils.radToDeg(m.holder.rotation.y));
  setVal(modelRotZ, THREE.MathUtils.radToDeg(m.holder.rotation.z));
  setVal(modelScaleInput, m.holder.scale.x);
  setVal(modelScaleSlider, m.holder.scale.x);
  if (modelScaleLabel) modelScaleLabel.textContent = String(round(m.holder.scale.x, 3));
}

// Apply the panel's numeric fields onto the selected model.
function applyTransformFromFields() {
  const m = selectedModel;
  if (!m) return;
  const num = (el: HTMLInputElement | null, fallback: number) => {
    const v = el ? parseFloat(el.value) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };
  m.holder.position.set(
    num(modelPosX, m.holder.position.x),
    num(modelPosY, m.holder.position.y),
    num(modelPosZ, m.holder.position.z)
  );
  m.holder.rotation.set(
    THREE.MathUtils.degToRad(num(modelRotX, 0)),
    THREE.MathUtils.degToRad(num(modelRotY, 0)),
    THREE.MathUtils.degToRad(num(modelRotZ, 0))
  );
  const s = num(modelScaleInput, m.holder.scale.x);
  if (s > 0) m.holder.scale.setScalar(s);
  updateCoordsReadout();
}

// --- Coordinate reporting ---
function round(v: number, p = 2): number {
  const f = 10 ** p;
  return Math.round(v * f) / f;
}

function buildCoordsText(): string {
  if (sceneModels.length === 0) return "No models loaded yet.";
  const deg = (v: number) => round(THREE.MathUtils.radToDeg(v), 1);
  const lines = sceneModels.map((m) => {
    const p = m.holder.position;
    const r = m.holder.rotation;
    const s = m.holder.scale;
    return `${m.name.padEnd(8)} pos [${round(p.x)}, ${round(p.y)}, ${round(p.z)}]  rotDeg [${deg(r.x)}, ${deg(r.y)}, ${deg(r.z)}]  scale [${round(s.x, 3)}, ${round(s.y, 3)}, ${round(s.z, 3)}]`;
  });
  const obj: Record<string, unknown> = {};
  for (const m of sceneModels) {
    obj[m.name] = {
      position: [round(m.holder.position.x, 3), round(m.holder.position.y, 3), round(m.holder.position.z, 3)],
      rotationDeg: [deg(m.holder.rotation.x), deg(m.holder.rotation.y), deg(m.holder.rotation.z)],
      scale: [round(m.holder.scale.x, 4), round(m.holder.scale.y, 4), round(m.holder.scale.z, 4)],
    };
  }
  return (
    "PaperTrail — scene model transforms\n" +
    "(each model is auto-centered on its bounding box, then this transform is applied)\n\n" +
    lines.join("\n") +
    "\n\nJSON:\n" +
    JSON.stringify(obj, null, 2)
  );
}

function updateCoordsReadout() {
  if (coordsReadout) coordsReadout.textContent = buildCoordsText();
}

async function copyCoords() {
  const text = buildCoordsText();
  const flash = (msg: string) => {
    if (!copyCoordsBtn) return;
    const original = copyCoordsBtn.textContent;
    copyCoordsBtn.textContent = msg;
    setTimeout(() => { copyCoordsBtn.textContent = original; }, 1600);
  };
  try {
    await navigator.clipboard.writeText(text);
    flash("✅ Copied to clipboard!");
  } catch {
    // Fallback for contexts without the async clipboard API.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    flash(ok ? "✅ Copied!" : "Copy failed — select the text below");
  }
}

// --- Free-fly camera ---
let freeCamEnabled = false;
const freeCam = {
  position: new THREE.Vector3(0, 3, 12),
  yaw: Math.PI,
  pitch: 0,
};

function setFreeCam(enabled: boolean) {
  freeCamEnabled = enabled;
  if (freeCamToggleBtn) {
    freeCamToggleBtn.textContent = enabled ? "🎥 Free Camera: ON" : "🎥 Free Camera: OFF";
    freeCamToggleBtn.classList.toggle("active-toggle", enabled);
  }
  editHud?.classList.toggle("active", enabled);

  if (enabled) {
    // Seed the free camera from wherever the follow camera currently is.
    freeCam.position.copy(camera.position);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    freeCam.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    freeCam.yaw = Math.atan2(-dir.x, -dir.z);
    void loadSceneModels();
  } else {
    selectModel(null);
  }
}

function updateFreeCamera(delta: number) {
  spawnHelper.visible = false;
  const crosshair = document.querySelector<HTMLElement>("#flight-crosshair");
  if (crosshair) crosshair.style.display = "none";

  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = (boost ? 26 : 10) * delta;
  const turn = 1.6 * delta;

  if (keys.has("ArrowLeft")) freeCam.yaw += turn;
  if (keys.has("ArrowRight")) freeCam.yaw -= turn;

  camera.quaternion.setFromEuler(new THREE.Euler(freeCam.pitch, freeCam.yaw, 0, "YXZ"));

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const move = new THREE.Vector3();
  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.sub(forward);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);
  if (keys.has("ArrowUp")) move.y += 1;
  if (keys.has("ArrowDown")) move.y -= 1;
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    freeCam.position.add(move);
  }
  camera.position.copy(freeCam.position);

  if (objectTargetGroup.visible) objectTargetGroup.rotation.y += delta * 0.8;
}

// --- Wire up the Scene Objects controls ---
freeCamToggleBtn?.addEventListener("click", () => setFreeCam(!freeCamEnabled));
copyCoordsBtn?.addEventListener("click", () => void copyCoords());

// Live-apply the numeric position / rotation fields to the selected model.
for (const el of [modelPosX, modelPosY, modelPosZ, modelRotX, modelRotY, modelRotZ]) {
  el?.addEventListener("input", applyTransformFromFields);
}
// Keep the scale number box and slider in sync, and apply live.
modelScaleInput?.addEventListener("input", () => {
  if (modelScaleSlider) modelScaleSlider.value = modelScaleInput.value;
  if (modelScaleLabel) modelScaleLabel.textContent = String(parseFloat(modelScaleInput.value) || 0);
  applyTransformFromFields();
});
modelScaleSlider?.addEventListener("input", () => {
  if (modelScaleInput) modelScaleInput.value = modelScaleSlider.value;
  if (modelScaleLabel) modelScaleLabel.textContent = String(parseFloat(modelScaleSlider.value) || 0);
  applyTransformFromFields();
});

// Keyboard shortcuts, active only while free-camera / edit mode is on.
window.addEventListener("keydown", (event) => {
  if (!freeCamEnabled) return;
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  switch (event.code) {
    case "KeyC": void copyCoords(); break;
    case "Digit1": selectModel(sceneModels[0] ?? null); break;
    case "Digit2": selectModel(sceneModels[1] ?? null); break;
    case "Digit3": selectModel(sceneModels[2] ?? null); break;
    case "Digit4": selectModel(sceneModels[3] ?? null); break;
    default: break;
  }
});

void setupAdminPanel();
