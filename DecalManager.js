export class DecalManager {
  constructor(engine, scene, { lifetime = 5, maxDecals = 180 } = {}) {
    this.engine = engine;
    this.scene = scene;
    this.lifetime = lifetime;
    this.maxDecals = maxDecals;
    this.decals = [];
    this.geometry = new engine.PlaneGeometry(1, 1);
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
    this.texture = this.loadBulletHoleTexture();
    this.material = new engine.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: .035,
      roughness: .88,
      metalness: .08,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
  }

  loadBulletHoleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    const glow = context.createRadialGradient(64, 64, 5, 64, 64, 55);
    glow.addColorStop(0, "rgba(9,8,7,.98)");
    glow.addColorStop(.24, "rgba(18,15,12,.94)");
    glow.addColorStop(.43, "rgba(58,42,29,.72)");
    glow.addColorStop(.62, "rgba(72,52,34,.24)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 128, 128);
    context.strokeStyle = "rgba(12,10,8,.78)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(64, 64, 17, 15, -.18, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 70; index++) {
      const angle = index * 2.399963;
      const radius = 19 + (index * 17 % 36);
      context.fillStyle = index % 2 ? "rgba(10,9,7,.17)" : "rgba(116,85,54,.13)";
      context.fillRect(64 + Math.cos(angle) * radius, 64 + Math.sin(angle) * radius, 2, 2);
    }

    const pngUrl = canvas.toDataURL("image/png");
    const texture = new this.engine.TextureLoader().load(pngUrl);
    texture.encoding = this.engine.sRGBEncoding;
    return texture;
  }

  add(position, normal, size = .16, color = "#ffffff", now = performance.now()) {
    const direction = normal.clone().normalize();
    const material = this.material.clone();
    material.color.set(color);
    const geometry = this.geometry.clone();
    const decal = new this.engine.Mesh(geometry, material);
    decal.position.copy(position).addScaledVector(direction, .006);
    decal.quaternion.setFromUnitVectors(new this.engine.Vector3(0, 0, 1), direction);
    decal.scale.setScalar(size);
    decal.renderOrder = 2;
    decal.frustumCulled = false;
    decal.userData.expiresAt = now + this.lifetime * 1000;
    this.scene.add(decal);
    this.decals.push(decal);
    if (this.decals.length > this.maxDecals) this.remove(this.decals[0]);
    return decal;
  }

  remove(decal) {
    const index = this.decals.indexOf(decal);
    if (index >= 0) this.decals.splice(index, 1);
    this.scene.remove(decal);
    decal.geometry.dispose();
    decal.material.dispose();
  }

  update(now = performance.now()) {
    for (let index = this.decals.length - 1; index >= 0; index--) {
      const decal = this.decals[index];
      if (now >= decal.userData.expiresAt) this.remove(decal);
    }
  }

  clear() {
    for (const decal of [...this.decals]) this.remove(decal);
  }

  dispose() {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
