export type WorldConfig = {
  id: string;
  name: string;
  subtitle: string;
  splatUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  spawn: [number, number, number];
  spawnRotation?: number;
  portal: [number, number, number];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  objectPos?: [number, number, number];
  objectScale?: number;
  colliderUrl?: string;
  /** Collider transform. Defaults to the splat's position/rotation/scale when omitted. */
  colliderPosition?: [number, number, number];
  colliderRotation?: [number, number, number]; // radians
  colliderScale?: number;
};

export const WORLDS: WorldConfig[] = [
  {
    id: "world-one",
    name: "Elephants TRavels",
    subtitle: "Fly through a miniature ancient courtyard",
    splatUrl: "/assets/worlds/Ancient%20Egyptian%20Desert%20Palace.spz",
    colliderUrl: "/assets/worlds/Ancient%20Egyptian%20Desert%20Palace_collider.glb",
    position: [0, -0.3, 0],
    rotation: [-0.0349, 0, 0],
    scale: 2.7,
    // Hover just above the Dad model (placed at [-4.25, 1, -4]) — the visual
    // centre of the palace — facing into the scene toward the other props.
    spawn: [-4.25, 5, -4],
    spawnRotation: 0,
    portal: [0, 3, -18],
    bounds: {
      min: [-22, -2, -28],
      max: [22, 14, 12]
    },
    objectPos: [0, 3.5, -4],
    objectScale: 1.0
  }/*,
  {
    id: "world-two",
    name: "Grisones Echo",
    subtitle: "Cross into a tranquil architectural dream",
    // Replace with: /assets/worlds/scene.compressed.ply
    splatUrl: "/assets/worlds/scene.compressed.ply",
    position: [0, -1, -11],
    rotation: [Math.PI, Math.PI * 0.55, 0],
    scale: 5,
    spawn: [0, 1.5, 7],
    portal: [0, 4, -20],
    bounds: {
      min: [-24, -3, -30],
      max: [24, 16, 13]
    }
  }*/
];
