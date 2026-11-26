import * as THREE from 'three';

const LEAVES = 36;
const BIRDS = 7;

/**
 * Life in the air: leaves drifting down in the breeze and a small flock of birds
 * crossing the sky now and then. Cheap: a few dozen tiny meshes, reused.
 */
export class Ambient {
  private readonly leaves: THREE.Mesh[] = [];
  private readonly leafVel: THREE.Vector3[] = [];
  private readonly leafSpin: number[] = [];
  private readonly flock = new THREE.Group();
  private readonly birds: Array<{ body: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; phase: number }> = [];
  private flockT = 0;
  private nextFlock = 3;
  private flockDir = 1;
  private leafCount = LEAVES;
  private time = 0;

  constructor(scene: THREE.Scene) {
    const leafGeo = new THREE.PlaneGeometry(0.22, 0.14);
    const leafMats = ['#4f8f3a', '#7aa63a', '#c79a2e', '#a8622a'].map(
      (c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }),
    );
    for (let i = 0; i < LEAVES; i++) {
      const m = new THREE.Mesh(leafGeo, leafMats[i % leafMats.length]);
      m.visible = false;
      scene.add(m);
      this.leaves.push(m);
      this.leafVel.push(new THREE.Vector3());
      this.leafSpin.push(0);
    }

    // Birds: a small body and two wings that flap.
    const bodyGeo = new THREE.BoxGeometry(0.16, 0.12, 0.42);
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.14, 0.62, 0, 0.06, 0, 0, 0.16]), 3));
    wingGeo.computeVertexNormals();
    const birdMat = new THREE.MeshLambertMaterial({ color: '#2a2a2e', side: THREE.DoubleSide });
    for (let i = 0; i < BIRDS; i++) {
      const body = new THREE.Group();
      body.add(new THREE.Mesh(bodyGeo, birdMat));
      const l = new THREE.Mesh(wingGeo, birdMat);
      const r = new THREE.Mesh(wingGeo, birdMat);
      r.scale.x = -1;
      body.add(l, r);
      this.flock.add(body);
      this.birds.push({ body, l, r, phase: Math.random() * 6 });
    }
    this.flock.visible = false;
    scene.add(this.flock);
  }

  /** Night maps have fewer leaves and the birds have gone to roost. */
  configure(night: boolean, rain: boolean): void {
    this.leafCount = rain ? 12 : night ? 16 : LEAVES;
    this.nextFlock = night ? Infinity : 2 + Math.random() * 4;
    this.flock.visible = false;
    for (let i = 0; i < LEAVES; i++) this.leaves[i]!.visible = false;
  }

  /** cx, cz: where the camera looks (world units). roadHalf: half the road width. */
  update(dt: number, cx: number, cz: number, roadHalf: number): void {
    this.time += dt;
    const wind = 0.9 + 0.5 * Math.sin(this.time * 0.35);
    for (let i = 0; i < this.leafCount; i++) {
      const m = this.leaves[i]!;
      const v = this.leafVel[i]!;
      if (!m.visible || m.position.y < 0.05 || Math.abs(m.position.z - cz) > 34) {
        // Let go from a tree on either side of the road, somewhere ahead of the camera.
        const side = Math.random() < 0.5 ? -1 : 1;
        m.position.set(cx + side * (roadHalf + 2 + Math.random() * 3), 3.5 + Math.random() * 3.5, cz - 6 - Math.random() * 28);
        v.set(-side * (0.3 + Math.random() * 0.8), -(0.5 + Math.random() * 0.5), (Math.random() - 0.5) * 0.6);
        this.leafSpin[i] = (Math.random() - 0.5) * 6;
        m.visible = true;
      }
      const flutter = Math.sin(this.time * 3 + i) * 0.6;
      m.position.x += (v.x * wind + flutter * 0.3) * dt;
      m.position.y += (v.y + Math.cos(this.time * 4 + i) * 0.25) * dt;
      m.position.z += v.z * dt;
      m.rotation.x += this.leafSpin[i]! * dt;
      m.rotation.y += this.leafSpin[i]! * 0.7 * dt;
    }

    // A flock crosses high above the road every so often.
    if (!this.flock.visible) {
      this.nextFlock -= dt;
      if (this.nextFlock <= 0) {
        this.flock.visible = true;
        this.flockT = 0;
        this.flockDir = Math.random() < 0.5 ? -1 : 1;
        this.flock.position.set(cx - this.flockDir * 30, 13 + Math.random() * 4, cz - 4 - Math.random() * 18);
        this.flock.rotation.y = this.flockDir > 0 ? -Math.PI / 2 + 0.3 : Math.PI / 2 - 0.3;
        this.birds.forEach((b, i) => b.body.position.set((i % 3) * 0.9 - 0.9 + Math.random() * 0.4, Math.random() * 0.8, -Math.floor(i / 2) * 1.1 + (i % 2) * 0.5));
      }
      return;
    }
    this.flockT += dt;
    this.flock.position.x += this.flockDir * 7.5 * dt;
    this.flock.position.z -= 1.5 * dt;
    for (const b of this.birds) {
      const a = Math.sin(this.time * 11 + b.phase) * 0.7;
      b.l.rotation.z = a;
      b.r.rotation.z = -a;
      b.body.position.y += Math.sin(this.time * 2 + b.phase) * 0.15 * dt;
    }
    if (this.flockT > 9) {
      this.flock.visible = false;
      this.nextFlock = 8 + Math.random() * 10;
    }
  }
}
