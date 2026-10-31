import { DecalManager } from "./DecalManager.js";

export class VFXSystem {
  constructor(engine, scene, { bulletCapacity = 80, particleCapacity = 256 } = {}) {
    this.engine = engine;
    this.scene = scene;
    this.bullets = [];
    this.tracers = [];
    this.particles = Array.from({ length: particleCapacity }, () => ({
      active: false,
      position: new engine.Vector3(),
      velocity: new engine.Vector3(),
      remaining: 0,
      duration: 0,
      scale: 0,
      endScale: 0,
      gravity: 0,
      expanding: false
    }));
    this.lights = Array.from({ length: 8 }, () => {
      const light = new engine.PointLight("#ffc76b", 0, 3, 2);
      light.visible = false;
      scene.add(light);
      return { light, remaining: 0, duration: .055 };
    });
    this.dummy = new engine.Object3D();
    this.identityQuaternion = new engine.Quaternion();
    this.hiddenPosition = new engine.Vector3(0, -1000, 0);
    this.zeroVelocity = new engine.Vector3();
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

    this.particleGeometry = this.withBounds(new engine.SphereGeometry(1, 8, 6));
    this.particlePool = new engine.InstancedMesh(
      this.particleGeometry,
      new engine.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: .9, depthWrite: false }),
      particleCapacity
    );
    this.particlePool.frustumCulled = false;
    this.particlePool.instanceMatrix.setUsage(engine.DynamicDrawUsage);
    this.particlePool.userData.capacity = particleCapacity;
    this.scene.add(this.particlePool);
    for (let index = 0; index < particleCapacity; index++) {
      this.setInstance(this.particlePool, index, this.hiddenPosition, this.identityQuaternion, .001);
    }

    this.decals = new DecalManager(engine, scene);
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
    this.decals.add(position, normal, size, color);
  }

  clearDecals() {
    this.decals.clear();
  }

  updateDecals(now) {
    this.decals.update(now);
  }

  spawnParticle(position, {
    velocity = null,
    duration = .22,
    scale = .018,
    endScale = 0,
    gravity = 2.8,
    color = "#d8c184",
    expanding = false
  } = {}) {
    const particle = this.particles.find(item => !item.active) ||
      this.particles.reduce((oldest, item) => item.remaining < oldest.remaining ? item : oldest);
    const index = this.particles.indexOf(particle);
    particle.active = true;
    particle.position.copy(position);
    particle.velocity.copy(velocity || this.zeroVelocity);
    particle.remaining = duration;
    particle.duration = duration;
    particle.scale = scale;
    particle.endScale = endScale;
    particle.gravity = gravity;
    particle.expanding = expanding;
    this.setInstance(this.particlePool, index, particle.position, this.identityQuaternion, scale);
    this.particlePool.setColorAt(index, new this.engine.Color(color));
    this.particlePool.instanceColor.needsUpdate = true;
    return true;
  }

  addImpactParticles(position, color = "#d8c184") {
    for (let index = 0; index < 4; index++) {
      this.spawnParticle(position, {
        velocity: new this.engine.Vector3((Math.random() - .5) * 1.8, Math.random() * 1.1, (Math.random() - .5) * 1.8),
        color,
        scale: .018
      });
    }
  }

  spawnBlood(position) {
    for (let index = 0; index < 12; index++) {
      const direction = new this.engine.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.4 + .25,
        Math.random() * 2 - 1
      ).normalize();
      this.spawnParticle(position, {
        velocity: direction.multiplyScalar(1.2 + Math.random() * 2),
        color: "#7f2522",
        duration: .65,
        scale: .025,
        gravity: 3.8
      });
    }
  }

  spawnMuzzleFlash(position) {
    this.spawnParticle(position, {
      color: "#ffd987",
      duration: .055,
      scale: .17,
      gravity: 0
    });
    const flash = this.lights.find(item => item.remaining <= 0) ||
      this.lights.reduce((oldest, item) => item.remaining < oldest.remaining ? item : oldest);
    flash.light.position.copy(position);
    flash.light.intensity = 3.5;
    flash.light.visible = true;
    flash.remaining = flash.duration;
  }

  spawnExplosion(position, color = "#ff913d") {
    this.spawnParticle(position, {
      color,
      duration: .4,
      scale: .12,
      endScale: 2.9,
      gravity: 0,
      expanding: true
    });
    for (let index = 0; index < 18; index++) {
      const direction = new this.engine.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - .45,
        Math.random() * 2 - 1
      ).normalize();
      this.spawnParticle(position, {
        velocity: direction.multiplyScalar(2 + Math.random() * 5),
        color: index % 3 ? color : "#ffd98a",
        duration: .55 + Math.random() * .35,
        scale: .025 + Math.random() * .025,
        gravity: 5.2
      });
    }
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
    let activeParticles = false;
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index];
      if (!particle.active) continue;
      particle.remaining -= dt;
      const progress = 1 - particle.remaining / particle.duration;
      if (particle.expanding) {
        const growth = particle.scale + (particle.endScale - particle.scale) * progress;
        const fade = progress > .72 ? (1 - progress) / .28 : 1;
        this.setInstance(
          this.particlePool,
          index,
          particle.position,
          this.identityQuaternion,
          Math.max(.001, growth * fade)
        );
      } else {
        particle.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= particle.gravity * dt;
        this.setInstance(
          this.particlePool,
          index,
          particle.position,
          this.identityQuaternion,
          Math.max(.001, particle.scale * (1 - progress))
        );
      }
      activeParticles = true;
      if (particle.remaining > 0) continue;
      particle.active = false;
      this.setInstance(
        this.particlePool,
        index,
        this.hiddenPosition,
        this.identityQuaternion,
        .001
      );
    }
    if (activeParticles) this.particlePool.instanceMatrix.needsUpdate = true;
    for (let index = this.lights.length - 1; index >= 0; index--) {
      const flash = this.lights[index];
      if (flash.remaining <= 0) continue;
      flash.remaining -= dt;
      flash.light.intensity = Math.max(0, flash.remaining / flash.duration) * 3.5;
      if (flash.remaining > 0) continue;
      flash.light.intensity = 0;
      flash.light.visible = false;
    }
  }

  dispose() {
    this.decals.dispose();
    this.scene.remove(this.bulletPool, this.particlePool);
    this.lights.forEach(({ light }) => this.scene.remove(light));
    this.bulletGeometry.dispose();
    this.particleGeometry.dispose();
    this.bulletPool.material.dispose();
    this.particlePool.material.dispose();
  }
}
