import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const DEFAULT_WEAPON_ASSETS = [
  { name: "rifle", url: "assets/weapons/rifle.glb" },
  { name: "sniper", url: "assets/weapons/sniper.glb" },
  { name: "shotgun", url: "assets/weapons/shotgun.glb" },
  { name: "smg", url: "assets/weapons/smg.glb" },
  { name: "knife", url: "assets/weapons/knife.glb" }
];

export class WeaponAssetLoader {
  constructor(engine, Loader, overrides = globalThis.BLACKSITE_WEAPON_ASSETS || {}) {
    this.engine = engine;
    this.loader = new Loader();
    this.assets = DEFAULT_WEAPON_ASSETS.map((asset, index) => {
      const override = overrides[asset.name] || overrides[index];
      return typeof override === "string" ? { ...asset, url: override } : { ...asset, ...override };
    });
    this.loaded = new Map();
  }

  async loadAll() {
    await Promise.all(this.assets.map(async (asset, index) => {
      const url = new URL(asset.url, document.baseURI).href;
      try {
        const gltf = await this.loader.loadAsync(url);
        const model = gltf.scene;
        model.position.set(...(asset.position || [0, -.08, -.12]));
        model.rotation.set(...(asset.rotation || [0, 0, 0]));
        model.traverse(object => {
          if (!object.isMesh) return;
          object.geometry.computeBoundingBox();
          object.geometry.computeBoundingSphere();
          object.castShadow = true;
          object.receiveShadow = true;
        });
        model.updateMatrixWorld(true);
        const bounds = new this.engine.Box3().setFromObject(model);
        const size = bounds.getSize(new this.engine.Vector3());
        const largestDimension = Math.max(size.x, size.y, size.z);
        if (largestDimension <= 0) throw new Error("Weapon asset has no measurable geometry.");
        model.scale.setScalar(asset.scale ?? .72 / largestDimension);
        this.loaded.set(index, { model, asset });
      } catch (error) {
        console.warn(`Could not load optional ${asset.name} weapon asset at ${url}. Add a GLB/GLTF file there or configure window.BLACKSITE_WEAPON_ASSETS.`, error);
      }
    }));
  }

  createInstance(index) {
    const entry = this.loaded.get(index);
    if (!entry) return null;
    return cloneSkeleton(entry.model);
  }

  getMuzzle(instance, index) {
    let muzzle = null;
    instance.traverse(object => {
      if (!muzzle && /(^|[_ -])(muzzle|barrel[_ -]?(end|tip))($|[_ -])/i.test(object.name)) muzzle = object;
    });
    if (muzzle) return muzzle;
    const configuredOffset = this.loaded.get(index)?.asset.muzzle;
    const socket = new this.engine.Group();
    socket.name = `${this.assets[index]?.name || "weapon"}-muzzle-socket`;
    socket.position.set(...(configuredOffset || [0, .025, -.62]));
    instance.add(socket);
    return socket;
  }

  getSight(instance, index) {
    let sight = null;
    instance.traverse(object => {
      if (!sight && /iron[_ -]?sight|ads[_ -]?sight|aim[_ -]?point|sight/i.test(object.name)) sight = object;
    });
    if (sight) return sight;
    const configuredOffset = this.loaded.get(index)?.asset.sight;
    if (!configuredOffset) return null;
    sight = new this.engine.Group();
    sight.name = `${this.assets[index]?.name || "weapon"}-ads-sight`;
    sight.position.set(...configuredOffset);
    instance.add(sight);
    return sight;
  }

  getHandOffset(index) {
    const asset = this.loaded.get(index)?.asset;
    return {
      position: asset?.handPosition || [0, 0, 0],
      rotation: asset?.handRotation || [0, 0, 0],
      scale: asset?.handScale ?? 1
    };
  }
}
