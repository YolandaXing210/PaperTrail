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
};

export const WORLDS: WorldConfig[] = [
  {
    id: "world-one",
    name: "Elephants TRavels",
    subtitle: "Fly through a miniature ancient courtyard",
    // Replace with: /assets/worlds/chinese-world.ply
    splatUrl: "/assets/worlds/egyptian-simpson.compressed.ply",
    position: [0, -2.2, -12],
    rotation: [Math.PI, 0, 0],
    scale: 4,
    spawn: [0, 1.2, 6],
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
