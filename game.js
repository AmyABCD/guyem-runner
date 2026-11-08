// game.js - Guyem Runner Engine
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const GROUND_Y = 430;
const TOTAL_RUN_DURATION = 42;

const HIGH_WORDS = [
  "Наадхаа унтраа!",
  "Хэнтэй чатлаад бна?",
  "Утаснаас сал!",
  "Нүд өвдлөө!",
  "Одоохон тавь!"
];

const LOW_WORDS = [
  "Залхуу!",
  "Утсаа тавь!",
  "Цагаа хар!",
  "Болиоч ээ!",
  "Хичээлээ хий!"
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

    const urlParams = new URLSearchParams(window.location.search);
    this.mode = urlParams.get("mode") === "gentle" ? "gentle" : "interrupt";

    this.state = "INTRO";
    this.score = 0;
    this.hearts = 5;
    this.elapsedTime = 0;
    this.gameSpeed = 330;
    this.reminderTriggered = false;

    // Player (Guyem) - Tuned Jump & Slide Physics
    this.guyem = {
      x: 140,
      y: GROUND_Y - 110,
      width: 110,
      height: 110,
      vy: 0,
      gravity: 1250,      // Soft, floaty gravity
      jumpImpulse: -800,  // Floaty high jump (clears any obstacle cleanly)
      isGrounded: true,
      isSliding: false,
      slideTimer: 0,
      invulnerableTimer: 0,
      runAnimTimer: 0
    };

    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnTimer = 1.4;

    this.parents = {
      active: false,
      x: CANVAS_WIDTH + 50,
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
        if (loaded === list.length) this.assetsLoaded = true;
      };
      img.onerror = () => {
        loaded++;
        if (loaded === list.length) this.assetsLoaded = true;
      };
    });
  }

  bindEvents() {
    document.getElementById("btn-start").addEventListener("click", () => {
      document.getElementById("intro-modal").style.display = "none";
      this.startCountdown();
    });

    document.getElementById("btn-sound").addEventListener("click", () => {
      const isMuted = window.soundManager.toggleMute();
      document.getElementById("btn-sound").textContent = isMuted ? "🔇" : "🔊";
    });

    document.getElementById("btn-fullscreen").addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

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

    let touchStartY = 0;
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) touchStartY = e.touches[0].clientY;
    }, { passive: true });

    this.canvas.addEventListener("touchend", (e) => {
      if (e.changedTouches.length > 0) {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (deltaY < -30) this.handleJump();
        else if (deltaY > 30) this.handleSlide();
        else {
          const rect = this.canvas.getBoundingClientRect();
          const relY = (touchStartY - rect.top) / rect.height;
          if (relY < 0.55) this.handleJump();
          else this.handleSlide();
        }
      }
    }, { passive: true });

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
      this.guyem.slideTimer = 1.1; // 1.1s generous slide time
      this.guyem.height = 45;      // very low profile
      this.guyem.y = GROUND_Y - 45;
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
        window.soundManager.playBeep(false);
        count--;
        setTimeout(tick, 900);
      } else {
        numEl.textContent = "ГҮЙГЭЭРЭЙ!";
        window.soundManager.playBeep(true);
        setTimeout(() => {
          overlay.style.display = "none";
          this.startGame();
        }, 750);
      }
    };
    tick();
  }

  startGame() {
    this.state = "PLAYING";
    this.score = 0;
    this.hearts = 5;
    this.elapsedTime = 0;
    this.gameSpeed = 340;
    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnTimer = 1.4;
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

    this.gameSpeed = 340 + (this.elapsedTime / TOTAL_RUN_DURATION) * 120;

    const progressPct = Math.min((this.elapsedTime / TOTAL_RUN_DURATION) * 100, 95);
    document.getElementById("progress-fill").style.width = `${progressPct}%`;
    document.getElementById("runner-icon").style.left = `${progressPct}%`;
    document.getElementById("distance-text").textContent = `${Math.floor(progressPct)}%`;

    if (this.screenShakeTime > 0) this.screenShakeTime -= dt;

    this.bgX = (this.bgX - this.gameSpeed * 0.45 * dt) % CANVAS_WIDTH;
    this.updateGuyem(dt);

    const targetX = 120 + (this.elapsedTime / TOTAL_RUN_DURATION) * 110;
    this.guyem.x += (targetX - this.guyem.x) * dt * 2.0;

    // SLIDE 14: Gentle reminder 12 seconds before end
    if (this.mode === "gentle" && !this.reminderTriggered && this.elapsedTime >= TOTAL_RUN_DURATION - 12) {
      this.reminderTriggered = true;
      this.triggerGentleReminder();
    }

    // End approach: Parents appear on right edge of screen (~40s in)
    if (this.elapsedTime >= TOTAL_RUN_DURATION - 2.5 && !this.parents.active) {
      this.parents.active = true;
      this.parents.x = CANVAS_WIDTH - 130;

      // IN INTERRUPT MODE (Slide 13):
      // The user requested: "огт хүрээгүй байхад нь, утасны захад гарч ирэхэд нь шууд зогсоомоор байна"
      if (this.mode === "interrupt") {
        setTimeout(() => this.triggerInterruptionClimax(), 350);
        return;
      }
    }

    if (this.parents.active && this.mode === "gentle") {
      this.parents.x -= this.gameSpeed * 0.5 * dt;
      if (this.parents.x <= this.guyem.x + 90) {
        this.triggerVictoryHug();
        return;
      }
    } else if (!this.parents.active) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        this.spawnTimer = 1.4 + Math.random() * 0.8;
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
    if (this.mode === "gentle" && this.reminderTriggered) {
      const text = GENTLE_WORDS[Math.floor(Math.random() * GENTLE_WORDS.length)];
      this.obstacles.push({
        x: CANVAS_WIDTH + 20,
        y: GROUND_Y - 110,
        width: 150,
        height: 48,
        isHigh: false,
        text: text,
        passed: false,
        isGentle: true
      });
      return;
    }

    const isHigh = Math.random() > 0.5;
    const text = isHigh
      ? HIGH_WORDS[Math.floor(Math.random() * HIGH_WORDS.length)]
      : LOW_WORDS[Math.floor(Math.random() * LOW_WORDS.length)];

    const width = 140;
    const height = 44;
    // High arrow is way up at GROUND_Y - 165 (80px clearance over sliding player)
    // Low arrow is down at GROUND_Y - 44 (huge clearance over jumping player)
    const y = isHigh ? GROUND_Y - 165 : GROUND_Y - 44;

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
    const margin = 14;
    const gx = guyem.x + margin;
    const gy = guyem.y + margin;
    const gw = (guyem.isSliding ? 120 : guyem.width) - margin * 2;
    const gh = guyem.height - margin * 2;

    const ox = obs.x + 8;
    const oy = obs.y + 4;
    const ow = obs.width - 16;
    const oh = obs.height - 8;

    return (
      gx < ox + ow &&
      gx + gw > ox &&
      gy < oy + oh &&
      gy + gh > oy
    );
  }

  handleHit(obs) {
    this.guyem.invulnerableTimer = 1.8;
    this.screenShakeTime = 0.25;
    window.soundManager.playHurt();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    this.hearts = Math.max(0, this.hearts - 1);
    this.updateHeartsUI();

    this.createFloatingText(this.guyem.x + 30, this.guyem.y - 20, "Овой! -1 ❤️", "#ef4444");
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

  triggerGentleReminder() {
    const banner = document.getElementById("reminder-banner");
    banner.classList.add("active");
    window.soundManager.playGentleReminder(() => {
      setTimeout(() => banner.classList.remove("active"), 3500);
    });
  }

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
      ctx.restore();
    }

    // 3. Obstacles (Razor-Sharp Speech Bubbles)
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

    if (g.invulnerableTimer > 0) {
      ctx.globalAlpha = Math.floor(Date.now() / 70) % 2 === 0 ? 0.35 : 0.85;
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
      drawH = 45;
      drawY = GROUND_Y - 45;
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

      // Sharp, crystal-clear speech bubble with pointing arrow
      ctx.fillStyle = obs.isGentle ? "#fdf2f8" : "#fef08a";
      ctx.strokeStyle = obs.isGentle ? "#db2777" : "#991b1b";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.roundRect(obs.x + 8, obs.y, obs.width - 8, obs.height, 12);
      ctx.fill();
      ctx.stroke();

      // Left arrow pointer
      ctx.beginPath();
      ctx.moveTo(obs.x + 10, obs.y + obs.height / 2 - 8);
      ctx.lineTo(obs.x - 2, obs.y + obs.height / 2);
      ctx.lineTo(obs.x + 10, obs.y + obs.height / 2 + 8);
      ctx.closePath();
      ctx.fillStyle = obs.isGentle ? "#db2777" : "#991b1b";
      ctx.fill();

      // Bold 17px text - 100% Crisp & Legible!
      ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeText(obs.text, obs.x + obs.width / 2 + 4, obs.y + obs.height / 2);

      ctx.fillStyle = obs.isGentle ? "#831843" : "#450a0a";
      ctx.fillText(obs.text, obs.x + obs.width / 2 + 4, obs.y + obs.height / 2);

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
