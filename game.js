    (() => {
      "use strict";

      const canvas = document.querySelector("#game");
      const ctx = canvas.getContext("2d", { alpha: false });
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
      const weapons = [
        { name: "ASSAULT RIFLE", short: "RIFLE", magazine: 30, ammo: 30, reserve: 90, damage: 50, spread: .075, interval: .18, reloadTime: 1.15, range: 18, auto: true },
        { name: "PRECISION SNIPER", short: "SNIPER", magazine: 5, ammo: 5, reserve: 25, damage: 100, spread: 0, interval: 1.25, reloadTime: 1.6, range: 22, scoped: true, chamberTime: .72 },
        { name: "BREACH SHOTGUN", short: "SHOTGUN", magazine: 8, ammo: 8, reserve: 40, damage: 100, pellets: 7, spread: .24, interval: .65, reloadTime: 1.4, range: 9 },
        { name: "COMPACT SMG", short: "SMG", magazine: 32, ammo: 32, reserve: 128, damage: 34, spread: .12, interval: .085, reloadTime: 1.1, range: 13, auto: true },
        { name: "COMBAT KNIFE", short: "KNIFE", magazine: 0, ammo: 0, reserve: 0, damage: 100, spread: .6, interval: .48, melee: true }
      ];
      const player = { x: 7.5, y: 7.5, angle: -Math.PI / 2, health: 100, weaponIndex: 0, score: 0 };
      const weaponWeight = [1, 1.9, 1.45, .78, .5];
      const keys = new Set();
      let enemies = [];
      let explosions = [];
      const baseFov = Math.PI / 3;
      let width = 640, height = 360, depth = new Float32Array(width);
      let running = false, gameOver = false, pointerLockUnavailable = false, wave = 0, lastTime = 0;
      let fireCooldown = 0, reloadTimer = 0, hurtFlash = 0, muzzleFlash = 0, hitTimeout = 0;
      let reloadDuration = 0;
      let firing = false, aiming = false, toastTimeout = 0, knifeSwing = 0, movementBob = 0;
      let weaponRecoil = 0, weaponLagX = 0, slideTimer = 0, slideCooldown = 0;
      let slideDirectionX = 0, slideDirectionY = 0;
      const slideDuration = .72;
      let grenadeCooldown = 0, flashbangCooldown = 0, grenadeAnimation = 0, flashbangAnimation = 0;
      let grenades = 2, flashbangs = 1;
      let grenadeFlash = 0, damageMessageTimer = 0, footstepsTimer = 0, audioContext = null, ambientStarted = false;
      const controlSettings = { mouseSensitivity: 1, scopeSensitivity: .44 };
      let settingsReturnToPause = false;
      let reloadKind = "";
      let operatorName = "", selectedMode = "ffa-waves", gameMode = "waves", selectedRoom = null, serverVisibility = "public";
      let rooms = [
        { id: "demo-1", name: "Nightfall Operations", mode: "coop", modeLabel: "CO-OP WAVES", visibility: "public", ping: 38, capacity: 4, players: ["Ranger", "Mako"] },
        { id: "demo-2", name: "1v1 Training Yard", mode: "duel", modeLabel: "1 VS 1", visibility: "public", ping: 52, capacity: 2, players: ["Viper"] },
        { id: "demo-3", name: "Free-for-all Scrim", mode: "ffa", modeLabel: "FREE-FOR-ALL", visibility: "public", ping: 64, capacity: 8, players: ["Echo", "Ghost", "Rook"] }
      ];
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
        document.querySelector("#sensitivity-value").value = `${controlSettings.mouseSensitivity.toFixed(2)}×`;
        document.querySelector("#scope-sensitivity-value").value = `${controlSettings.scopeSensitivity.toFixed(2)}×`;
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

      function renderRooms() {
        const list = document.querySelector("#room-list");
        const desiredMode = selectedMode === "ffa-waves" ? "coop" : selectedMode;
        const visibleRooms = rooms.filter(room => room.visibility === serverVisibility &&
          (serverVisibility === "private" || room.mode === desiredMode));
        list.replaceChildren();
        selectedRoom = null;
        document.querySelector("#join-room-button").disabled = true;
        document.querySelector("#room-details").innerHTML = `<div class="kicker">ROOM DETAILS</div><p>${visibleRooms.length ? "Select a room to see its players and profile cards." : "No demo rooms here yet. Create a private room to try the local lobby."}</p>`;
        if (serverVisibility === "private") {
          document.querySelector("#servers-kicker").textContent = "PRIVATE ROOMS / LOCAL DEMO";
          document.querySelector("#servers-title").textContent = "PRIVATE LOBBY";
          document.querySelector("#create-room-button").hidden = false;
        } else {
          document.querySelector("#servers-kicker").textContent = "PUBLIC ROOMS / DEMO DATA";
          document.querySelector("#servers-title").textContent = "ROOM BROWSER";
          document.querySelector("#create-room-button").hidden = true;
        }
        visibleRooms.forEach(room => {
          const button = document.createElement("button");
          button.className = "room-entry";
          button.type = "button";
          const roomInfo = document.createElement("span");
          const title = document.createElement("strong");
          title.textContent = room.name;
          const summary = document.createElement("span");
          summary.textContent = `${room.modeLabel} · ${room.players.length + 1}/${room.capacity} operators`;
          const ping = document.createElement("span");
          ping.textContent = room.visibility === "private" ? "CODE" : `${room.ping} ms`;
          roomInfo.append(title, summary);
          button.append(roomInfo, ping);
          button.addEventListener("click", () => selectRoom(room, button));
          list.append(button);
        });
      }

      function selectRoom(room, button) {
        selectedRoom = room;
        document.querySelectorAll(".room-entry").forEach(entry => entry.classList.remove("selected"));
        button.classList.add("selected");
        document.querySelector("#join-room-button").disabled = false;
        const details = document.querySelector("#room-details");
        details.replaceChildren();
        const heading = document.createElement("div");
        heading.className = "kicker";
        heading.textContent = room.visibility === "private" ? `PRIVATE ROOM / ${room.code}` : "ROOM DETAILS";
        const title = document.createElement("h2");
        title.textContent = room.name;
        const description = document.createElement("p");
        description.textContent = `${room.modeLabel} · Demo room · ${room.players.length + 1}/${room.capacity} operators`;
        const list = document.createElement("div");
        list.className = "player-list";
        room.players.forEach(name => {
          const profileButton = document.createElement("button");
          profileButton.className = "player-chip";
          profileButton.type = "button";
          profileButton.textContent = name;
          profileButton.addEventListener("click", () => openProfile(name, `${room.modeLabel} demo-room operator`));
          list.append(profileButton);
        });
        const self = document.createElement("button");
        self.className = "player-chip";
        self.type = "button";
        self.textContent = `${operatorName} (you)`;
        self.addEventListener("click", () => openProfile(operatorName, "Your local operator profile"));
        list.append(self);
        details.append(heading, title, description, list);
      }

      function createPrivateRoom() {
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const modeLabels = { "ffa-waves": "CO-OP WAVES", duel: "1 VS 1", ffa: "FREE-FOR-ALL", tdm: "TEAM DEATHMATCH" };
        const mode = selectedMode === "ffa-waves" ? "coop" : selectedMode;
        const room = {
          id: `private-${Date.now()}`, name: `${operatorName}'s private room`, mode, modeLabel: modeLabels[selectedMode],
          visibility: "private", code, capacity: selectedMode === "duel" ? 2 : 8, players: ["RangeBot"]
        };
        rooms.push(room);
        serverVisibility = "private";
        renderRooms();
        const button = [...document.querySelectorAll(".room-entry")].find(entry => entry.textContent.includes(room.name));
        if (button) selectRoom(room, button);
        document.querySelector("#room-message").textContent = `Demo room created · invite code ${code}. Only this browser can see this room.`;
      }

      function openServerBrowser(visibility) {
        serverVisibility = visibility;
        renderRooms();
        document.querySelector("#room-message").textContent = "";
        showMenu(serversMenu);
      }

      function joinSelectedRoom() {
        if (!selectedRoom) return;
        document.querySelector("#room-message").textContent = "Starting local match preview — no other players are connected.";
        gameMode = selectedRoom.mode;
        startGame(gameMode, true);
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

      function currentFov() {
        return aiming && currentWeapon().scoped ? .3 : baseFov;
      }

      function cameraRayAngle(screenX) {
        const normalizedX = screenX / width * 2 - 1;
        return player.angle + Math.atan(normalizedX * Math.tan(currentFov() / 2));
      }

      function projectHorizontal(relativeAngle) {
        return width * (.5 + Math.tan(relativeAngle) / (2 * Math.tan(currentFov() / 2)));
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
        document.querySelector("#ammo").textContent = weapon.melee ? "—" : weapon.ammo;
        document.querySelector("#magazine").textContent = weapon.melee ? "—" : weapon.magazine;
        document.querySelector("#reserve").textContent = weapon.melee ? "—" : String(weapon.reserve).padStart(3, "0");
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
        canvas.width = Math.max(1, Math.floor(bounds.width * pixelRatio));
        canvas.height = Math.max(1, Math.floor(bounds.height * pixelRatio));
        width = canvas.width;
        height = canvas.height;
        depth = new Float32Array(width);
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

      function rayCircleDistance(originX, originY, angle, targetX, targetY, radius) {
        const rayX = Math.cos(angle), rayY = Math.sin(angle);
        const dx = targetX - originX, dy = targetY - originY;
        const along = dx * rayX + dy * rayY;
        if (along <= 0) return Infinity;
        const perpendicularSquared = dx * dx + dy * dy - along * along;
        const radiusSquared = radius * radius;
        if (perpendicularSquared > radiusSquared) return Infinity;
        return along - Math.sqrt(Math.max(0, radiusSquared - perpendicularSquared));
      }

      function cameraHorizon() {
        const slideProgress = slideTimer > 0 ? 1 - slideTimer / slideDuration : 0;
        return height * .48 + Math.sin(slideProgress * Math.PI) * height * .07;
      }

      function renderWorld() {
        const horizon = cameraHorizon();
        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, "#111a17"); sky.addColorStop(1, "#394036");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon);
        const floor = ctx.createLinearGradient(0, horizon, 0, height);
        floor.addColorStop(0, "#35382e"); floor.addColorStop(1, "#111713");
        ctx.fillStyle = floor; ctx.fillRect(0, horizon, width, height - horizon);
        for (let row = horizon + 4; row < height; row += Math.max(4, (row - horizon) * .11)) {
          const opacity = Math.min(.13, (row - horizon) / height * .18);
          ctx.fillStyle = `rgba(190,195,165,${opacity})`;
          ctx.fillRect(0, row, width, Math.max(1, height / (row - horizon) * .45));
        }

        const strip = Math.max(1, Math.floor(width / 400));
        for (let x = 0; x < width; x += strip) {
          const angle = cameraRayAngle(x + strip / 2);
          const ray = castRay(angle);
          const corrected = Math.max(.05, ray.distance * Math.cos(angle - player.angle));
          const wallHeight = Math.min(height * 2, height / corrected);
          const y = horizon - wallHeight / 2;
          const edge = ray.side ? .68 : 1;
          const shade = Math.max(.22, 1 - corrected / 16) * edge;
          const texture = (ray.mapX * 13 + ray.mapY * 7) % 3;
          const colors = [[111, 116, 101], [94, 103, 91], [128, 124, 105]][texture];
          const mortar = ray.wallU < .018 || ray.wallU > .982;
          const surface = mortar ? .53 : 1;
          const light = ctx.createLinearGradient(0, y, 0, y + wallHeight);
          light.addColorStop(0, `rgb(${Math.floor(colors[0] * shade * .62 * surface)},${Math.floor(colors[1] * shade * .62 * surface)},${Math.floor(colors[2] * shade * .62 * surface)})`);
          light.addColorStop(.38, `rgb(${Math.floor(colors[0] * shade * surface)},${Math.floor(colors[1] * shade * surface)},${Math.floor(colors[2] * shade * surface)})`);
          light.addColorStop(1, `rgb(${Math.floor(colors[0] * shade * .68 * surface)},${Math.floor(colors[1] * shade * .68 * surface)},${Math.floor(colors[2] * shade * .68 * surface)})`);
          ctx.fillStyle = light;
          ctx.fillRect(x, y, strip + 1, wallHeight);
          if ((ray.mapX + ray.mapY) % 3 === 0 && ray.wallU > .18 && ray.wallU < .28) {
            ctx.fillStyle = `rgba(13,17,14,${Math.min(.36, .12 + corrected * .012)})`;
            ctx.fillRect(x, y + wallHeight * .17, strip + 1, Math.max(1, wallHeight * .24));
            ctx.fillStyle = `rgba(179,185,158,${.06 * shade})`;
            ctx.fillRect(x, y + wallHeight * .17, strip + 1, Math.max(1, wallHeight * .018));
          }
          if ((ray.mapX * 3 + ray.mapY) % 4 === 0 && ray.wallU > .78 && ray.wallU < .81) {
            ctx.fillStyle = `rgba(14,18,14,${.32 * shade})`;
            ctx.fillRect(x, y + wallHeight * .08, strip + 1, wallHeight * .84);
          }
          if ((ray.mapX + ray.mapY) % 2 === 0) {
            ctx.fillStyle = `rgba(12,16,13,${Math.min(.2, .06 + corrected * .008)})`;
            ctx.fillRect(x, y + wallHeight * .49, strip + 1, Math.max(1, wallHeight * .012));
          }
          for (let column = x; column < Math.min(width, x + strip); column++) depth[column] = corrected;
        }
      }

      function renderEnemies() {
        const ordered = enemies.map(enemy => ({ enemy, distance: Math.hypot(enemy.x - player.x, enemy.y - player.y) }))
          .sort((a, b) => b.distance - a.distance);
        const horizon = cameraHorizon();
        for (const { enemy, distance } of ordered) {
          const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          const relative = Math.atan2(Math.sin(angle - player.angle), Math.cos(angle - player.angle));
          if (Math.abs(relative) > currentFov() / 2 || distance < .2) continue;
          const screenX = projectHorizontal(relative);
          const size = Math.min(height * 1.25, height / distance * .72);
          const centerY = horizon + size * .08 + Math.sin(enemy.phase) * size * .012;
          const left = screenX - size * .22, right = screenX + size * .22;
          const visible = [];
          for (let x = Math.max(0, Math.floor(left)); x < Math.min(width, Math.ceil(right)); x += 2) {
            if (distance < depth[x]) visible.push(x);
          }
          if (!visible.length) continue;
          const shade = Math.max(.35, 1 - distance / 15);
          ctx.save();
          ctx.globalAlpha = shade;
          ctx.fillStyle = "#171b17";
          ctx.beginPath(); ctx.ellipse(screenX, centerY + size * .36, size * .21, size * .055, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#59644c";
          ctx.fillStyle = "#252b25";
          ctx.beginPath();
          ctx.moveTo(screenX - size * .12, centerY + size * .24);
          ctx.lineTo(screenX - size * .075, centerY + size * .42);
          ctx.lineTo(screenX - size * .018, centerY + size * .42);
          ctx.lineTo(screenX - size * .022, centerY + size * .22);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(screenX + size * .025, centerY + size * .22);
          ctx.lineTo(screenX + size * .025, centerY + size * .42);
          ctx.lineTo(screenX + size * .09, centerY + size * .42);
          ctx.lineTo(screenX + size * .13, centerY + size * .24);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#141714";
          ctx.fillRect(screenX - size * .09, centerY + size * .4, size * .08, size * .035);
          ctx.fillRect(screenX + size * .035, centerY + size * .4, size * .09, size * .035);
          const vest = ctx.createLinearGradient(screenX - size * .17, centerY, screenX + size * .18, centerY);
          if (gameMode === "tdm" && enemy.team === 0) {
            vest.addColorStop(0, "#293c42"); vest.addColorStop(.5, "#52747a"); vest.addColorStop(1, "#25353a");
          } else {
            vest.addColorStop(0, "#394036"); vest.addColorStop(.5, "#65705a"); vest.addColorStop(1, "#343b32");
          }
          ctx.fillStyle = vest;
          ctx.beginPath();
          ctx.moveTo(screenX - size * .17, centerY + size * .35);
          ctx.lineTo(screenX - size * .14, centerY + size * .02);
          ctx.lineTo(screenX - size * .1, centerY - size * .08);
          ctx.lineTo(screenX + size * .1, centerY - size * .08);
          ctx.lineTo(screenX + size * .15, centerY + size * .04);
          ctx.lineTo(screenX + size * .19, centerY + size * .35);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#32392f";
          ctx.beginPath();
          ctx.moveTo(screenX - size * .14, centerY - size * .04);
          ctx.lineTo(screenX - size * .22, centerY + size * .2);
          ctx.lineTo(screenX - size * .16, centerY + size * .24);
          ctx.lineTo(screenX - size * .08, centerY + size * .03);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(screenX + size * .14, centerY - size * .04);
          ctx.lineTo(screenX + size * .22, centerY + size * .2);
          ctx.lineTo(screenX + size * .16, centerY + size * .24);
          ctx.lineTo(screenX + size * .08, centerY + size * .03);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#252a24";
          ctx.fillRect(screenX - size * .1, centerY + size * .08, size * .2, size * .16);
          ctx.fillStyle = "#79816b";
          ctx.fillRect(screenX - size * .075, centerY + size * .1, size * .15, size * .018);
          ctx.fillStyle = "#3e4739";
          ctx.fillRect(screenX - size * .035, centerY + size * .12, size * .07, size * .1);
          ctx.fillStyle = "#20241f";
          ctx.fillRect(screenX - size * .18, centerY + size * .18, size * .36, size * .022);
          ctx.fillStyle = "#34392d";
          ctx.beginPath(); ctx.arc(screenX, centerY - size * .15, size * .105, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#222620";
          ctx.fillRect(screenX - size * .09, centerY - size * .25, size * .18, size * .05);
          ctx.fillStyle = gameMode === "tdm" && enemy.team === 0 ? "#91cad4" : "#c1e16d";
          ctx.fillRect(screenX - size * .075, centerY - size * .17, size * .15, Math.max(1, size * .018));
          if (enemy.health < 100) {
            ctx.fillStyle = "#1a211a"; ctx.fillRect(screenX - size * .18, centerY - size * .34, size * .36, Math.max(2, size * .025));
            ctx.fillStyle = "#c1e16d"; ctx.fillRect(screenX - size * .18, centerY - size * .34, size * .36 * enemy.health / 100, Math.max(2, size * .025));
          }
          ctx.restore();
        }
      }

      function renderLights() {
        const horizon = cameraHorizon();
        const visibleLights = overheadLights
          .map(light => ({ ...light, distance: Math.hypot(light.x - player.x, light.y - player.y) }))
          .sort((a, b) => b.distance - a.distance);
        for (const light of visibleLights) {
          const angle = Math.atan2(light.y - player.y, light.x - player.x);
          const relative = Math.atan2(Math.sin(angle - player.angle), Math.cos(angle - player.angle));
          if (Math.abs(relative) > currentFov() / 2 || light.distance < .4) continue;
          if (castRay(angle).distance < light.distance - .35) continue;
          const x = projectHorizontal(relative);
          const size = Math.min(height * .7, height / light.distance * .34);
          const y = horizon - size * .72;
          const fixtureWidth = size * .8;
          const fixtureHeight = Math.max(2, size * .075);
          const glow = ctx.createRadialGradient(x, y, 0, x, y, size * .75);
          glow.addColorStop(0, "rgba(201,211,167,.18)");
          glow.addColorStop(1, "rgba(201,211,167,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(x - size, y - size, size * 2, size * 2);
          ctx.fillStyle = "#20261f";
          ctx.fillRect(x - fixtureWidth * .58, y - fixtureHeight * .55, fixtureWidth * 1.16, fixtureHeight * 1.8);
          ctx.fillStyle = "#c5c9ad";
          ctx.fillRect(x - fixtureWidth / 2, y, fixtureWidth, fixtureHeight);
          ctx.fillStyle = "rgba(240,239,205,.76)";
          ctx.fillRect(x - fixtureWidth * .38, y + fixtureHeight * .2, fixtureWidth * .76, Math.max(1, fixtureHeight * .32));
        }
      }

      function renderExplosions() {
        const horizon = cameraHorizon();
        for (const explosion of explosions) {
          const dx = explosion.x - player.x, dy = explosion.y - player.y;
          const distance = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          const relative = Math.atan2(Math.sin(angle - player.angle), Math.cos(angle - player.angle));
          if (Math.abs(relative) > currentFov() / 2 || distance < .2 ||
            castRay(angle).distance < distance - .25) continue;
          const progress = Math.min(1, explosion.age / explosion.duration);
          const fade = 1 - progress;
          const scale = height / Math.max(1, distance);
          const x = projectHorizontal(relative);
          const y = horizon + scale * .16;
          const radius = Math.max(3, scale * (.12 + progress * .72));
          ctx.save();
          ctx.globalAlpha = fade;
          const smoke = ctx.createRadialGradient(x, y - radius * .25, 1, x, y, radius * 1.4);
          smoke.addColorStop(0, "rgba(255,235,164,.96)");
          smoke.addColorStop(.22, "rgba(255,133,48,.86)");
          smoke.addColorStop(.52, "rgba(89,52,36,.58)");
          smoke.addColorStop(1, "rgba(25,28,25,0)");
          ctx.fillStyle = smoke;
          ctx.beginPath();
          ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255,210,120,${fade * .8})`;
          ctx.lineWidth = Math.max(1, scale * .025);
          ctx.beginPath();
          ctx.ellipse(x, y + radius * .22, radius * (1.1 + progress), radius * .32, 0, 0, Math.PI * 2);
          ctx.stroke();
          for (let spark = 0; spark < 8; spark++) {
            const direction = spark * Math.PI / 4 + explosion.age * (spark % 2 ? 2 : -1);
            const length = radius * (.45 + ((spark * 7) % 4) * .12);
            ctx.strokeStyle = spark % 2 ? `rgba(255,181,75,${fade})` : `rgba(255,238,180,${fade})`;
            ctx.lineWidth = Math.max(1, scale * .018);
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(direction) * radius * .25, y + Math.sin(direction) * radius * .25);
            ctx.lineTo(x + Math.cos(direction) * length, y + Math.sin(direction) * length);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      function renderWeapon() {
        const weapon = currentWeapon();
        if (aiming && weapon.scoped) return;
        const scale = height / 360;
        const weight = weaponWeight[player.weaponIndex];
        const sprinting = !aiming && slideTimer === 0 &&
          (keys.has("ShiftLeft") || keys.has("ShiftRight")) &&
          (keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyA") || keys.has("KeyD"));
        const moving = sprinting || slideTimer > 0 ||
          keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyA") || keys.has("KeyD");
        const sway = Math.sin(performance.now() * (sprinting ? .007 : .004)) * (2.5 + weight) +
          Math.sin(movementBob) * (slideTimer > 0 || sprinting ? 6 : moving ? 2 : .5);
        const recoil = weaponRecoil;
        const reloadProgress = reloadDuration ? 1 - reloadTimer / reloadDuration : 0;
        const reloadDrop = reloadKind === "reload" ? Math.sin(Math.PI * reloadProgress) * 42 : 0;
        const boltMotion = reloadKind === "chamber" ? Math.sin(reloadProgress * Math.PI) * 13 : 0;
        const x = width * (aiming ? .55 : .73) + (sway - weaponLagX * weight) * scale;
        const y = height + 12 * scale + recoil * scale + Math.abs(Math.sin(movementBob)) * (sprinting ? 7 : 2) * scale +
          reloadDrop * scale + (slideTimer > 0 ? height * .045 : sprinting ? height * .012 : 0) -
          (aiming && !weapon.scoped ? height * .04 : 0);
        const polygon = (points, fill, stroke = null) => {
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        };
        const prism = (points, offsetX, offsetY, front, side, top = front) => {
          const shifted = points.map(([px, py]) => [px + offsetX, py + offsetY]);
          polygon([points[1], points[2], shifted[2], shifted[1]], side, "#151915");
          polygon([points[0], points[1], shifted[1], [points[0][0] + offsetX, points[0][1] + offsetY]], top, "#111511");
          polygon(points, front, "#111511");
          polygon([points[0], points[1]], "transparent", "rgba(201,210,191,.48)");
        };
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.rotate(-.14 - weaponLagX * .0012 * weight + (slideTimer > 0 ? .08 : sprinting ? .035 : 0));
        ctx.translate(boltMotion, 0);
        const metal = ctx.createLinearGradient(-55, -190, 43, -30);
        metal.addColorStop(0, "#858b7b");
        metal.addColorStop(.14, "#50574d");
        metal.addColorStop(.48, "#343a33");
        metal.addColorStop(.78, "#51574a");
        metal.addColorStop(1, "#222720");

        ctx.fillStyle = "rgba(0,0,0,.4)";
        ctx.beginPath();
        ctx.ellipse(2, -3, 70, 19, -.08, 0, Math.PI * 2);
        ctx.fill();

        if (weapon.melee) {
          ctx.save();
          ctx.translate(0, -28);
          const slashPhase = 1 - knifeSwing;
          const slashStrength = Math.sin(slashPhase * Math.PI);
          ctx.rotate(-.24 - slashStrength * .85);
          if (slashStrength > .03) {
            ctx.globalAlpha = slashStrength * .8;
            ctx.strokeStyle = "#d9e8d0";
            ctx.lineWidth = 5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(14, -52, 72, -.95, .18);
            ctx.stroke();
            ctx.strokeStyle = "rgba(181,205,169,.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(14, -52, 78, -.83, .08);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          prism([[-8, 8], [9, 6], [14, 43], [-12, 47]], 5, 3, "#343a32", "#171b17", "#646b5b");
          prism([[-5, 3], [-2, -93], [4, -124], [7, 2]], 6, 2, metal, "#252b25", "#b4b8aa");
          polygon([[-3, -114], [1, -127], [4, -122]], "#dce0d4");
          polygon([[-13, 1], [12, -1], [15, 5], [-12, 8]], "#697166", "#272c26");
          for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = "rgba(185,192,178,.34)";
            ctx.beginPath(); ctx.moveTo(-7, 12 + i * 7); ctx.lineTo(7, 10 + i * 7); ctx.stroke();
          }
          ctx.restore();
          ctx.restore();
          return;
        }

        const sniper = player.weaponIndex === 1;
        const compact = player.weaponIndex === 3;
        const shotgun = player.weaponIndex === 2;
        const barrelLength = sniper ? 208 : compact ? 118 : shotgun ? 166 : 156;
        const barrelWidth = shotgun ? 18 : compact ? 12 : 10;

        const sleeve = ctx.createLinearGradient(24, 5, 98, 70);
        sleeve.addColorStop(0, "#3d4639");
        sleeve.addColorStop(.45, "#6a705e");
        sleeve.addColorStop(1, "#252b25");
        polygon([[24, 1], [55, -5], [108, 48], [95, 78], [67, 63], [31, 39]], sleeve, "#20251f");
        polygon([[80, 46], [103, 55], [94, 77], [72, 64]], "#393f35", "#1a1e19");

        if (sniper) {
          prism([[-53, -86], [-42, -111], [3, -105], [5, -81]], 10, 5, "#30362f", "#171b17", "#596052");
          polygon([[-48, -104], [-42, -112], [-1, -107], [-3, -100]], "#707666");
        } else if (compact) {
          prism([[-47, -83], [-37, -96], [-8, -93], [-10, -77]], 8, 4, "#30362e", "#161a16", "#555d4f");
        } else {
          prism([[-53, -88], [-42, -108], [-6, -104], [-8, -82]], 9, 5, "#343a31", "#191d18", "#606655");
        }

        const barrelFront = [[-barrelWidth / 2, -barrelLength + 20], [barrelWidth / 2, -barrelLength + 20], [barrelWidth * .72, -112], [-barrelWidth * .72, -112]];
        prism(barrelFront, 8, 4, metal, "#20251f", "#858b7c");
        polygon([[-barrelWidth * .25, -barrelLength + 24], [barrelWidth * .05, -barrelLength + 24], [barrelWidth * .16, -115], [-barrelWidth * .2, -115]], "rgba(199,205,186,.28)");
        prism([[-barrelWidth * .9, -barrelLength + 7], [barrelWidth * .9, -barrelLength + 7], [barrelWidth * .8, -barrelLength + 23], [-barrelWidth * .8, -barrelLength + 23]], 8, 4, "#1c211d", "#101310", "#62695d");
        ctx.fillStyle = "#101310";
        ctx.beginPath();
        ctx.ellipse(0, -barrelLength + 9, barrelWidth * .85, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#737a6c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -barrelLength + 8, barrelWidth * .56, 2.7, 0, 0, Math.PI * 2);
        ctx.stroke();

        const receiverFront = [[-29, -113], [-19, -137], [22, -131], [29, -99], [22, -51], [-22, -47], [-33, -66]];
        prism(receiverFront, 12, 7, metal, "#1c211c", "#747b6d");
        polygon([[-25, -108], [-17, -128], [13, -124], [19, -106], [16, -98], [-22, -101]], "#252b25", "#121612");
        polygon([[-21, -121], [13, -117], [15, -112], [-23, -116]], "#72796a");
        polygon([[-19, -114], [15, -110], [14, -106], [-20, -110]], "#32382f");
        ctx.strokeStyle = "#909584";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-17, -114); ctx.lineTo(13, -110); ctx.stroke();

        prism([[-11, -66], [9, -64], [15, -12], [-9, -6]], 8, 4, "#282e28", "#121612", "#596052");
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = "rgba(168,175,158,.42)";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-8, -57 + i * 8); ctx.lineTo(8, -55 + i * 8); ctx.stroke();
        }
        prism([[-18, -55], [-7, -54], [-2, -24], [-15, -22]], 4, 3, "#343a32", "#171b17", "#687060");
        ctx.strokeStyle = "#161a16";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(5, -62, 12, Math.PI * .05, Math.PI * .92); ctx.stroke();
        ctx.strokeStyle = "#7b8272";
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(5, -62, 12, Math.PI * .08, Math.PI * .42); ctx.stroke();
        prism([[-22, -145], [21, -140], [23, -132], [-24, -137]], 8, 4, "#20251f", "#121612", "#6a7163");
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i % 2 ? "#242a23" : "#7f8677";
          ctx.fillRect(-16 + i * 8, -144 + i, 3, 5);
        }

        if (sniper) {
          prism([[-10, -169], [10, -167], [11, -144], [-10, -146]], 7, 4, "#252b25", "#111511", "#747b6d");
          prism([[-12, -187], [12, -186], [12, -168], [-12, -169]], 5, 3, "#353c34", "#171b17", "#8b9182");
          ctx.fillStyle = "#121713";
          ctx.beginPath(); ctx.ellipse(0, -178, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#858c7d"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, -178, 5, 5, 0, 0, Math.PI * 2); ctx.stroke();
          polygon([[-10, -187], [10, -186], [7, -189], [-7, -190]], "#a3a996");
        } else if (compact) {
          prism([[-17, -124], [17, -122], [17, -113], [-17, -115]], 7, 3, "#242a23", "#111511", "#767d6f");
          polygon([[-2, -121], [1, -121], [1, -114], [-2, -114]], "#a7ad9e");
        } else if (shotgun) {
          prism([[14, -145], [22, -144], [24, -79], [15, -77]], 5, 3, "#333a31", "#141814", "#858b7b");
          polygon([[14, -81], [24, -79], [22, -69], [12, -72]], "#756c51", "#24271f");
        }

        if (reloadKind === "reload" && reloadProgress > .2 && reloadProgress < .8 && !sniper) {
          const magazineY = -48 + Math.sin(Math.PI * ((reloadProgress - .2) / .6)) * 25;
          prism([[-7, magazineY], [8, magazineY - 2], [11, magazineY + 27], [-9, magazineY + 29]], 4, 3, "#222821", "#111511", "#6a7162");
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = "#89907e";
            ctx.fillRect(-5 + i * 4, magazineY + 5, 2, 15);
          }
        }

        const supportGlove = ctx.createLinearGradient(-65, -44, -15, 1);
        supportGlove.addColorStop(0, "#717765");
        supportGlove.addColorStop(.45, "#464d41");
        supportGlove.addColorStop(1, "#252a24");
        polygon([[-64, -20], [-57, -42], [-36, -53], [-15, -47], [-11, -30], [-25, -14], [-49, -10]], supportGlove, "#1a1e19");
        polygon([[-56, -34], [-39, -43], [-27, -39], [-38, -30], [-54, -24]], "#87907c");
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = "rgba(190,196,177,.42)";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-53, -22 + i * 5); ctx.lineTo(-35, -24 + i * 5); ctx.stroke();
        }

        if (muzzleFlash > 0) {
          const muzzleY = -barrelLength;
          const flash = ctx.createRadialGradient(0, muzzleY, 1, 0, muzzleY, 48);
          flash.addColorStop(0, "#fffbd0");
          flash.addColorStop(.25, "#ffca62");
          flash.addColorStop(1, "rgba(245,125,35,0)");
          ctx.fillStyle = flash;
          ctx.beginPath(); ctx.arc(0, muzzleY, 48, 0, Math.PI * 2); ctx.fill();
          polygon([[0, muzzleY - 8], [-15, muzzleY - 39], [-4, muzzleY - 31], [5, muzzleY - 50], [11, muzzleY - 19], [6, muzzleY - 6]], "#ffe89a");
        }
        ctx.restore();
      }

      function render() {
        renderWorld();
        renderLights();
        renderExplosions();
        renderEnemies();
        renderWeapon();
        if (slideTimer > 0) {
          ctx.save();
          ctx.globalAlpha = .22 * slideTimer / slideDuration;
          ctx.strokeStyle = "#b8c5a5";
          ctx.lineWidth = Math.max(1, width * .0015);
          for (let streak = 0; streak < 7; streak++) {
            const y = height * (.2 + streak * .09);
            ctx.beginPath();
            ctx.moveTo(0, y + height * .035);
            ctx.lineTo(width * .12, y);
            ctx.moveTo(width, y - height * .025);
            ctx.lineTo(width * .88, y);
            ctx.stroke();
          }
          ctx.restore();
        }
        if (grenadeFlash > 0) {
          ctx.fillStyle = `rgba(255,255,235,${grenadeFlash * .72})`;
          ctx.fillRect(0, 0, width, height);
        }
        if (hurtFlash > 0) {
          ctx.fillStyle = `rgba(154,35,27,${hurtFlash * .22})`;
          ctx.fillRect(0, 0, width, height);
        }
        const horizon = cameraHorizon();
        const vignette = ctx.createRadialGradient(width / 2, horizon, height * .2, width / 2, horizon, height * .82);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,.48)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
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
        const pelletCount = weapon.melee ? 7 : weapon.pellets || 1;
        const hits = new Map();
        for (let pellet = 0; pellet < pelletCount; pellet++) {
          const spread = weapon.melee ? .52 : weapon.spread * (aiming ? .45 : 1);
          const shotAngle = player.angle + (pelletCount === 1 ? 0 : (Math.random() - .5) * spread);
          const maxDistance = Math.min(weapon.melee ? 1.8 : weapon.range || 18, castRay(shotAngle).distance - .04);
          const target = enemies
            .filter(enemy => gameMode !== "tdm" || enemy.team === 1)
            .map(enemy => ({
              enemy,
              distance: rayCircleDistance(player.x, player.y, shotAngle, enemy.x, enemy.y, weapon.melee ? .25 : .24)
            }))
            .filter(item => item.distance > 0 && item.distance <= maxDistance)
            .sort((a, b) => a.distance - b.distance)[0];
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

      function startSlide() {
        const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
        const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
        const length = Math.hypot(forward, strafe);
        if (!running || aiming || slideTimer > 0 || slideCooldown > 0 || length === 0 ||
          (!keys.has("ShiftLeft") && !keys.has("ShiftRight"))) return;
        slideDirectionX = (Math.cos(player.angle) * forward + Math.cos(player.angle + Math.PI / 2) * strafe) / length;
        slideDirectionY = (Math.sin(player.angle) * forward + Math.sin(player.angle + Math.PI / 2) * strafe) / length;
        slideTimer = slideDuration;
        slideCooldown = 1.15;
        setCombatMessage("SLIDE", 500);
      }

      function update(dt) {
        fireCooldown = Math.max(0, fireCooldown - dt);
        muzzleFlash = Math.max(0, muzzleFlash - dt);
        knifeSwing = Math.max(0, knifeSwing - dt * 4);
        weaponRecoil = Math.max(0, weaponRecoil - dt * 40);
        weaponLagX *= Math.max(0, 1 - dt * (5 / weaponWeight[player.weaponIndex]));
        slideTimer = Math.max(0, slideTimer - dt);
        slideCooldown = Math.max(0, slideCooldown - dt);
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

        const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
        const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
        const length = Math.hypot(forward, strafe) || 1;
        const moving = forward !== 0 || strafe !== 0 || slideTimer > 0;
        const sprinting = !aiming && slideTimer === 0 &&
          (keys.has("ShiftLeft") || keys.has("ShiftRight")) && (forward !== 0 || strafe !== 0);
        if (moving) {
          movementBob += dt * (slideTimer > 0 ? 16 : sprinting ? 18 : aiming ? 7 : 11);
          footstepsTimer -= dt;
          if (footstepsTimer <= 0) {
            playSound("footstep");
            footstepsTimer = slideTimer > 0 ? .24 : sprinting ? .29 : aiming ? .58 : .38;
          }
        } else {
          movementBob *= Math.max(0, 1 - dt * 5);
        }
        if (slideTimer > 0) {
          const slideSpeed = 5.8 * (.25 + .75 * slideTimer / slideDuration);
          movePlayer(slideDirectionX * slideSpeed * dt, slideDirectionY * slideSpeed * dt);
        } else {
          const speed = (aiming ? 2 : sprinting ? 5.2 : 3.2) * dt;
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
          document.querySelector("#objective").textContent = "Sector clear — next wave inbound";
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
          slideTimer = 0;
          slideCooldown = 0;
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
          ? "Survive incoming waves in a hostile training zone. Aim with your mouse, fire to engage, and keep moving."
          : "Local bot match preview. Public/private rooms are mock lobbies and are not connected to the internet.";
        startButton.textContent = "Deploy";
        document.querySelector("#pause-button").textContent = "Ⅱ Pause";
        document.querySelector("#pause-button").disabled = false;
        document.querySelector("#pause-settings-button").hidden = true;
        returnMenuButton.hidden = true;
        if (wave === 0) spawnWave();
        const pointerLockRequest = canvas.requestPointerLock?.();
        if (pointerLockRequest && typeof pointerLockRequest.catch === "function") {
          pointerLockRequest.catch(() => { pointerLockUnavailable = true; });
        }
      }

      function pauseGame() {
        if (!running || gameOver) return;
        running = false;
        firing = false;
        aiming = false;
        slideTimer = 0;
        keys.clear();
        overlay.hidden = false;
        updateAimHud();
        document.querySelector("#pause-settings-button").hidden = false;
        document.querySelector("#overlay-kicker").textContent = "SIMULATION PAUSED";
        document.querySelector("#overlay-title").innerHTML = "REGROUP<br>AND REDEPLOY";
        document.querySelector("#overlay-copy").textContent = "The perimeter is waiting. Resume when you are ready.";
        startButton.textContent = "Resume";
        returnMenuButton.hidden = false;
        document.querySelector("#pause-button").textContent = "▶ Resume";
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
          error.textContent = "Use 2–16 letters, numbers, spaces, underscores, or hyphens.";
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
      document.querySelector("#public-servers-button").addEventListener("click", () => openServerBrowser("public"));
      document.querySelector("#private-servers-button").addEventListener("click", () => openServerBrowser("private"));
      document.querySelector("#create-room-button").addEventListener("click", createPrivateRoom);
      document.querySelector("#join-room-button").addEventListener("click", joinSelectedRoom);
      document.querySelector("#back-to-modes").addEventListener("click", () => showMenu(multiplayerMenu));
      document.querySelectorAll("[data-back='main-menu']").forEach(button => button.addEventListener("click", () => showMenu(mainMenu)));
      document.querySelector("#close-profile-modal").addEventListener("click", () => showMenu(profileReturnScreen));
      document.querySelector("#profile-card-close").addEventListener("click", () => showMenu(profileReturnScreen));
      returnMenuButton.addEventListener("click", () => {
        gameOver = false;
        document.querySelector("#pause-button").textContent = "Ⅱ Pause";
        showMenu(mainMenu);
      });
      startButton.addEventListener("click", () => startGame(gameMode, gameOver));
      document.querySelector("#pause-button").addEventListener("click", () => {
        if (running) pauseGame();
        else if (!gameOver && overlay.hidden === false) startGame(gameMode, false);
      });
      document.querySelectorAll(".weapon-slot").forEach(button => {
        button.addEventListener("click", () => {
          if (running) selectWeapon(Number(button.dataset.weapon));
        });
      });
      window.addEventListener("resize", resize);
      window.addEventListener("keydown", event => {
        keys.add(event.code);
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
        if (event.code === "Escape") {
          event.preventDefault();
          if (running) pauseGame();
          return;
        }
        if (!running || event.repeat) return;
        if (event.code === "KeyR") reload();
        if (event.code === "KeyG") addGrenade(false);
        if (event.code === "KeyF") addGrenade(true);
        if (event.code === "KeyC") startSlide();
        if (event.code.startsWith("Digit")) {
          const index = Number(event.code.slice(5)) - 1;
          selectWeapon(index);
        }
      });
      window.addEventListener("keyup", event => keys.delete(event.code));
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
      requestAnimationFrame(frame);
    })();
  