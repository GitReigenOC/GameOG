export class VFXSystem {
  constructor(engine, scene, { bulletCapacity = 80, decalCapacity = 128 } = {}) {
    this.engine = engine;
    this.scene = scene;
    this.bullets = [];
    this.tracers = [];
    this.particles = [];
    this.lights = [];
    this.dummy = new engine.Object3D();
    this.bulletGeometry = this.withBounds(new engine.SphereGeometry(.012, 6, 4));
    this.bulletPool = new engine.InstancedMesh(
      this.bulletGeometry,
      new engine.MeshBasicMaterial({ color: "#f5d992" }),
      bulletCapacity
    );
    this.bulletPool.frustumCulled = false;
    this.bulletPool.instanceMatrix.setUsage(engine.DynamicDrawUsage);
    this.bulletPool.userData.capacity = bulletCapacity;
    this.scene.add(this.bulletPool);
    for (let index = 0; index < bulletCapacity; index++) {
      this.setInstance(this.bulletPool, index, new engine.Vector3(0, -1000, 0), new engine.Quaternion(), .001);
      this.bullets.push({ active: false, position: new engine.Vector3(), velocity: new engine.Vector3(), remaining: 0 });
    }

    this.decalMesh = new engine.InstancedMesh(
      this.withBounds(new engine.PlaneGeometry(1, 1)),
      new engine.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      decalCapacity
    );
    this.decalMesh.frustumCulled = false;
    this.decalMesh.instanceMatrix.setUsage(engine.DynamicDrawUsage);
    this.decalMesh.userData.capacity = decalCapacity;
    this.decalCapacity = decalCapacity;
    this.decalIndex = 0;
    this.scene.add(this.decalMesh);
    for (let index = 0; index < decalCapacity; index++) {
      this.setInstance(this.decalMesh, index, new engine.Vector3(0, -1000, 0), new engine.Quaternion(), .001);
    }
    this.flashTexture = this.createFlashTexture();
  }

  withBounds(geometry) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  setInstance(mesh, index, position, quaternion, scale) {
    this.dummy.position.copy(position);
    this.dummy.quaternion.copy(quaternion);
    if (typeof scale === "number") this.dummy.scale.setScalar(scale);
    else this.dummy.scale.copy(scale);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  createFlashTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(.35, "rgba(255,232,174,.85)");
    gradient.addColorStop(1, "rgba(255,145,48,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new this.engine.CanvasTexture(canvas);
  }

  spawnBullet(origin, destination, { color = "#f5d992", speed = 180 } = {}) {
    const bullet = this.bullets.find(item => !item.active);
    if (!bullet) return false;
    bullet.position.copy(origin);
    bullet.velocity.copy(destination).sub(origin);
    const distance = bullet.velocity.length();
    if (distance < .01) return false;
    bullet.velocity.multiplyScalar(speed / distance);
    bullet.remaining = distance / speed;
    bullet.active = true;
    bullet.color = color;
    const index = this.bullets.indexOf(bullet);
    this.bulletPool.setColorAt(index, new this.engine.Color(color));
    const orientation = new this.engine.Quaternion().setFromUnitVectors(
      new this.engine.Vector3(0, 0, 1),
      bullet.velocity.clone().normalize()
    );
    this.setInstance(this.bulletPool, index, bullet.position, orientation, new this.engine.Vector3(1, 1, 9));
    this.bulletPool.instanceColor.needsUpdate = true;
    return true;
  }

  addTracer(start, end, color = "#f3d58c") {
    const geometry = new this.engine.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const material = new this.engine.LineBasicMaterial({ color, transparent: true, opacity: .9, depthTest: true, depthWrite: false });
    const line = new this.engine.Line(geometry, material);
    line.frustumCulled = false;
    this.scene.add(line);
    this.tracers.push({ object: line, remaining: .075, duration: .075 });
  }

  spawnImpact(position, normal, color = "#44392d", size = .11) {
    const index = this.decalIndex;
    const direction = normal.clone().normalize();
    const quaternion = new this.engine.Quaternion().setFromUnitVectors(new this.engine.Vector3(0, 0, 1), direction);
    this.decalMesh.setColorAt(index, new this.engine.Color(color));
    this.setInstance(this.decalMesh, index, position.clone().addScaledVector(direction, .003), quaternion, size);
    this.decalMesh.instanceColor.needsUpdate = true;
    this.decalIndex = (index + 1) % this.decalCapacity;
  }

  addImpactParticles(position, color = "#d8c184") {
    for (let index = 0; index < 4; index++) {
      const particle = new this.engine.Mesh(
        this.withBounds(new this.engine.SphereGeometry(.018, 5, 4)),
        new this.engine.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      particle.position.copy(position);
      this.scene.add(particle);
      this.particles.push({
        object: particle,
        velocity: new this.engine.Vector3((Math.random() - .5) * 1.8, Math.random() * 1.1, (Math.random() - .5) * 1.8),
        remaining: .22,
        duration: .22
      });
    }
  }

  spawnMuzzleFlash(position) {
    const light = new this.engine.PointLight("#ffc76b", 3.5, 3, 2);
    light.position.copy(position);
    this.scene.add(light);
    const sprite = new this.engine.Sprite(new this.engine.SpriteMaterial({
      map: this.flashTexture, color: "#ffd987", transparent: true, blending: this.engine.AdditiveBlending, depthWrite: false
    }));
    sprite.position.copy(position);
    sprite.scale.set(.34, .34, 1);
    this.scene.add(sprite);
    this.lights.push({ light, sprite, remaining: .055 });
  }

  spawnExplosion(position, color = "#ff913d") {
    const material = new this.engine.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false });
    const blast = new this.engine.Mesh(this.withBounds(new this.engine.SphereGeometry(1, 12, 8)), material);
    blast.position.copy(position);
    blast.scale.setScalar(.12);
    this.scene.add(blast);
    this.particles.push({ object: blast, remaining: .34, duration: .34, blast: true });
    this.addImpactParticles(position, color);
  }

  update(dt) {
    for (let index = 0; index < this.bullets.length; index++) {
      const bullet = this.bullets[index];
      if (!bullet.active) continue;
      const step = Math.min(dt, bullet.remaining);
      bullet.position.addScaledVector(bullet.velocity, step);
      bullet.remaining -= step;
      if (bullet.remaining <= 0) bullet.active = false;
      const orientation = new this.engine.Quaternion().setFromUnitVectors(
        new this.engine.Vector3(0, 0, 1),
        bullet.velocity.clone().normalize()
      );
      this.setInstance(
        this.bulletPool,
        index,
        bullet.active ? bullet.position : new this.engine.Vector3(0, -1000, 0),
        orientation,
        bullet.active ? new this.engine.Vector3(1, 1, 9) : .001
      );
    }
    for (let index = this.tracers.length - 1; index >= 0; index--) {
      const tracer = this.tracers[index];
      tracer.remaining -= dt;
      tracer.object.material.opacity = Math.max(0, tracer.remaining / tracer.duration);
      if (tracer.remaining > 0) continue;
      this.scene.remove(tracer.object);
      tracer.object.geometry.dispose();
      tracer.object.material.dispose();
      this.tracers.splice(index, 1);
    }
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index];
      particle.remaining -= dt;
      const progress = 1 - particle.remaining / particle.duration;
      if (particle.blast) {
        particle.object.scale.setScalar(.12 + progress * 2.8);
        particle.object.material.opacity = .8 * (1 - progress);
      } else {
        particle.object.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= 2.8 * dt;
        particle.object.material.opacity = Math.max(0, 1 - progress);
      }
      if (particle.remaining > 0) continue;
      this.scene.remove(particle.object);
      particle.object.geometry.dispose();
      particle.object.material.dispose();
      this.particles.splice(index, 1);
    }
    for (let index = this.lights.length - 1; index >= 0; index--) {
      const flash = this.lights[index];
      flash.remaining -= dt;
      flash.light.intensity = Math.max(0, flash.remaining / .055) * 3.5;
      if (flash.remaining > 0) continue;
      this.scene.remove(flash.light, flash.sprite);
      flash.sprite.material.dispose();
      this.lights.splice(index, 1);
    }
  }
}
