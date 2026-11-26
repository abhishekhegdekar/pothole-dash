import type { MapDef } from '../data/maps';
import type { GraphicsQuality } from '../storage/save';
import type { VehicleId } from '../data/vehicles';

/** What the game needs from a renderer. Both the 3D and the 2D fallback renderer implement it. */
export interface GameRenderer {
  resize(wCss: number, hCss: number, devicePixelRatio: number): void;
  resetRun(): void;
  addShake(amount: number): void;
  /** Dust and debris at a world position (x across the road, y along it, metres). */
  burst(x: number, y: number): void;
  crash(dir: number): void;
  popText(text: string, x: number, y: number, colour: string, size: number): void;
  /** `mode` lets the 3D camera frame the title screen differently from a run. */
  draw(alpha: number, frameDt: number, running: boolean, mode?: ViewMode): void;
  setQuality(q: GraphicsQuality): void;
  /** Speed effect strength, 0..1, for the HUD vignette. */
  readonly speedFx: number;
  /** Switches city look, lighting and weather. Optional: the 2D fallback has one look. */
  setMap?(map: MapDef): void;
  /** Swaps the player's vehicle model. */
  setVehicle?(id: VehicleId): void;
}

export type ViewMode = 'menu' | 'game' | 'garage';
