    (() => {
      "use strict";

      const canvas = document.querySelector("#game");
      if (!window.THREE) throw new Error("Three.js did not load. Check the network connection and reload.");
      const THREE = window.THREE;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#111a17");
      scene.fog = new THREE.Fog("#202920", 12, 27);
      const camera = new THREE.PerspectiveCamera(72, 16 / 9, .05, 80);
      camera.position.set(7.5, 1.65, -7.5);
      scene.add(camera);
      const ambientLight = new THREE.AmbientLight("#bac7aa", 1.15);
      scene.add(ambientLight);
      const sunLight = new THREE.DirectionalLight("#f0e5c4", 2.2);
      sunLight.position.set(-5, 12, 7);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.left = -18;
      sunLight.shadow.camera.right = 18;
      sunLight.shadow.camera.top = 18;
      sunLight.shadow.camera.bottom = -18;
      sunLight.shadow.camera.near = .5;
      sunLight.shadow.camera.far = 35;
      sunLight.shadow.bias = -.00025;
      scene.add(sunLight);
      const staticMaterials = new Map();
      const staticGeometries = new Map();
      const enemyModels = new Map();
      let remoteModel = null;
      let weaponAnchor = null;
      let muzzleLight = null;
      let weaponModels = [];
      let weaponLoader = null;
      let networkPeer = null, networkConnection = null, networkRole = "";
      let networkStateTimer = 0, remotePlayer = null, roomCode = "";
      const raycaster = new THREE.Raycaster();
      const overlay = document.querySelector("#overlay");
      const startButton = document.querySelector("#start-button");
      const returnMenuButton = document.querySelector("#return-menu-button");
      const hitMarker = document.querySelector("#hit-marker");
      const profileScreen = document.querySelector("#profile-screen");
      const mainMenu = document.querySelector("#main-menu");
      const multiplayerMenu = document.querySelector("#multiplayer-menu");
      const serversMenu = document.querySelector("#servers-menu");
      const profileModal = document.querySelector("#profile-modal");
      const settingsScreen = document.querySelector("#settings-screen");
      const menuScreens = [profileScreen, mainMenu, multiplayerMenu, serversMenu, profileModal, settingsScreen];
      const map = [
        "1111111111111111",
        "1000000000000001",
        "1000110001100001",
        "1000110001100001",
        "1000000000000001",
        "1011000110001101",
        "1000000000000001",
        "1000110001100001",
        "1000110001100001",
        "1000000000000001",
        "1011000110001101",
        "1000000000000001",
        "1000110001100001",
        "1000110001100001",
        "1000000000000001",
        "1111111111111111"
      ];
      const overheadLights = [
        { x: 7.5, y: 6.5 },
        { x: 2.5, y: 1.5 }, { x: 7.5, y: 1.5 }, { x: 12.5, y: 1.5 },
        { x: 2.5, y: 4.5 }, { x: 7.5, y: 4.5 }, { x: 12.5, y: 4.5 },
        { x: 2.5, y: 8.5 }, { x: 7.5, y: 8.5 }, { x: 12.5, y: 8.5 },
        { x: 2.5, y: 12.5 }, { x: 7.5, y: 12.5 }, { x: 12.5, y: 12.5 }
      ];
      function cachedMaterial(key, color, options = {}) {
        if (!staticMaterials.has(key)) {
          staticMaterials.set(key, new THREE.MeshStandardMaterial({
            color, roughness: options.roughness ?? .82, metalness: options.metalness ?? 0,
            map: options.map || null, emissive: options.emissive || "#000000",
            emissiveIntensity: options.emissiveIntensity || 0
          }));
        }
        return staticMaterials.get(key);
      }

      function cachedBoxGeometry(width, height, depth) {
        const key = `${width}:${height}:${depth}`;
        if (!staticGeometries.has(key)) staticGeometries.set(key, new THREE.BoxGeometry(width, height, depth));
        return staticGeometries.get(key);
      }

      function createArenaTexture(baseColor, lineColor, repeatX, repeatY) {
        const textureCanvas = document.createElement("canvas");
        textureCanvas.width = 256;
        textureCanvas.height = 256;
        const textureContext = textureCanvas.getContext("2d");
        textureContext.fillStyle = baseColor;
        textureContext.fillRect(0, 0, 256, 256);
        textureContext.strokeStyle = lineColor;
        textureContext.lineWidth = 2;
        for (let offset = 0; offset <= 256; offset += 64) {
          textureContext.beginPath();
          textureContext.moveTo(offset, 0);
          textureContext.lineTo(offset, 256);
          textureContext.moveTo(0, offset);
          textureContext.lineTo(256, offset);
          textureContext.stroke();
        }
        for (let i = 0; i < 180; i++) {
          const x = (i * 73) % 256;
          const y = (i * 131) % 256;
          textureContext.fillStyle = i % 2 ? "#ffffff0b" : "#00000012";
          textureContext.fillRect(x, y, 2 + i % 5, 2);
        }
        const texture = new THREE.CanvasTexture(textureCanvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        return texture;
      }

      function buildArena() {
        const floorTexture = createArenaTexture("#30372f", "#41483e", 16, 16);
        const wallTexture = createArenaTexture("#555d50", "#424a3f", 2, 2);
        const floorMaterial = cachedMaterial("floor", "#aab09c", { map: floorTexture });
        const wallMaterial = cachedMaterial("wall", "#aab09c", { map: wallTexture });
        const ceilingMaterial = cachedMaterial("ceiling", "#353c34");
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(8, 0, -8);
        floor.receiveShadow = true;
        floor.frustumCulled = true;
        scene.add(floor);
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(8, 4, -8);
        ceiling.frustumCulled = true;
        scene.add(ceiling);

        const wallCount = map.reduce((total, row) => total + [...row].filter(cell => cell === "1").length, 0);
        const walls = new THREE.InstancedMesh(cachedBoxGeometry(1, 4, 1), wallMaterial, wallCount);
        walls.castShadow = true;
        walls.receiveShadow = true;
        walls.frustumCulled = true;
        const transform = new THREE.Object3D();
        let wallIndex = 0;
        map.forEach((row, mapY) => [...row].forEach((cell, mapX) => {
          if (cell !== "1") return;
          transform.position.set(mapX + .5, 2, -mapY - .5);
          transform.updateMatrix();
          walls.setMatrixAt(wallIndex++, transform.matrix);
        }));
        walls.instanceMatrix.needsUpdate = true;
        scene.add(walls);

        const fixtureMaterial = cachedMaterial("light-fixture", "#242a23", { metalness: .48 });
        const glowMaterial = cachedMaterial("light-glow", "#d9dfa9", { emissive: "#c5d58b", emissiveIntensity: 1.2 });
        overheadLights.forEach(({ x, y }, index) => {
          const fixture = new THREE.Mesh(cachedBoxGeometry(.9, .08, .28), fixtureMaterial);
          fixture.position.set(x, 3.92, -y);
          fixture.frustumCulled = true;
          scene.add(fixture);
          const diffuser = new THREE.Mesh(cachedBoxGeometry(.72, .035, .17), glowMaterial);
          diffuser.position.set(x, 3.86, -y);
          diffuser.frustumCulled = true;
          scene.add(diffuser);
          const light = new THREE.PointLight("#d3dbac", index === 0 ? 2.2 : 1.25, 7, 2);
          light.position.set(x, 3.55, -y);
          light.castShadow = false;
          scene.add(light);
        });
      }

      buildArena();

      const weapons = [
        { name: "ASSAULT RIFLE", short: "RIFLE", magazine: 30, ammo: 30, reserve: 90, damage: 50, spread: .075, interval: .18, reloadTime: 1.15, range: 18, auto: true },
        { name: "PRECISION SNIPER", short: "SNIPER", magazine: 5, ammo: 5, reserve: 25, damage: 100, spread: 0, interval: 1.25, reloadTime: 1.6, range: 22, scoped: true, chamberTime: .72 },
        { name: "BREACH SHOTGUN", short: "SHOTGUN", magazine: 8, ammo: 8, reserve: 40, damage: 100, pellets: 7, spread: .24, interval: .65, reloadTime: 1.4, range: 9 },
        { name: "COMPACT SMG", short: "SMG", magazine: 32, ammo: 32, reserve: 128, damage: 34, spread: .12, interval: .085, reloadTime: 1.1, range: 13, auto: true },
        { name: "COMBAT KNIFE", short: "KNIFE", magazine: 0, ammo: 0, reserve: 0, damage: 100, spread: .6, interval: .48, melee: true }
      ];
      const weaponModelSources = [null, null, null, null, null];

      function weaponBox(parent, size, position, material, name) {
        const mesh = new THREE.Mesh(cachedBoxGeometry(...size), material);
        mesh.position.set(...position);
        mesh.name = name;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        parent.add(mesh);
        return mesh;
      }

      function createFallbackWeapon(index) {
        const group = new THREE.Group();
        const darkMetal = cachedMaterial("weapon-metal", "#292f2c", { metalness: .78, roughness: .32 });
        const edgeMetal = cachedMaterial("weapon-edge", "#7d8277", { metalness: .84, roughness: .24 });
        const polymer = cachedMaterial("weapon-polymer", "#343a31", { roughness: .76 });
        const gripMaterial = cachedMaterial("weapon-grip", "#191d19", { roughness: .94 });
        const accent = cachedMaterial("weapon-accent", "#737969", { metalness: .58, roughness: .42 });
        const barrelLength = index === 1 ? .57 : index === 2 ? .4 : index === 3 ? .28 : .36;

        if (index === 4) {
          weaponBox(group, [.045, .045, .25], [0, -.02, -.08], edgeMetal, "knife-blade");
          weaponBox(group, [.075, .065, .13], [0, -.075, .11], gripMaterial, "knife-handle");
          weaponBox(group, [.15, .025, .025], [0, -.045, .025], accent, "knife-guard");
          return group;
        }

        weaponBox(group, [.22, .16, .3], [0, -.005, -.02], darkMetal, "receiver");
        weaponBox(group, [.19, .08, .27], [0, .085, -.015], accent, "upper-receiver");
        weaponBox(group, [.18, .16, index === 1 ? .28 : .2], [0, -.005, .2], polymer, "stock");
        weaponBox(group, [.1, .2, .11], [0, -.15, .02], gripMaterial, "pistol-grip");
        weaponBox(group, [.07, .19, .16], [0, -.17, -.08], gripMaterial, "magazine");
        weaponBox(group, [.045, .05, barrelLength], [0, .025, -.2 - barrelLength / 2], edgeMetal, "barrel");
        weaponBox(group, [.09, .09, .08], [0, .025, -.25 - barrelLength], darkMetal, "muzzle-brake");
        weaponBox(group, [.28, .035, .045], [0, .12, -.04], gripMaterial, "top-rail");
        for (let notch = 0; notch < 5; notch++) {
          weaponBox(group, [.026, .012, .012], [-.105 + notch * .052, .145, -.04], edgeMetal, `rail-notch-${notch}`);
        }
        weaponBox(group, [.1, .045, .04], [0, .17, -.035], accent, "iron-sight");

        if (index === 1) {
          const scope = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .26, 16), darkMetal);
          scope.rotation.x = Math.PI / 2;
          scope.position.set(0, .22, -.04);
          scope.castShadow = true;
          scope.frustumCulled = true;
          group.add(scope);
          weaponBox(group, [.17, .08, .19], [0, -.12, .05], gripMaterial, "sniper-magazine");
        } else if (index === 2) {
          weaponBox(group, [.07, .07, .43], [.085, -.035, -.41], accent, "shotgun-tube");
          weaponBox(group, [.045, .07, .17], [0, -.12, -.19], polymer, "pump-grip");
        } else if (index === 3) {
          weaponBox(group, [.16, .1, .15], [0, .13, -.03], accent, "smg-sight");
          weaponBox(group, [.055, .23, .1], [0, -.19, -.04], gripMaterial, "extended-magazine");
        } else {
          weaponBox(group, [.08, .07, .23], [-.13, -.025, -.13], polymer, "foregrip");
        }
        return group;
      }

      function initializeWeapons() {
        weaponAnchor = new THREE.Group();
        weaponAnchor.position.set(.32, -.3, -.48);
        camera.add(weaponAnchor);
        muzzleLight = new THREE.PointLight("#ffc76b", 0, 3, 2);
        muzzleLight.position.set(.32, -.25, -1.25);
        camera.add(muzzleLight);
        weaponModels = weapons.map((weapon, index) => {
          const fallback = createFallbackWeapon(index);
          fallback.visible = index === player.weaponIndex;
          weaponAnchor.add(fallback);
          return { fallback, loaded: null };
        });
        if (!THREE.GLTFLoader) {
          console.warn("GLTFLoader is unavailable; using procedural 3D weapon models.");
          return;
        }
        weaponLoader = new THREE.GLTFLoader();
        weaponModelSources.forEach((source, index) => {
          if (!source) return;
          weaponLoader.load(source, gltf => {
            const model = gltf.scene;
            model.scale.setScalar(index === 4 ? .42 : .5);
            model.position.set(0, -.08, -.12);
            model.traverse(object => {
              if (!object.isMesh) return;
              object.castShadow = true;
              object.receiveShadow = true;
              object.frustumCulled = true;
            });
            model.visible = index === player.weaponIndex;
            weaponAnchor.add(model);
            weaponModels[index].loaded = model;
            weaponModels[index].fallback.visible = false;
          }, undefined, error => {
            if (error?.target?.status !== 404) console.warn(`Could not load weapon model ${source}; using the built-in 3D model.`, error);
          });
        });
      }
      const player = { x: 7.5, y: 7.5, angle: -Math.PI / 2, health: 100, weaponIndex: 0, score: 0 };
      initializeWeapons();
      const weaponWeight = [1, 1.9, 1.45, .78, .5];
      const keys = new Set();
      let enemies = [];
      let explosions = [];
      let running = false, gameOver = false, pointerLockUnavailable = false, wave = 0, lastTime = 0;
      let fireCooldown = 0, reloadTimer = 0, hurtFlash = 0, muzzleFlash = 0, hitTimeout = 0;
      let reloadDuration = 0;
      let firing = false, aiming = false, toastTimeout = 0, knifeSwing = 0, movementBob = 0;
      let weaponRecoil = 0, weaponLagX = 0, dashTimer = 0, dashCooldown = 0;
      let dashDirectionX = 0, dashDirectionY = 0;
      const dashDuration = .38;
      let touchMovementX = 0, touchMovementY = 0, lookPointerId = null, lastLookX = 0;
      let touchStickPointerId = null;
      let grenadeCooldown = 0, flashbangCooldown = 0, grenadeAnimation = 0, flashbangAnimation = 0;
      let grenades = 2, flashbangs = 1;
      let grenadeFlash = 0, damageMessageTimer = 0, footstepsTimer = 0, audioContext = null, ambientStarted = false;
      const controlSettings = { mouseSensitivity: 1, scopeSensitivity: .44 };
      let settingsReturnToPause = false;
      let reloadKind = "";
      let operatorName = "", selectedMode = "ffa-waves", gameMode = "waves";
      let roomMessageTimeout = 0, profileReturnScreen = mainMenu;

      try {
        operatorName = localStorage.getItem("blacksite.operator") || "";
      } catch (error) {
        console.warn("Local profile storage is unavailable.", error);
      }

      try {
        const savedSettings = JSON.parse(localStorage.getItem("blacksite.settings") || "{}");
        if (Number.isFinite(savedSettings.mouseSensitivity)) {
          controlSettings.mouseSensitivity = Math.min(3, Math.max(.2, savedSettings.mouseSensitivity));
        }
        if (Number.isFinite(savedSettings.scopeSensitivity)) {
          controlSettings.scopeSensitivity = Math.min(1, Math.max(.2, savedSettings.scopeSensitivity));
        }
      } catch (error) {
        console.warn("Saved control settings could not be loaded.", error);
      }

      function syncSettingsControls() {
        const sensitivity = document.querySelector("#sensitivity-setting");
        const scopeSensitivity = document.querySelector("#scope-sensitivity-setting");
        sensitivity.value = controlSettings.mouseSensitivity;
        scopeSensitivity.value = controlSettings.scopeSensitivity;
        document.querySelector("#sensitivity-value").value = `${controlSettings.mouseSensitivity.toFixed(2)}x`;
        document.querySelector("#scope-sensitivity-value").value = `${controlSettings.scopeSensitivity.toFixed(2)}x`;
      }

      function saveControlSettings() {
        try {
          localStorage.setItem("blacksite.settings", JSON.stringify(controlSettings));
        } catch (error) {
          console.warn("Control settings could not be saved.", error);
          setCombatMessage("SETTINGS COULD NOT BE SAVED", 1800);
        }
      }

      function openSettings(fromPause = false) {
        settingsReturnToPause = fromPause;
        showMenu(settingsScreen);
      }

      async function toggleFullscreen() {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else {
            await document.querySelector(".game-shell").requestFullscreen();
          }
        } catch (error) {
          console.error("Could not change fullscreen mode.", error);
          setCombatMessage("FULLSCREEN IS NOT AVAILABLE", 1800);
        }
      }

      function syncFullscreenButton() {
        const fullscreen = Boolean(document.fullscreenElement);
        const button = document.querySelector("#fullscreen-button");
        button.textContent = fullscreen ? "Exit fullscreen" : "Fullscreen";
        button.setAttribute("aria-label", fullscreen ? "Exit fullscreen" : "Enter fullscreen");
        requestAnimationFrame(resize);
      }

      function closeSettings() {
        if (settingsReturnToPause) {
          menuScreens.forEach(menu => { menu.hidden = true; });
          settingsScreen.hidden = true;
          overlay.hidden = false;
          document.querySelector("#pause-button").disabled = false;
          document.querySelector("#pause-settings-button").hidden = false;
          settingsReturnToPause = false;
          return;
        }
        showMenu(mainMenu);
      }

      if (operatorName) {
        profileScreen.hidden = true;
        mainMenu.hidden = false;
        document.querySelector("#menu-username").textContent = operatorName;
      }

      function showMenu(screen) {
        profileReturnScreen = screen === profileModal ? menuScreens.find(menu => menu !== profileModal && !menu.hidden) || mainMenu : screen;
        menuScreens.forEach(menu => { menu.hidden = menu !== screen; });
        overlay.hidden = true;
        running = false;
        firing = false;
        aiming = false;
        keys.clear();
        document.querySelector("#pause-button").disabled = true;
        updateAimHud();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      }

      function ensureAudio() {
        if (!audioContext) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          audioContext = new AudioContextClass();
        }
        if (audioContext.state === "suspended") audioContext.resume();
        if (!ambientStarted) {
          ambientStarted = true;
          const tone = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const lowpass = audioContext.createBiquadFilter();
          tone.type = "triangle";
          tone.frequency.value = 47;
          lowpass.type = "lowpass";
          lowpass.frequency.value = 90;
          gain.gain.value = .012;
          tone.connect(lowpass).connect(gain).connect(audioContext.destination);
          tone.start();
        }
      }

      function playSound(type) {
        if (!audioContext) return;
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        const presets = {
          rifle: [105, .11, .24], sniper: [64, .3, .34], shotgun: [78, .18, .32],
          smg: [128, .06, .16], knife: [240, .08, .12], reload: [340, .12, .05],
          damage: [72, .24, .12], death: [48, .7, .16], grenade: [55, .4, .3],
          flash: [880, .22, .09], footstep: [88, .045, .035], hit: [190, .07, .06]
        };
        const [frequency, duration, volume] = presets[type] || presets.rifle;
        oscillator.type = type === "damage" || type === "death" || type === "grenade" ? "sawtooth" : "square";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * .48), now + duration);
        filter.type = "lowpass";
        filter.frequency.value = type === "footstep" ? 180 : 1800;
        gain.gain.setValueAtTime(Math.min(.42, volume), now);
        gain.gain.exponentialRampToValueAtTime(.001, now + duration);
        oscillator.connect(filter).connect(gain).connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
      }

      function setCombatMessage(message, duration = 1400) {
        const element = document.querySelector("#combat-message");
        element.textContent = message;
        clearTimeout(roomMessageTimeout);
        roomMessageTimeout = setTimeout(() => { element.textContent = ""; }, duration);
      }

      function openProfile(name, detail) {
        const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
        document.querySelector("#profile-card-name").textContent = name;
        document.querySelector("#profile-avatar").textContent = initials || "OP";
        document.querySelector("#profile-card-info").textContent = detail;
        showMenu(profileModal);
      }

      function setRoomMessage(message, isError = false) {
        const status = document.querySelector("#room-message");
        status.textContent = message;
        status.style.color = isError ? "#ef9b7c" : "";
      }

      function makeRoomCode() {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const random = new Uint8Array(8);
        window.crypto.getRandomValues(random);
        return `bs-${Array.from(random, value => alphabet[value % alphabet.length]).join("").toLowerCase()}`;
      }

      function updateRoomPanel(message = "Create a room or enter a host's invite code to connect.") {
        const list = document.querySelector("#room-list");
        const details = document.querySelector("#room-details");
        list.replaceChildren();
        details.replaceChildren();
        const heading = document.createElement("div");
        heading.className = "kicker";
        heading.textContent = networkRole ? `PEER ROOM / ${roomCode}` : "DIRECT WEBRTC ROOM";
        const description = document.createElement("p");
        description.textContent = message;
        details.append(heading, description);
        const disconnectButton = document.querySelector("#join-room-button");
        disconnectButton.disabled = !networkPeer && !networkConnection;
        document.querySelector("#servers-kicker").textContent = "PEER-TO-PEER / PRIVATE ROOM";
        document.querySelector("#servers-title").textContent = "PRIVATE LOBBY";
      }

      function sendPeerMessage(message) {
        if (networkConnection?.open) networkConnection.send(message);
      }

      function sendPlayerState() {
        if (!networkConnection?.open) return;
        sendPeerMessage({
          type: "state",
          x: player.x,
          y: player.y,
          angle: player.angle,
          health: player.health,
          weapon: player.weaponIndex
        });
      }

      function removeRemoteModel() {
        if (!remoteModel) return;
        scene.remove(remoteModel);
        remoteModel = null;
        remotePlayer = null;
      }

      function applyRemoteShot(angle, weaponIndex) {
        if (!remotePlayer) return;
        const weapon = weapons[weaponIndex];
        const dx = player.x - remotePlayer.x;
        const dy = player.y - remotePlayer.y;
        const along = dx * Math.cos(angle) + dy * Math.sin(angle);
        const perpendicular = Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle));
        if (along <= 0 || along > (weapon.range || 1.8) || perpendicular > .34 ||
          castRayFrom(remotePlayer.x, remotePlayer.y, angle).distance < along - .2) return;
        player.health = Math.max(0, player.health - weapon.damage);
        document.querySelector("#health").textContent = player.health;
        const fill = document.querySelector("#health-fill");
        fill.style.width = `${player.health}%`;
        fill.style.background = player.health < 35 ? "#dd6d58" : "#c1e16d";
        document.querySelector("#damage-overlay").classList.add("visible");
        window.setTimeout(() => document.querySelector("#damage-overlay").classList.remove("visible"), 300);
        setCombatMessage(`HIT BY ${weapon.short}`);
        sendPlayerState();
        if (player.health === 0) endGame();
      }

      function handlePeerData(data) {
        if (!data || typeof data !== "object") return;
        if (data.type === "state" && Number.isFinite(data.x) && Number.isFinite(data.y) &&
          Number.isFinite(data.angle) && Number.isFinite(data.health) && Number.isInteger(data.weapon) &&
          data.x >= 0 && data.x < 16 && data.y >= 0 && data.y < 16 &&
          data.health >= 0 && data.health <= 100 && data.weapon >= 0 && data.weapon < weapons.length) {
          remotePlayer = {
            x: data.x, y: data.y, angle: data.angle,
            health: data.health, weapon: data.weapon
          };
          return;
        }
        if (data.type === "shot" && Number.isFinite(data.angle) &&
          Number.isInteger(data.weapon) && data.weapon >= 0 && data.weapon < weapons.length) {
          if (remotePlayer) {
            const origin = new THREE.Vector3(remotePlayer.x, 1.25, -remotePlayer.y);
            const direction = new THREE.Vector3(Math.cos(data.angle), 0, -Math.sin(data.angle));
            const geometry = new THREE.BufferGeometry().setFromPoints([origin, origin.clone().addScaledVector(direction, 5)]);
            const material = new THREE.LineBasicMaterial({ color: "#f4d57a", transparent: true, opacity: .8 });
            const tracer = new THREE.Line(geometry, material);
            tracer.frustumCulled = true;
            scene.add(tracer);
            window.setTimeout(() => {
              scene.remove(tracer);
              geometry.dispose();
              material.dispose();
            }, 100);
          }
          applyRemoteShot(data.angle, data.weapon);
        }
      }

      function attachPeerConnection(connection) {
        if (networkConnection && networkConnection.open) {
          connection.close();
          return;
        }
        networkConnection = connection;
        connection.on("open", () => {
          document.querySelector("#join-room-button").disabled = false;
          document.querySelector("#room-code-input").value = roomCode;
          updateRoomPanel(`Connected to ${connection.peer}. Starting ${selectedMode.toUpperCase()}...`);
          gameMode = selectedMode === "ffa-waves" ? "coop" : selectedMode;
          startGame(gameMode, true);
          sendPlayerState();
          if (networkStateTimer) clearInterval(networkStateTimer);
          networkStateTimer = window.setInterval(sendPlayerState, 50);
        });
        connection.on("data", handlePeerData);
        connection.on("close", () => {
          networkConnection = null;
          if (networkStateTimer) clearInterval(networkStateTimer);
          networkStateTimer = 0;
          removeRemoteModel();
          setRoomMessage("The peer connection closed.");
          if (running) pauseGame();
        });
        connection.on("error", error => {
          console.error("Peer connection error.", error);
          setRoomMessage("The peer connection failed. Check the invite code and try again.", true);
        });
      }

      function createPrivateRoom() {
        if (!window.Peer) {
          setRoomMessage("PeerJS failed to load. Check your internet connection and reload.", true);
          return;
        }
        if (networkPeer) networkPeer.destroy();
        networkRole = "host";
        roomCode = makeRoomCode();
        document.querySelector("#room-code-input").value = roomCode;
        setRoomMessage("Connecting to the PeerJS signaling service...");
        networkPeer = new Peer(roomCode, { debug: 1 });
        networkPeer.on("open", id => {
          roomCode = id;
          document.querySelector("#room-code-input").value = id;
          setRoomMessage(`Room is ready. Share this invite code: ${id}`);
          updateRoomPanel(`Waiting for one player to connect to ${id}.`);
        });
        networkPeer.on("connection", connection => attachPeerConnection(connection));
        networkPeer.on("error", error => {
          console.error("Peer room error.", error);
          setRoomMessage(`Could not create the room (${error.type || "network error"}). Try again.`, true);
        });
        networkPeer.on("disconnected", () => {
          setRoomMessage("PeerJS signaling disconnected. Reconnect or create a new room.", true);
          networkPeer?.reconnect();
        });
      }

      function connectToRoom() {
        if (!window.Peer) {
          setRoomMessage("PeerJS failed to load. Check your internet connection and reload.", true);
          return;
        }
        const code = document.querySelector("#room-code-input").value.trim().toLowerCase();
        if (!/^bs-[a-z0-9]{8}$/.test(code)) {
          setRoomMessage("Enter a valid 8-character room code starting with bs-.", true);
          return;
        }
        if (networkPeer) networkPeer.destroy();
        roomCode = code;
        networkRole = "guest";
        setRoomMessage(`Connecting to ${code}...`);
        networkPeer = new Peer(undefined, { debug: 1 });
        networkPeer.on("open", () => {
          attachPeerConnection(networkPeer.connect(code, { reliable: true }));
        });
        networkPeer.on("error", error => {
          console.error("Peer join error.", error);
          setRoomMessage(`Could not connect (${error.type || "network error"}). Verify the room code and try again.`, true);
        });
      }

      function openServerBrowser() {
        updateRoomPanel();
        setRoomMessage("");
        showMenu(serversMenu);
      }

      function joinSelectedRoom() {
        if (networkConnection) {
          networkConnection.close();
          networkConnection = null;
        }
        if (networkPeer) {
          networkPeer.destroy();
          networkPeer = null;
        }
        if (networkStateTimer) clearInterval(networkStateTimer);
        networkStateTimer = 0;
        networkRole = "";
        roomCode = "";
        removeRemoteModel();
        if (running) pauseGame();
        updateRoomPanel();
        setRoomMessage("Disconnected from the peer room.");
      }

      function addGrenade(flash = false) {
        if (!running) return;
        if (flash ? flashbangs <= 0 : grenades <= 0) {
          setCombatMessage(flash ? "NO FLASHBANGS" : "NO FRAG GRENADES", 700);
          return;
        }
        if (flash ? flashbangCooldown > 0 : grenadeCooldown > 0) return;
        if (flash) {
          flashbangCooldown = 3.5;
          flashbangs--;
          document.querySelector("#flash-count").textContent = flashbangs;
        } else {
          grenadeCooldown = 3.5;
          grenades--;
          document.querySelector("#grenade-count").textContent = grenades;
        }
        if (flash) flashbangAnimation = .7;
        else grenadeAnimation = .7;
        const distance = 3.3;
        const targetX = player.x + Math.cos(player.angle) * distance;
        const targetY = player.y + Math.sin(player.angle) * distance;
        let impactX = player.x, impactY = player.y;
        for (let step = 1; step <= 20; step++) {
          const t = step / 20;
          const x = player.x + (targetX - player.x) * t;
          const y = player.y + (targetY - player.y) * t;
          if (wallAt(x, y)) break;
          impactX = x; impactY = y;
        }
        const projectile = document.createElement("span");
        projectile.className = `thrown-item${flash ? " thrown-item--flash" : ""}`;
        document.querySelector(".stage").append(projectile);
        const travelTime = 340;
        projectile.animate([
          { transform: "translate(0,0) scale(.5)", opacity: 1 },
          { transform: "translate(-18px,-42px) scale(.7)", opacity: 1, offset: .48 },
          { transform: "translate(-35px,-5px) scale(.3)", opacity: .8 }
        ], { duration: travelTime, easing: "ease-in" }).finished.then(() => projectile.remove());
        setTimeout(() => {
          if (!flash) {
            playSound("grenade");
            grenadeFlash = .2;
            explosions.push({ x: impactX, y: impactY, age: 0, duration: 1.1 });
            enemies = enemies.filter(enemy => {
              if (gameMode === "tdm" && enemy.team !== 1) return true;
              const distanceToBlast = Math.hypot(enemy.x - impactX, enemy.y - impactY);
              if (distanceToBlast > 2.8) return true;
              enemy.health -= 160 * (1 - distanceToBlast / 4);
              if (enemy.health <= 0) player.score += 100;
              return enemy.health > 0;
            });
            document.querySelector("#score").textContent = String(player.score).padStart(4, "0");
            setCombatMessage("FRAG DETONATED");
            if (gameMode === "tdm" ? !enemies.some(enemy => enemy.team === 1) :
              !isWaveMode() && enemies.length === 0) endGame();
          } else {
            playSound("flash");
            grenadeFlash = 1.2;
            enemies.forEach(enemy => { enemy.stunned = 2.2; });
            document.querySelector("#damage-overlay").classList.add("flashbang");
            setTimeout(() => document.querySelector("#damage-overlay").classList.remove("flashbang"), 950);
            setCombatMessage("FLASHBANG OUT");
          }
        }, travelTime);
      }

      function currentWeapon() {
        return weapons[player.weaponIndex];
      }

      function isWaveMode() {
        return gameMode === "waves" || gameMode === "coop";
      }

      function updateAimHud() {
        const scoped = aiming && currentWeapon().scoped;
        document.querySelector("#scope-overlay").hidden = !scoped;
        document.querySelector("#crosshair").hidden = scoped;
        document.querySelector(".stage").classList.toggle("is-aiming", aiming);
      }

      function updateWeaponHud() {
        const weapon = currentWeapon();
        document.querySelector("#weapon-label").textContent = weapon.name;
        document.querySelector("#ammo").textContent = weapon.melee ? "--" : weapon.ammo;
        document.querySelector("#magazine").textContent = weapon.melee ? "--" : weapon.magazine;
        document.querySelector("#reserve").textContent = weapon.melee ? "--" : String(weapon.reserve).padStart(3, "0");
        document.querySelectorAll(".weapon-slot").forEach((slot, index) => {
          slot.classList.toggle("active", index === player.weaponIndex);
          slot.setAttribute("aria-pressed", String(index === player.weaponIndex));
        });
      }

      function selectWeapon(index) {
        if (!Number.isInteger(index) || index < 0 || index >= weapons.length || index === player.weaponIndex) return;
        player.weaponIndex = index;
        reloadTimer = 0;
        aiming = false;
        fireCooldown = 0;
        updateAimHud();
        updateWeaponHud();
        const toast = document.querySelector("#weapon-toast");
        toast.textContent = currentWeapon().name;
        toast.classList.add("visible");
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove("visible"), 900);
      }

      function resize() {
        const bounds = canvas.getBoundingClientRect();
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(bounds.width, bounds.height, false);
        camera.aspect = bounds.width / Math.max(1, bounds.height);
        camera.updateProjectionMatrix();
      }

      function wallAt(x, y) {
        const mx = Math.floor(x), my = Math.floor(y);
        return my < 0 || mx < 0 || my >= map.length || mx >= map[0].length || map[my][mx] === "1";
      }

      function movePlayer(dx, dy) {
        const radius = .22;
        if (!wallAt(player.x + dx + Math.sign(dx) * radius, player.y)) player.x += dx;
        if (!wallAt(player.x, player.y + dy + Math.sign(dy) * radius)) player.y += dy;
      }

      function movementInput() {
        const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0) - touchMovementY;
        const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0) + touchMovementX;
        const length = Math.hypot(forward, strafe);
        if (length > 1) return { forward: forward / length, strafe: strafe / length };
        return { forward, strafe };
      }

      function isSprinting() {
        return keys.has("ShiftLeft") || keys.has("ShiftRight");
      }

      function resetTouchControls() {
        touchMovementX = 0;
        touchMovementY = 0;
        touchStickPointerId = null;
        lookPointerId = null;
        document.querySelector("#touch-stick-knob").style.transform = "translate(-50%, -50%)";
        document.querySelectorAll(".touch-action").forEach(button => button.classList.remove("active"));
        keys.delete("ShiftLeft");
        firing = false;
        aiming = false;
      }

      function createEnemyModel(enemy) {
        const group = new THREE.Group();
        const teamColor = gameMode === "tdm" && enemy.team === 0 ? "#52747a" : "#59634d";
        const uniform = cachedMaterial(`enemy-uniform-${teamColor}`, teamColor, { roughness: .88 });
        const armor = cachedMaterial("enemy-armor", "#272e29", { metalness: .16, roughness: .74 });
        const visor = cachedMaterial("enemy-visor", "#c1e16d", { emissive: "#677d36", emissiveIntensity: .35 });
        const skin = cachedMaterial("enemy-skin", "#7d8069", { roughness: .94 });
        const addPart = (geometry, material, position, name) => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(...position);
          mesh.name = name;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = true;
          mesh.userData.enemyRef = enemy;
          group.add(mesh);
          return mesh;
        };
        const box = (size, material, position, name) =>
          addPart(cachedBoxGeometry(...size), material, position, name);
        const sphere = (radius, material, position, name) => {
          const key = `sphere:${radius}`;
          if (!staticGeometries.has(key)) staticGeometries.set(key, new THREE.SphereGeometry(radius, 12, 8));
          return addPart(staticGeometries.get(key), material, position, name);
        };
        box([.48, .7, .28], uniform, [0, 1.05, 0], "torso");
        box([.54, .24, .33], armor, [0, 1.22, -.015], "vest");
        sphere(.19, skin, [0, 1.62, 0], "head");
        sphere(.205, armor, [0, 1.73, -.005], "helmet");
        box([.24, .045, .12], visor, [0, 1.63, -.175], "visor");
        const leftLeg = box([.17, .58, .2], armor, [-.14, .39, 0], "left-leg");
        const rightLeg = box([.17, .58, .2], armor, [.14, .39, 0], "right-leg");
        const leftArm = box([.16, .55, .18], uniform, [-.34, 1.02, -.03], "left-arm");
        const rightArm = box([.16, .55, .18], uniform, [.34, 1.02, -.03], "right-arm");
        box([.52, .12, .28], armor, [0, .08, .02], "boots");
        group.userData.leftLeg = leftLeg;
        group.userData.rightLeg = rightLeg;
        group.userData.leftArm = leftArm;
        group.userData.rightArm = rightArm;
        group.traverse(object => { if (object.isMesh) object.userData.enemyRef = enemy; });
        scene.add(group);
        enemyModels.set(enemy, group);
        return group;
      }

      function updateEnemyModels() {
        const liveEnemies = new Set(enemies);
        for (const [enemy, model] of enemyModels) {
          if (liveEnemies.has(enemy)) continue;
          scene.remove(model);
          enemyModels.delete(enemy);
        }
        for (const enemy of enemies) {
          const model = enemyModels.get(enemy) || createEnemyModel(enemy);
          model.position.set(enemy.x, 0, -enemy.y);
          model.rotation.y = Math.atan2(-(player.x - enemy.x), player.y - enemy.y);
          const gait = enemy.stunned > 0 ? 0 : Math.sin(enemy.phase) * .55;
          model.userData.leftLeg.rotation.x = gait;
          model.userData.rightLeg.rotation.x = -gait;
          model.userData.leftArm.rotation.x = -gait * .55;
          model.userData.rightArm.rotation.x = gait * .55;
          model.visible = enemy.health > 0;
        }
      }

      function createRemoteModel() {
        if (remoteModel) return remoteModel;
        remoteModel = new THREE.Group();
        const uniform = cachedMaterial("remote-uniform", "#425d72", { roughness: .82 });
        const armor = cachedMaterial("remote-armor", "#1f2b34", { metalness: .18 });
        const marker = cachedMaterial("remote-marker", "#74d8ef", { emissive: "#338ba0", emissiveIntensity: .65 });
        const addPart = (geometry, material, position) => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(...position);
          mesh.castShadow = true;
          mesh.frustumCulled = true;
          remoteModel.add(mesh);
          return mesh;
        };
        addPart(cachedBoxGeometry(.48, .78, .3), uniform, [0, 1.05, 0]);
        const headGeometryKey = "remote-head";
        if (!staticGeometries.has(headGeometryKey)) staticGeometries.set(headGeometryKey, new THREE.SphereGeometry(.2, 12, 8));
        addPart(staticGeometries.get(headGeometryKey), armor, [0, 1.62, 0]);
        addPart(cachedBoxGeometry(.54, .22, .34), armor, [0, 1.22, 0]);
        addPart(cachedBoxGeometry(.3, .035, .035), marker, [0, 1.64, -.18]);
        scene.add(remoteModel);
        return remoteModel;
      }

      function updateRemoteModel() {
        if (!remotePlayer || !networkConnection?.open) {
          if (remoteModel) remoteModel.visible = false;
          return;
        }
        const model = createRemoteModel();
        model.visible = true;
        model.position.set(remotePlayer.x, 0, -remotePlayer.y);
        model.rotation.y = remotePlayer.angle - Math.PI / 2;
      }

      function spawnWave() {
        wave++;
        const count = isWaveMode() ? Math.min(3 + wave * 2, 15) :
          gameMode === "duel" ? 1 : gameMode === "tdm" ? 4 : 5;
        for (let i = 0; i < count; i++) {
          let x, y, tries = 0;
          do {
            x = 1.5 + Math.random() * 13;
            y = 1.5 + Math.random() * 13;
            tries++;
          } while ((wallAt(x, y) || Math.hypot(x - player.x, y - player.y) < 4) && tries < 100);
          enemies.push({
            x, y, health: 100, attack: Math.random() * 1.5,
            strafe: Math.random() < .5 ? 1 : -1, phase: Math.random() * Math.PI * 2,
            team: gameMode === "tdm" ? (i < 2 ? 0 : 1) : 1
          });
        }
        document.querySelector("#wave").textContent = isWaveMode()
          ? `WAVE ${String(wave).padStart(2, "0")}`
          : `MATCH ${String(wave).padStart(2, "0")}`;
        const modeTitle = { waves: "hostiles in the area", coop: "local co-op demo hostiles", duel: "local duel opponent", ffa: "local free-for-all opponents", tdm: "2 local allies and 2 opposing bots" }[gameMode];
        document.querySelector("#objective").textContent = `${count} ${modeTitle}`;
      }

      function castRay(angle) {
        return castRayFrom(player.x, player.y, angle);
      }

      function castRayFrom(originX, originY, angle) {
        const rayX = Math.cos(angle), rayY = Math.sin(angle);
        let mapX = Math.floor(originX), mapY = Math.floor(originY);
        const deltaX = Math.abs(1 / (rayX || 1e-9)), deltaY = Math.abs(1 / (rayY || 1e-9));
        const stepX = rayX < 0 ? -1 : 1, stepY = rayY < 0 ? -1 : 1;
        let sideX = rayX < 0 ? (originX - mapX) * deltaX : (mapX + 1 - originX) * deltaX;
        let sideY = rayY < 0 ? (originY - mapY) * deltaY : (mapY + 1 - originY) * deltaY;
        let side = 0;
        for (let i = 0; i < 40; i++) {
          if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
          else { sideY += deltaY; mapY += stepY; side = 1; }
          if (mapY < 0 || mapX < 0 || mapY >= map.length || mapX >= map[0].length || map[mapY][mapX] === "1") {
            const distance = Math.max(.001, side === 0 ? sideX - deltaX : sideY - deltaY);
            const hitPosition = side === 0 ? originY + distance * rayY : originX + distance * rayX;
            return { distance, side, mapX, mapY, rayX, rayY, wallU: hitPosition - Math.floor(hitPosition) };
          }
        }
        return { distance: 20, side: 0, mapX, mapY, rayX, rayY, wallU: 0 };
      }

      function render() {
        updateEnemyModels();
        updateRemoteModel();
        camera.position.set(player.x, 1.65 - (dashTimer > 0 ? .22 : 0), -player.y);
        camera.rotation.set(0, player.angle - Math.PI / 2, 0);
        camera.fov = aiming ? (currentWeapon().scoped ? 36 : 64) : 72;
        camera.updateProjectionMatrix();
        if (weaponAnchor) {
          const moving = movementInput().forward !== 0 || movementInput().strafe !== 0;
          const sprinting = moving && isSprinting();
          weaponAnchor.position.y = -.3 + Math.sin(movementBob) * (sprinting ? .012 : .006) -
            weaponRecoil * .0008 - (dashTimer > 0 ? .06 : 0);
          weaponAnchor.position.x = .32 + Math.sin(performance.now() * .0018) * (moving ? .008 : .003) -
            weaponLagX * .00045;
          weaponAnchor.rotation.x = (dashTimer > 0 ? -.16 : 0) + weaponRecoil * .004;
          weaponAnchor.rotation.z = dashTimer > 0 ? -.08 : currentWeapon().melee ? -knifeSwing * .32 : 0;
          muzzleLight.intensity = muzzleFlash > 0 ? 3.5 : 0;
          weaponModels.forEach(({ fallback, loaded }, index) => {
            fallback.visible = index === player.weaponIndex && !loaded;
            if (loaded) loaded.visible = index === player.weaponIndex;
          });
        }
        renderer.render(scene, camera);
      }

      function reload() {
        const weapon = currentWeapon();
        if (!running || weapon.melee || reloadTimer > 0 || weapon.ammo === weapon.magazine || weapon.reserve <= 0) return;
        reloadTimer = weapon.reloadTime;
        reloadDuration = weapon.reloadTime;
        reloadKind = "reload";
        playSound("reload");
        document.querySelector("#objective").textContent = `Reloading ${weapon.short.toLowerCase()}...`;
      }

      function shoot() {
        if (!running || fireCooldown > 0 || reloadTimer > 0) return;
        const weapon = currentWeapon();
        if (!weapon.melee && weapon.ammo <= 0) { reload(); return; }
        ensureAudio();
        if (!weapon.melee) {
          weapon.ammo--;
          muzzleFlash = weapon.scoped ? .18 : .1;
          updateWeaponHud();
          playSound(player.weaponIndex === 0 ? "rifle" : player.weaponIndex === 1 ? "sniper" : player.weaponIndex === 2 ? "shotgun" : "smg");
          weaponRecoil = Math.max(weaponRecoil, [9, 20, 15, 5][player.weaponIndex] || 7);
        } else {
          knifeSwing = 1;
          playSound("knife");
        }
        fireCooldown = weapon.interval;
        if (weapon.chamberTime) {
          reloadTimer = weapon.chamberTime;
          reloadDuration = weapon.chamberTime;
          reloadKind = "chamber";
        }
        sendPeerMessage({ type: "shot", weapon: player.weaponIndex, angle: player.angle });
        const pelletCount = weapon.melee ? 7 : weapon.pellets || 1;
        const hits = new Map();
        for (let pellet = 0; pellet < pelletCount; pellet++) {
          const spread = weapon.melee ? .52 : weapon.spread * (aiming ? .45 : 1);
          const shotAngle = player.angle + (pelletCount === 1 ? 0 : (Math.random() - .5) * spread);
          const maxDistance = Math.min(weapon.melee ? 1.8 : weapon.range || 18, castRay(shotAngle).distance - .04);
          const targets = enemies
            .filter(enemy => gameMode !== "tdm" || enemy.team === 1)
            .map(enemy => enemyModels.get(enemy) || createEnemyModel(enemy));
          raycaster.set(
            camera.position,
            new THREE.Vector3(Math.cos(shotAngle), 0, -Math.sin(shotAngle)).normalize()
          );
          raycaster.near = 0;
          raycaster.far = Math.max(0, maxDistance);
          const intersection = raycaster.intersectObjects(targets, true)[0];
          const target = intersection?.object.userData.enemyRef
            ? { enemy: intersection.object.userData.enemyRef, distance: intersection.distance }
            : null;
          if (target) {
            const previous = hits.get(target.enemy);
            hits.set(target.enemy, { enemy: target.enemy, distance: target.distance, pellets: (previous?.pellets || 0) + 1 });
          }
        }
        if (hits.size) {
          playSound("hit");
          hitMarker.classList.add("visible");
          clearTimeout(hitTimeout);
          hitTimeout = setTimeout(() => hitMarker.classList.remove("visible"), 110);
          for (const { enemy, distance, pellets: hitPellets } of hits.values()) {
            const rangeScale = player.weaponIndex === 2 ? .35 + .65 * Math.max(0, 1 - distance / 10) : 1;
            enemy.health -= weapon.damage * (hitPellets / pelletCount) * rangeScale;
            if (enemy.health > 0) continue;
            enemies.splice(enemies.indexOf(enemy), 1);
            player.score += 100;
            document.querySelector("#score").textContent = String(player.score).padStart(4, "0");
            setCombatMessage("TARGET ELIMINATED", 650);
            if (gameMode === "tdm" ? !enemies.some(enemy => enemy.team === 1) :
              !isWaveMode() && enemies.length === 0) endGame();
          }
        }
      }

      function startDash() {
        const { forward, strafe } = movementInput();
        const length = Math.hypot(forward, strafe);
        if (!running || aiming || dashTimer > 0 || dashCooldown > 0 || length === 0) return;
        dashDirectionX = (Math.cos(player.angle) * forward + Math.cos(player.angle + Math.PI / 2) * strafe) / length;
        dashDirectionY = (Math.sin(player.angle) * forward + Math.sin(player.angle + Math.PI / 2) * strafe) / length;
        dashTimer = dashDuration;
        dashCooldown = .9;
        setCombatMessage("DASH", 500);
      }

      function update(dt) {
        fireCooldown = Math.max(0, fireCooldown - dt);
        muzzleFlash = Math.max(0, muzzleFlash - dt);
        knifeSwing = Math.max(0, knifeSwing - dt * 4);
        weaponRecoil = Math.max(0, weaponRecoil - dt * 40);
        weaponLagX *= Math.max(0, 1 - dt * (5 / weaponWeight[player.weaponIndex]));
        dashTimer = Math.max(0, dashTimer - dt);
        dashCooldown = Math.max(0, dashCooldown - dt);
        hurtFlash = Math.max(0, hurtFlash - dt * 1.4);
        grenadeFlash = Math.max(0, grenadeFlash - dt * 2.8);
        grenadeCooldown = Math.max(0, grenadeCooldown - dt);
        flashbangCooldown = Math.max(0, flashbangCooldown - dt);
        grenadeAnimation = Math.max(0, grenadeAnimation - dt * 1.4);
        flashbangAnimation = Math.max(0, flashbangAnimation - dt * 1.4);
        explosions = explosions.filter(explosion => {
          explosion.age += dt;
          return explosion.age < explosion.duration;
        });
        if (firing && currentWeapon().auto) shoot();
        if (reloadTimer > 0) {
          reloadTimer -= dt;
          if (reloadTimer <= 0) {
            const weapon = currentWeapon();
            if (reloadKind === "reload") {
              const loaded = Math.min(weapon.magazine - weapon.ammo, weapon.reserve);
              weapon.ammo += loaded; weapon.reserve -= loaded;
              updateWeaponHud();
              playSound("reload");
              document.querySelector("#objective").textContent = `${enemies.length} hostiles in the area`;
            }
            reloadKind = "";
          }
        }

        const { forward, strafe } = movementInput();
        const length = Math.hypot(forward, strafe) || 1;
        const moving = forward !== 0 || strafe !== 0 || dashTimer > 0;
        const sprinting = !aiming && dashTimer === 0 && isSprinting() && (forward !== 0 || strafe !== 0);
        if (moving) {
          movementBob += dt * (dashTimer > 0 ? 24 : sprinting ? 15 : aiming ? 7 : 11);
          footstepsTimer -= dt;
          if (footstepsTimer <= 0) {
            playSound("footstep");
            footstepsTimer = dashTimer > 0 ? .2 : sprinting ? .36 : aiming ? .58 : .38;
          }
        } else {
          movementBob *= Math.max(0, 1 - dt * 5);
        }
        if (dashTimer > 0) {
          const dashSpeed = 9 * (.35 + .65 * dashTimer / dashDuration);
          movePlayer(dashDirectionX * dashSpeed * dt, dashDirectionY * dashSpeed * dt);
        } else {
          const speed = (aiming ? 2 : sprinting ? 4.2 : 3.2) * dt;
          movePlayer((Math.cos(player.angle) * forward + Math.cos(player.angle + Math.PI / 2) * strafe) / length * speed,
            (Math.sin(player.angle) * forward + Math.sin(player.angle + Math.PI / 2) * strafe) / length * speed);
        }

        for (const enemy of enemies) {
          const dx = player.x - enemy.x, dy = player.y - enemy.y, distance = Math.hypot(dx, dy);
          enemy.phase += dt * (distance > 1.15 ? 7 : 2);
          enemy.stunned = Math.max(0, (enemy.stunned || 0) - dt);
          enemy.attack -= dt;
          if (enemy.stunned > 0) continue;
          if (distance > 1.15) {
            const approach = distance > 3 ? 1 : .35;
            const vx = (dx / distance * approach + -dy / distance * .18 * enemy.strafe) * dt * .68;
            const vy = (dy / distance * approach + dx / distance * .18 * enemy.strafe) * dt * .68;
            if (!wallAt(enemy.x + vx, enemy.y)) enemy.x += vx;
            if (!wallAt(enemy.x, enemy.y + vy)) enemy.y += vy;
          } else if (enemy.attack <= 0 && castRayFrom(enemy.x, enemy.y, Math.atan2(dy, dx)).distance >= distance - .25) {
            enemy.attack = 1.8 + Math.random() * .8;
            player.health = Math.max(0, player.health - 6);
            hurtFlash = .8;
            damageMessageTimer = .3;
            playSound("damage");
            document.querySelector("#damage-overlay").classList.add("visible");
            setTimeout(() => document.querySelector("#damage-overlay").classList.remove("visible"), 300);
            document.querySelector("#health").textContent = player.health;
            const fill = document.querySelector("#health-fill");
            fill.style.width = `${player.health}%`;
            fill.style.background = player.health < 35 ? "#dd6d58" : "#c1e16d";
            if (player.health === 0) {
              playSound("death");
              endGame();
            }
          }
        }
        if (enemies.length === 0 && running && isWaveMode()) {
          document.querySelector("#objective").textContent = "Sector clear - next wave inbound";
          spawnWave();
        }
        damageMessageTimer = Math.max(0, damageMessageTimer - dt);
      }

      function frame(time) {
        const dt = Math.min((time - lastTime) / 1000 || 0, .05);
        lastTime = time;
        if (running) update(dt);
        render();
        requestAnimationFrame(frame);
      }

      function startGame(requestedMode = gameMode, fresh = gameOver) {
        if (fresh || gameOver) {
          gameMode = requestedMode;
          player.x = 7.5; player.y = 7.5; player.angle = -Math.PI / 2;
          player.health = 100; player.score = 0;
          weapons.forEach((weapon, index) => {
            const ammo = [30, 5, 8, 32, 0][index];
            const reserve = [90, 25, 40, 128, 0][index];
            weapon.ammo = ammo; weapon.reserve = reserve;
          });
          player.weaponIndex = 0;
          reloadTimer = 0;
          reloadDuration = 0;
          reloadKind = "";
          grenadeCooldown = 0;
          flashbangCooldown = 0;
          grenadeFlash = 0;
          explosions = [];
          dashTimer = 0;
          dashCooldown = 0;
          weaponRecoil = 0;
          weaponLagX = 0;
          wave = 0; enemies.length = 0; gameOver = false;
          grenades = 2;
          flashbangs = 1;
          document.querySelector("#grenade-count").textContent = grenades;
          document.querySelector("#flash-count").textContent = flashbangs;
          document.querySelector("#health").textContent = "100";
          document.querySelector("#health-fill").style.width = "100%";
          document.querySelector("#score").textContent = "0000";
          updateWeaponHud();
        }
        ensureAudio();
        firing = false;
        aiming = false;
        running = true;
        menuScreens.forEach(menu => { menu.hidden = true; });
        overlay.hidden = true;
        updateAimHud();
        document.querySelector("#overlay-kicker").textContent = gameMode === "waves"
          ? "SINGLE-PLAYER / SURVIVAL"
          : `LOCAL MULTIPLAYER DEMO / ${gameMode.toUpperCase()}`;
        document.querySelector("#overlay-title").innerHTML = gameMode === "waves" ? "HOLD THE<br>PERIMETER" : "MATCH<br>IN PROGRESS";
        document.querySelector("#overlay-copy").textContent = gameMode === "waves"
          ? "Survive escalating hostile waves. Use WASD or the touch controls to move, aim and fire, and dash clear of danger."
          : "Local bot match preview. Public/private rooms are mock lobbies and are not connected to the internet.";
        startButton.textContent = "Deploy";
        document.querySelector("#pause-button").textContent = "Pause";
        document.querySelector("#pause-button").disabled = false;
        document.querySelector("#pause-settings-button").hidden = true;
        returnMenuButton.hidden = true;
        if (wave === 0) spawnWave();
        if (!window.matchMedia("(any-pointer: coarse)").matches) {
          const pointerLockRequest = canvas.requestPointerLock?.();
          if (pointerLockRequest && typeof pointerLockRequest.catch === "function") {
            pointerLockRequest.catch(() => { pointerLockUnavailable = true; });
          }
        }
      }

      function pauseGame() {
        if (!running || gameOver) return;
        running = false;
        firing = false;
        aiming = false;
        dashTimer = 0;
        resetTouchControls();
        keys.clear();
        overlay.hidden = false;
        updateAimHud();
        document.querySelector("#pause-settings-button").hidden = false;
        document.querySelector("#overlay-kicker").textContent = "SIMULATION PAUSED";
        document.querySelector("#overlay-title").innerHTML = "REGROUP<br>AND REDEPLOY";
        document.querySelector("#overlay-copy").textContent = "The perimeter is waiting. Resume when you are ready.";
        startButton.textContent = "Resume";
        returnMenuButton.hidden = false;
        document.querySelector("#pause-button").textContent = "Resume";
        document.querySelector("#pause-button").disabled = false;
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      }

      function endGame() {
        running = false; gameOver = true;
        firing = false;
        aiming = false;
        overlay.hidden = false;
        document.querySelector("#pause-settings-button").hidden = true;
        document.querySelector("#overlay-kicker").textContent = `MATCH ENDED / SCORE ${player.score}`;
        document.querySelector("#overlay-kicker").textContent = `${isWaveMode() ? "MISSION" : "MATCH"} ENDED / SCORE ${player.score}`;
        document.querySelector("#overlay-title").innerHTML = isWaveMode() ? "PERIMETER<br>BREACHED" : "MATCH<br>COMPLETE";
        document.querySelector("#overlay-copy").textContent = isWaveMode()
          ? `You held for ${wave} wave${wave === 1 ? "" : "s"}. Reset and try again.`
          : `${operatorName} finished the local ${gameMode.toUpperCase()} demo.`;
        startButton.textContent = "Try again";
        returnMenuButton.hidden = false;
        document.querySelector("#pause-button").textContent = "Mission over";
        document.querySelector("#pause-button").disabled = true;
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      }

      document.querySelector("#profile-name-form").addEventListener("submit", event => {
        event.preventDefault();
        const input = document.querySelector("#profile-name");
        const name = input.value.trim().replace(/\s+/g, " ");
        const error = document.querySelector("#profile-error");
        if (!/^[A-Za-z0-9 _-]{2,16}$/.test(name)) {
          error.textContent = "Use 2-16 letters, numbers, spaces, underscores, or hyphens.";
          input.focus();
          return;
        }
        operatorName = name;
        try {
          localStorage.setItem("blacksite.operator", operatorName);
          error.textContent = "";
        } catch (storageError) {
          console.warn("The operator profile could not be saved.", storageError);
          error.textContent = "Profile created, but browser storage is unavailable.";
        }
        document.querySelector("#menu-username").textContent = operatorName;
        showMenu(mainMenu);
      });
      document.querySelector("#solo-button").addEventListener("click", () => startGame("waves", true));
      document.querySelector("#multiplayer-button").addEventListener("click", () => showMenu(multiplayerMenu));
      document.querySelector("#settings-button").addEventListener("click", () => openSettings());
      document.querySelector("#pause-settings-button").addEventListener("click", () => openSettings(true));
      document.querySelector("#settings-back-button").addEventListener("click", closeSettings);
      document.querySelector("#sensitivity-setting").addEventListener("input", event => {
        controlSettings.mouseSensitivity = Number(event.currentTarget.value);
        syncSettingsControls();
        saveControlSettings();
      });
      document.querySelector("#scope-sensitivity-setting").addEventListener("input", event => {
        controlSettings.scopeSensitivity = Number(event.currentTarget.value);
        syncSettingsControls();
        saveControlSettings();
      });
      document.querySelector("#profile-button").addEventListener("click", () => openProfile(operatorName, "Your local operator profile"));
      document.querySelectorAll(".mode-card").forEach(button => {
        button.addEventListener("click", () => {
          selectedMode = button.dataset.mode;
          document.querySelectorAll(".mode-card").forEach(card => card.classList.toggle("selected", card === button));
        });
      });
      document.querySelector("#public-servers-button").addEventListener("click", openServerBrowser);
      document.querySelector("#private-servers-button").addEventListener("click", openServerBrowser);
      document.querySelector("#create-room-button").addEventListener("click", createPrivateRoom);
      document.querySelector("#connect-room-button").addEventListener("click", connectToRoom);
      document.querySelector("#room-code-input").addEventListener("keydown", event => {
        if (event.code === "Enter") connectToRoom();
      });
      document.querySelector("#join-room-button").addEventListener("click", joinSelectedRoom);
      document.querySelector("#back-to-modes").addEventListener("click", () => showMenu(multiplayerMenu));
      document.querySelectorAll("[data-back='main-menu']").forEach(button => button.addEventListener("click", () => showMenu(mainMenu)));
      document.querySelector("#close-profile-modal").addEventListener("click", () => showMenu(profileReturnScreen));
      document.querySelector("#profile-card-close").addEventListener("click", () => showMenu(profileReturnScreen));
      returnMenuButton.addEventListener("click", () => {
        gameOver = false;
        document.querySelector("#pause-button").textContent = "Pause";
        showMenu(mainMenu);
      });
      startButton.addEventListener("click", () => startGame(gameMode, gameOver));
      document.querySelector("#pause-button").addEventListener("click", () => {
        if (running) pauseGame();
        else if (!gameOver && overlay.hidden === false) startGame(gameMode, false);
      });
      document.querySelector("#fullscreen-button").addEventListener("click", toggleFullscreen);
      document.addEventListener("fullscreenchange", syncFullscreenButton);
      document.querySelectorAll(".weapon-slot").forEach(button => {
        button.addEventListener("click", () => {
          if (running) selectWeapon(Number(button.dataset.weapon));
        });
      });
      window.addEventListener("resize", resize);
      window.addEventListener("keydown", event => {
        keys.add(event.code);
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
        if (event.altKey && event.code === "Enter") {
          event.preventDefault();
          toggleFullscreen();
          return;
        }
        if (event.code === "Escape") {
          event.preventDefault();
          if (running) pauseGame();
          return;
        }
        if (!running || event.repeat) return;
        if (event.code === "KeyR") reload();
        if (event.code === "KeyG") addGrenade(false);
        if (event.code === "KeyF") addGrenade(true);
        if (event.code === "KeyC") startDash();
        if (event.code.startsWith("Digit")) {
          const index = Number(event.code.slice(5)) - 1;
          selectWeapon(index);
        }
      });
      window.addEventListener("keyup", event => keys.delete(event.code));
      const touchStick = document.querySelector("#touch-stick");
      const touchStickKnob = document.querySelector("#touch-stick-knob");
      touchStick.addEventListener("pointerdown", event => {
        if (!running) return;
        event.preventDefault();
        touchStickPointerId = event.pointerId;
        touchStick.setPointerCapture(event.pointerId);
        updateTouchStick(event);
      });
      touchStick.addEventListener("pointermove", event => {
        if (event.pointerId === touchStickPointerId) updateTouchStick(event);
      });
      function updateTouchStick(event) {
        const bounds = touchStick.getBoundingClientRect();
        const radius = bounds.width * .34;
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        const distance = Math.hypot(dx, dy);
        const scale = distance > radius ? radius / distance : 1;
        const x = dx * scale, y = dy * scale;
        touchMovementX = x / radius;
        touchMovementY = y / radius;
        touchStickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      }
      function releaseTouchStick(event) {
        if (event.pointerId !== touchStickPointerId) return;
        touchStickPointerId = null;
        touchMovementX = 0;
        touchMovementY = 0;
        touchStickKnob.style.transform = "translate(-50%, -50%)";
      }
      touchStick.addEventListener("pointerup", releaseTouchStick);
      touchStick.addEventListener("pointercancel", releaseTouchStick);

      function bindTouchHold(button, onStart, onEnd) {
        button.addEventListener("pointerdown", event => {
          if (!running) return;
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          button.classList.add("active");
          onStart();
        });
        const release = () => {
          button.classList.remove("active");
          onEnd();
        };
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
      }
      bindTouchHold(document.querySelector("#touch-fire"), () => {
        firing = true;
        shoot();
      }, () => { firing = false; });
      bindTouchHold(document.querySelector("#touch-aim"), () => {
        aiming = true;
        updateAimHud();
      }, () => {
        aiming = false;
        updateAimHud();
      });
      bindTouchHold(document.querySelector("#touch-sprint"), () => keys.add("ShiftLeft"), () => keys.delete("ShiftLeft"));
      document.querySelector("#touch-dash").addEventListener("pointerdown", event => {
        if (!running) return;
        event.preventDefault();
        startDash();
      });
      document.querySelector("#touch-reload").addEventListener("pointerdown", event => {
        if (!running) return;
        event.preventDefault();
        reload();
      });
      document.querySelector("#touch-swap").addEventListener("pointerdown", event => {
        if (!running) return;
        event.preventDefault();
        selectWeapon((player.weaponIndex + 1) % weapons.length);
      });
      document.querySelector("#touch-frag").addEventListener("pointerdown", event => {
        if (!running) return;
        event.preventDefault();
        addGrenade(false);
      });
      document.querySelector("#touch-flash").addEventListener("pointerdown", event => {
        if (!running) return;
        event.preventDefault();
        addGrenade(true);
      });
      canvas.addEventListener("pointerdown", event => {
        if (!running || event.pointerType === "mouse") return;
        event.preventDefault();
        lookPointerId = event.pointerId;
        lastLookX = event.clientX;
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", event => {
        if (event.pointerId !== lookPointerId) return;
        const deltaX = event.clientX - lastLookX;
        lastLookX = event.clientX;
        player.angle += deltaX * .006 * controlSettings.mouseSensitivity *
          (aiming ? (currentWeapon().scoped ? controlSettings.scopeSensitivity : .66) : 1);
        weaponLagX = Math.max(-18, Math.min(18, weaponLagX + deltaX * .12));
      });
      const releaseLook = event => {
        if (event.pointerId === lookPointerId) lookPointerId = null;
      };
      canvas.addEventListener("pointerup", releaseLook);
      canvas.addEventListener("pointercancel", releaseLook);
      canvas.addEventListener("mousedown", event => {
        if (!running) return;
        if (event.button === 2) {
          event.preventDefault();
          aiming = true;
          updateAimHud();
          return;
        }
        if (event.button === 0) {
          firing = true;
          shoot();
        }
      });
      window.addEventListener("mouseup", event => {
        if (event.button === 0) firing = false;
        if (event.button === 2) {
          aiming = false;
          updateAimHud();
        }
      });
      canvas.addEventListener("contextmenu", event => event.preventDefault());
      window.addEventListener("wheel", event => {
        if (!running || event.deltaY === 0) return;
        event.preventDefault();
        const direction = event.deltaY > 0 ? 1 : -1;
        selectWeapon((player.weaponIndex + direction + weapons.length) % weapons.length);
      }, { passive: false });
      window.addEventListener("blur", () => {
        firing = false;
        aiming = false;
        updateAimHud();
        keys.clear();
        resetTouchControls();
      });
      window.addEventListener("mousemove", event => {
        if (running && (document.pointerLockElement === canvas || pointerLockUnavailable)) {
          const sensitivity = .0025 * controlSettings.mouseSensitivity *
            (aiming ? (currentWeapon().scoped ? controlSettings.scopeSensitivity : .66) : 1);
          player.angle += event.movementX * sensitivity;
          weaponLagX = Math.max(-18, Math.min(18, weaponLagX + event.movementX * .12));
        }
      });
      document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement !== canvas && running) pauseGame();
      });
      document.addEventListener("pointerlockerror", () => { pointerLockUnavailable = true; });

      document.querySelector("#overlay").hidden = true;
      document.querySelector("#pause-button").disabled = true;
      document.querySelector("#grenade-count").textContent = grenades;
      document.querySelector("#flash-count").textContent = flashbangs;
      syncSettingsControls();
      resize();
      if ("ResizeObserver" in window) {
        new ResizeObserver(resize).observe(document.querySelector(".stage"));
      }
      requestAnimationFrame(frame);
    })();
