// game.js - Guyem Runner Engine (Supporting Slide 13 Interruption & Slide 14 Gentle Modes)
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const GROUND_Y = 430;
const TOTAL_RUN_DURATION = 46; // seconds

const HIGH_WORDS = [
  "Одоохон утсаа тавь!",
  "Хичээлээ хийгээч ээ!",
  "Хэнтэй чатлаад байгаа юм?",
  "Наад тоглоомоо унтраа!",
  "Утаснаас салахгүй юм!",
  "Нүд чинь өвдлөө!"
];

const LOW_WORDS = [
  "Залхуу!",
  "Битгий тоглоод бай!",
  "Гэрээ цэвэрлэ!",
  "Цагаа хар!",
  "Ахиад л тоглоом уу?!",
  "Юугаа гөлрөөд байгаа юм!"
];

const GENTLE_WORDS = [
  "Хичээгээрэй! ❤️",
  "Хайртай шүү! ✨",
  "Амжилт! 🌟",
  "Бариа ойртлоо! 🏃",
  "Миний хүү чадна! 💫"
];

class GuyemGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // Mode: 'interrupt' (Slide 13) or 'gentle' (Slide 14)
    const urlParams = new URLSearchParams(window.location.search);
    this.mode = urlParams.get("mode") === "gentle" ? "gentle" : "interrupt";

    this.state = "INTRO";
    this.score = 0;
    this.hearts = 3;
    this.elapsedTime = 0;
    this.gameSpeed = 330;

    this.reminderTriggered = false;

    // Player (Guyem)
    this.guyem = {
      x: 140,
      y: GROUND_Y - 110,
      width: 110,
      height: 110,
      vy: 0,
      gravity: 1900,
      jumpImpulse: -750,
      isGrounded: true,
      isSliding: false,
      slideTimer: 0,
      invulnerableTimer: 0,
      runAnimTimer: 0
    };

    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.confetti = [];
    this.spawnTimer = 1.2;

    this.parents = {
      active: false,
      x: CANVAS_WIDTH + 100,
      y: GROUND_Y - 150,
      width: 150,
      height: 150
    };

    this.bgX = 0;
    this.assets = {};
    this.assetsLoaded = false;
    this.lastTime = 0;
    this.screenShakeTime = 0;

    this.initCanvasSize();
    this.bindEvents();
    this.loadAssets();
    this.updateModeUI();
  }

  initCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = CANVAS_WIDTH * dpr;
    this.canvas.height = CANVAS_HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);

    window.addEventListener("resize", () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = CANVAS_WIDTH * d;
      this.canvas.height = CANVAS_HEIGHT * d;
      this.ctx.scale(d, d);
    });
  }

  loadAssets() {
    const list = [
      { key: "bg", src: "assets/background.jpg" },
      { key: "guyemRun", src: "assets/guyem_run.png" },
      { key: "guyemJump", src: "assets/guyem_jump.png" },
      { key: "guyemSlide", src: "assets/guyem_slide.png" },
      { key: "parents", src: "assets/parents.png" },
      { key: "parentsHappy", src: "assets/parents_happy.png" },
      { key: "familyHug", src: "assets/family_hug.png" },
      { key: "bullet", src: "assets/word_bullet.png" }
    ];

    let loaded = 0;
    list.forEach(item => {
      const img = new Image();
      img.src = item.src;
      img.onload = () => {
        this.assets[item.key] = img;
        loaded++;
        if (loaded === list.length) {
          this.assetsLoaded = true;
          console.log("All game assets loaded!");
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === list.length) this.assetsLoaded = true;
      };
    });
  }

  updateModeUI() {
    const tabInterrupt = document.getElementById("tab-interrupt");
    const tabGentle = document.getElementById("tab-gentle");
    if (tabInterrupt && tabGentle) {
      tabInterrupt.classList.toggle("active", this.mode === "interrupt");
      tabGentle.classList.toggle("active", this.mode === "gentle");
    }

    const modeSubtitle = document.getElementById("mode-subtitle");
    if (modeSubtitle) {
      if (this.mode === "interrupt") {
        modeSubtitle.textContent = "🔴 1-р Туршилт: Слайд 13 (Гэнэт таслах үеийн мэдрэмж)";
      } else {
        modeSubtitle.textContent = "🟢 2-р Туршилт: Слайд 14 (Урьдчилан сануулж, тэврэлдэх)";
      }
    }
  }

  setMode(newMode) {
    this.mode = newMode;
    this.updateModeUI();
  }

  bindEvents() {
    // Mode tabs
    const tabInterrupt = document.getElementById("tab-interrupt");
    const tabGentle = document.getElementById("tab-gentle");
    if (tabInterrupt) tabInterrupt.addEventListener("click", () => this.setMode("interrupt"));
    if (tabGentle) tabGentle.addEventListener("click", () => this.setMode("gentle"));

    // Start
    document.getElementById("btn-start").addEventListener("click", () => {
      document.getElementById("intro-modal").style.display = "none";
      this.startCountdown();
    });

    // Sound toggle
    document.getElementById("btn-sound").addEventListener("click", () => {
      const isMuted = window.soundManager.toggleMute();
      document.getElementById("btn-sound").textContent = isMuted ? "🔇" : "🔊";
    });

    // Fullscreen toggle
    document.getElementById("btn-fullscreen").addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Restart buttons
    const restartHandler = () => {
      document.getElementById("reflection-modal").classList.remove("active");
      document.getElementById("victory-overlay").classList.remove("active");
      document.getElementById("interruption-overlay").classList.remove("active");
      document.getElementById("reminder-banner").classList.remove("active");
      this.restartGame();
    };

    document.getElementById("btn-restart").addEventListener("click", restartHandler);
    const btnRestartVictory = document.getElementById("btn-restart-victory");
    if (btnRestartVictory) btnRestartVictory.addEventListener("click", restartHandler);

    // Touch control buttons
    const btnJump = document.getElementById("btn-jump");
    const btnSlide = document.getElementById("btn-slide");

    const doJump = (e) => {
      if (e) e.preventDefault();
      btnJump.classList.add("active");
      this.handleJump();
    };
    const endJump = () => btnJump.classList.remove("active");

    const doSlide = (e) => {
      if (e) e.preventDefault();
      btnSlide.classList.add("active");
      this.handleSlide();
    };
    const endSlide = () => btnSlide.classList.remove("active");

    btnJump.addEventListener("touchstart", doJump, { passive: false });
    btnJump.addEventListener("touchend", endJump);
    btnJump.addEventListener("mousedown", doJump);
    btnJump.addEventListener("mouseup", endJump);

    btnSlide.addEventListener("touchstart", doSlide, { passive: false });
    btnSlide.addEventListener("touchend", endSlide);
    btnSlide.addEventListener("mousedown", doSlide);
    btnSlide.addEventListener("mouseup", endSlide);

    // Swipe & Screen Tap
    let touchStartY = 0;
    let touchStartX = 0;
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    this.canvas.addEventListener("touchend", (e) => {
      if (e.changedTouches.length > 0) {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaY) > 30) {
          if (deltaY < -30) this.handleJump();
          else if (deltaY > 30) this.handleSlide();
        } else {
          const rect = this.canvas.getBoundingClientRect();
          const relY = (touchStartY - rect.top) / rect.height;
          if (relY < 0.55) this.handleJump();
          else this.handleSlide();
        }
      }
    }, { passive: true });

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        this.handleJump();
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        this.handleSlide();
      }
    });
  }

  handleJump() {
    if (this.state !== "PLAYING") return;
    if (this.guyem.isGrounded && !this.guyem.isSliding) {
      this.guyem.vy = this.guyem.jumpImpulse;
      this.guyem.isGrounded = false;
      window.soundManager.playJump();
      if (navigator.vibrate) navigator.vibrate(25);
      this.createDustParticles(this.guyem.x + 30, GROUND_Y, 8, "#d97706");
    }
  }

  handleSlide() {
    if (this.state !== "PLAYING") return;
    if (this.guyem.isGrounded && !this.guyem.isSliding) {
      this.guyem.isSliding = true;
      this.guyem.slideTimer = 0.72;
      this.guyem.height = 60;
      this.guyem.y = GROUND_Y - 60;
      window.soundManager.playSlide();
      if (navigator.vibrate) navigator.vibrate(20);
      this.createDustParticles(this.guyem.x + 50, GROUND_Y, 6, "#06b6d4");
    }
  }

  startCountdown() {
    this.state = "COUNTDOWN";
    const overlay = document.getElementById("countdown-overlay");
    overlay.style.display = "flex";
    const numEl = overlay.querySelector(".countdown-number");

    let count = 3;
    const tick = () => {
      if (count > 0) {
        numEl.textContent = count;
        numEl.style.animation = "none";
        void numEl.offsetWidth;
        numEl.style.animation = "countPulse 0.85s ease-out forwards";
        window.soundManager.playBeep(false);
        count--;
        setTimeout(tick, 900);
      } else {
        numEl.textContent = "ГҮЙГЭЭРЭЙ!";
        numEl.style.animation = "none";
        void numEl.offsetWidth;
        numEl.style.animation = "countPulse 0.85s ease-out forwards";
        window.soundManager.playBeep(true);
        setTimeout(() => {
          overlay.style.display = "none";
          this.startGame();
        }, 800);
      }
    };
    tick();
  }

  startGame() {
    this.state = "PLAYING";
    this.score = 0;
    this.hearts = 3;
    this.elapsedTime = 0;
    this.gameSpeed = 340;
    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.confetti = [];
    this.spawnTimer = 1.0;
    this.reminderTriggered = false;
    this.parents.active = false;
    this.lastTime = performance.now();
    this.updateHeartsUI();

    window.soundManager.startBGM();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  restartGame() {
    this.startCountdown();
  }

  gameLoop(currentTime) {
    if (this.state !== "PLAYING") return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    this.elapsedTime += dt;
    this.score += Math.floor(dt * 30);
    document.getElementById("score-text").textContent = String(this.score).padStart(5, "0");

    this.gameSpeed = 340 + (this.elapsedTime / TOTAL_RUN_DURATION) * 140;

    const progressPct = Math.min((this.elapsedTime / TOTAL_RUN_DURATION) * 100, 95);
    document.getElementById("progress-fill").style.width = `${progressPct}%`;
    document.getElementById("runner-icon").style.left = `${progressPct}%`;
    document.getElementById("distance-text").textContent = `${Math.floor(progressPct)}%`;

    if (this.screenShakeTime > 0) this.screenShakeTime -= dt;

    this.bgX = (this.bgX - this.gameSpeed * 0.45 * dt) % CANVAS_WIDTH;
    this.updateGuyem(dt);

    // MODE 2 (GENTLE): 13 seconds before end -> Gentle voice reminder!
    if (this.mode === "gentle" && !this.reminderTriggered && this.elapsedTime >= TOTAL_RUN_DURATION - 13) {
      this.reminderTriggered = true;
      this.triggerGentleReminder();
    }

    // Spawn Parents entity near climax
    if (this.elapsedTime >= TOTAL_RUN_DURATION - 4.5 && !this.parents.active) {
      this.parents.active = true;
      this.parents.x = CANVAS_WIDTH + 80;
    }

    if (this.parents.active) {
      this.parents.x -= this.gameSpeed * dt;

      // When Guyem reaches parents
      if (this.parents.x <= this.guyem.x + 90) {
        if (this.mode === "interrupt") {
          this.triggerInterruptionClimax();
        } else {
          this.triggerVictoryHug();
        }
        return;
      }
    } else {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        this.spawnTimer = 1.3 + Math.random() * 0.9;
      }
    }

    this.updateObstacles(dt);
    this.updateParticles(dt);
  }

  updateGuyem(dt) {
    const g = this.guyem;

    if (!g.isGrounded) {
      g.vy += g.gravity * dt;
      g.y += g.vy * dt;

      if (g.y >= GROUND_Y - g.height) {
        g.y = GROUND_Y - g.height;
        g.vy = 0;
        g.isGrounded = true;
        this.createDustParticles(g.x + 30, GROUND_Y, 5, "#f59e0b");
      }
    }

    if (g.isSliding) {
      g.slideTimer -= dt;
      if (Math.random() < 0.4) {
        this.createDustParticles(g.x + 40, GROUND_Y, 2, "#67e8f9");
      }
      if (g.slideTimer <= 0) {
        g.isSliding = false;
        g.height = 110;
        g.y = GROUND_Y - 110;
      }
    }

    if (g.isGrounded && !g.isSliding) {
      g.runAnimTimer += dt;
      if (Math.random() < 0.25) {
        this.createDustParticles(g.x + 20, GROUND_Y, 1, "#e2e8f0");
      }
    }

    if (g.invulnerableTimer > 0) g.invulnerableTimer -= dt;
  }

  spawnObstacle() {
    // In gentle mode after reminder, spawn sweet encouraging words
    if (this.mode === "gentle" && this.reminderTriggered) {
      const text = GENTLE_WORDS[Math.floor(Math.random() * GENTLE_WORDS.length)];
      this.obstacles.push({
        x: CANVAS_WIDTH + 20,
        y: GROUND_Y - 100,
        width: 170 + text.length * 6,
        height: 54,
        isHigh: false,
        text: text,
        passed: false,
        isGentle: true
      });
      return;
    }

    const isHigh = Math.random() > 0.48;
    const text = isHigh
      ? HIGH_WORDS[Math.floor(Math.random() * HIGH_WORDS.length)]
      : LOW_WORDS[Math.floor(Math.random() * LOW_WORDS.length)];

    const width = 170 + text.length * 6;
    const height = 54;
    const y = isHigh ? GROUND_Y - 140 : GROUND_Y - 54;

    this.obstacles.push({
      x: CANVAS_WIDTH + 20,
      y: y,
      width: width,
      height: height,
      isHigh: isHigh,
      text: text,
      passed: false
    });
  }

  updateObstacles(dt) {
    const g = this.guyem;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.gameSpeed * dt;

      if (!obs.isGentle && g.invulnerableTimer <= 0 && this.checkCollision(g, obs)) {
        this.handleHit(obs);
      }

      if (!obs.passed && obs.x + obs.width < g.x) {
        obs.passed = true;
        this.score += 100;
        const rewardText = obs.isGentle ? "Баярлалаа! ❤️" : "+100! Сайн!";
        this.createFloatingText(g.x + 50, g.y - 10, rewardText, obs.isGentle ? "#ec4899" : "#ffd700");
        window.soundManager.playDodge();
      }

      if (obs.x + obs.width < -100) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  checkCollision(guyem, obs) {
    const margin = 12;
    const gx = guyem.x + margin;
    const gy = guyem.y + margin;
    const gw = (guyem.isSliding ? 130 : guyem.width) - margin * 2;
    const gh = guyem.height - margin * 2;

    const ox = obs.x + 10;
    const oy = obs.y + 6;
    const ow = obs.width - 20;
    const oh = obs.height - 12;

    return (
      gx < ox + ow &&
      gx + gw > ox &&
      gy < oy + oh &&
      gy + gh > oy
    );
  }

  handleHit(obs) {
    this.guyem.invulnerableTimer = 1.4;
    this.screenShakeTime = 0.25;
    window.soundManager.playHurt();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    this.hearts = Math.max(0, this.hearts - 1);
    this.updateHeartsUI();

    this.createFloatingText(this.guyem.x + 30, this.guyem.y - 20, "Овой!", "#ef4444");
    this.createDustParticles(this.guyem.x + 50, this.guyem.y + 50, 12, "#ef4444");

    if (this.hearts === 0) {
      setTimeout(() => {
        this.hearts = 1;
        this.updateHeartsUI();
        this.createFloatingText(this.guyem.x + 40, this.guyem.y - 30, "Үргэлжлүүл! 🛡️", "#38bdf8");
      }, 1000);
    }
  }

  updateHeartsUI() {
    const heartEls = document.querySelectorAll(".heart");
    heartEls.forEach((el, idx) => {
      el.classList.toggle("lost", idx >= this.hearts);
    });
  }

  createDustParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() * 20 - 10),
        y: y - Math.random() * 8,
        vx: -(this.gameSpeed * 0.3) + (Math.random() * 60 - 30),
        vy: -(Math.random() * 70 + 20),
        radius: Math.random() * 4 + 2,
        color: color,
        alpha: 1.0,
        decay: Math.random() * 2.5 + 1.8
      });
    }
  }

  createFloatingText(x, y, text, color = "#ffd700") {
    this.floatingTexts.push({
      x: x,
      y: y,
      text: text,
      color: color,
      alpha: 1.0,
      vy: -60
    });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.2;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  // --- SLIDE 14: GENTLE REMINDER TOAST & AUDIO ---
  triggerGentleReminder() {
    const banner = document.getElementById("reminder-banner");
    banner.classList.add("active");
    window.soundManager.playGentleReminder(() => {
      setTimeout(() => banner.classList.remove("active"), 3500);
    });
  }

  // --- SLIDE 13: SUDDEN ABRUPT CUTOFF CLIMAX ---
  triggerInterruptionClimax() {
    this.state = "INTERRUPTED";
    if (navigator.vibrate) navigator.vibrate([400, 120, 400, 120, 800]);

    window.soundManager.triggerInterruption(() => {
      setTimeout(() => this.showReflectionModal(), 500);
    });

    const overlay = document.getElementById("interruption-overlay");
    overlay.classList.add("active");

    setTimeout(() => {
      if (this.state === "INTERRUPTED") this.showReflectionModal();
    }, 4200);
  }

  // --- SLIDE 14: FAMILY HUG VICTORY ---
  triggerVictoryHug() {
    this.state = "VICTORY";
    window.soundManager.stopBGM();
    window.soundManager.playVictoryFanfare();
    if (navigator.vibrate) navigator.vibrate([100, 100, 100, 100, 300]);

    const overlay = document.getElementById("victory-overlay");
    overlay.classList.add("active");
  }

  showReflectionModal() {
    this.state = "REFLECTION";
    document.getElementById("interruption-overlay").classList.remove("active");
    document.getElementById("reflection-modal").classList.add("active");
  }

  // --- Rendering Pipeline ---
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    if (this.screenShakeTime > 0) {
      const shakeAmt = 8;
      ctx.translate((Math.random() * 2 - 1) * shakeAmt, (Math.random() * 2 - 1) * shakeAmt);
    }

    // 1. Background
    if (this.assets.bg) {
      ctx.drawImage(this.assets.bg, this.bgX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(this.assets.bg, this.bgX + CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#eab308";
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    }

    // 2. Parents Target Entity
    if (this.parents.active) {
      ctx.save();
      const parentSprite = (this.mode === "gentle")
        ? (this.assets.parentsHappy || this.assets.parents)
        : this.assets.parents;

      if (parentSprite) {
        ctx.drawImage(parentSprite, this.parents.x, this.parents.y, this.parents.width, this.parents.height);
      }

      ctx.fillStyle = this.mode === "gentle" ? "rgba(16, 185, 129, 0.95)" : "rgba(239, 68, 68, 0.95)";
      ctx.beginPath();
      ctx.roundRect(this.parents.x - 30, this.parents.y - 30, 210, 32, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.mode === "gentle" ? "БАРИА! ХАЙРТ ААВ ЭЭЖ ❤️" : "БАРИА! ААВ ЭЭЖ ⚠️", this.parents.x + 75, this.parents.y - 9);
      ctx.restore();
    }

    // 3. Obstacles
    this.renderObstacles(ctx);

    // 4. Guyem Character
    this.renderGuyem(ctx);

    // 5. Particles
    this.renderParticles(ctx);

    ctx.restore();
  }

  renderGuyem(ctx) {
    const g = this.guyem;
    ctx.save();

    if (g.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    let sprite = this.assets.guyemRun;
    let drawW = g.width;
    let drawH = g.height;
    let drawX = g.x;
    let drawY = g.y;

    if (!g.isGrounded) {
      sprite = this.assets.guyemJump || this.assets.guyemRun;
      ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
      ctx.rotate(-0.08);
      ctx.translate(-(drawX + drawW / 2), -(drawY + drawH / 2));
    } else if (g.isSliding) {
      sprite = this.assets.guyemSlide || this.assets.guyemRun;
      drawW = 140;
      drawH = 65;
      drawY = GROUND_Y - 65;
    } else {
      drawY += Math.sin(g.runAnimTimer * 18) * 4;
    }

    if (sprite) {
      ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
    } else {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(drawX, drawY, drawW, drawH);
    }

    ctx.restore();
  }

  renderObstacles(ctx) {
    this.obstacles.forEach((obs) => {
      ctx.save();

      if (obs.isGentle) {
        ctx.fillStyle = "rgba(236, 72, 153, 0.9)";
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 20);
        ctx.fill();
        ctx.strokeStyle = "#fbcfe8";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (this.assets.bullet) {
        ctx.drawImage(this.assets.bullet, obs.x, obs.y, obs.width, obs.height);
      } else {
        ctx.fillStyle = obs.isHigh ? "#ef4444" : "#f59e0b";
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 16);
        ctx.fill();
      }

      ctx.font = "900 14px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeText(obs.text, obs.x + obs.width / 2 + 5, obs.y + obs.height / 2);

      ctx.fillStyle = obs.isGentle ? "#831843" : "#5c1300";
      ctx.fillText(obs.text, obs.x + obs.width / 2 + 5, obs.y + obs.height / 2);

      ctx.restore();
    });
  }

  renderParticles(ctx) {
    this.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = "800 16px -apple-system, sans-serif";
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.game = new GuyemGame();
});
