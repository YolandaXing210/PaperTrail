import "./style.css";
import * as THREE from "three";
import { SparkRenderer, SplatMesh, SplatFileType } from "@sparkjsdev/spark";
import { WORLDS, type WorldConfig } from "./worlds";

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
      </div>
    </div>
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
const adminToggleBtns = document.querySelectorAll<HTMLButtonElement>(".admin-btn");
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
const planeModel = create3DAirplane();
plane.add(planeModel);
plane.visible = false;
scene.add(plane);

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
  if (target && (target.closest("button") || target.closest(".hud") || target.closest(".mobile-controls") || target.closest("#admin-panel") || target.closest(".admin-tabs"))) {
    return;
  }
  isDragging = true;
  prevPointerX = event.clientX;
  prevPointerY = event.clientY;
});

window.addEventListener("pointermove", (event) => {
  if (isDragging) {
    const deltaX = event.clientX - prevPointerX;
    const deltaY = event.clientY - prevPointerY;
    prevPointerX = event.clientX;
    prevPointerY = event.clientY;

    const adminPanel = document.querySelector("#admin-panel");
    const isAdminPanelOpen = adminPanel && !adminPanel.classList.contains("hidden-panel");
    if (isAdminPanelOpen) {
      adminOrbitYaw -= deltaX * 0.006;
      adminOrbitPitch = THREE.MathUtils.clamp(adminOrbitPitch - deltaY * 0.006, -Math.PI / 2.1, Math.PI / 2.1);
    } else {
      orbitYaw -= deltaX * 0.004;
      orbitPitch = THREE.MathUtils.clamp(orbitPitch - deltaY * 0.004, -Math.PI / 3.2, Math.PI / 3.2);
    }
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
startButton.addEventListener("click", () => void startAdventure());

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.04);
  updatePlane(delta);
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

void setupAdminPanel();
