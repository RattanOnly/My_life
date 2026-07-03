(() => {
  // Register all visual effect themes here to keep switching loosely coupled.
  const DEFAULT_EFFECT_ID = 'leaves';
  const PERSIST_KEY = 'site_effect_active';

  const mediaMatches = query => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const isSmallScreen = () => mediaMatches('(max-width: 767px)');
  const prefersReducedMotion = () => mediaMatches('(prefers-reduced-motion: reduce)');

  class LeafScene {
    constructor(viewport) {
      this.viewport = viewport;
      this.world = document.createElement('div');
      this.leaves = [];
      this.animationFrame = null;
      this.timer = 0;
      this.running = false;
      this.width = 0;
      this.height = 0;

      this.options = {
        numLeaves: isSmallScreen() ? 16 : 28,
        wind: {
          magnitude: 1.2,
          maxSpeed: isSmallScreen() ? 8 : 12,
          duration: 300,
          start: 0,
          speed: () => 0,
        },
      };

      this.resize = this.resize.bind(this);
      this.render = this.render.bind(this);
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    resize() {
      this.width = this.viewport.offsetWidth || window.innerWidth;
      this.height = this.viewport.offsetHeight || window.innerHeight;
    }

    resetLeaf(leaf) {
      leaf.x = this.width * 2 - Math.random() * this.width * 1.75;
      leaf.y = -30;
      leaf.z = Math.random() * 240;

      if (leaf.x > this.width) {
        leaf.x = this.width + 24;
        leaf.y = Math.random() * this.height * 0.5;
      }

      if (this.timer === 0) {
        leaf.y = Math.random() * this.height;
      }

      leaf.rotation.speed = Math.random() * 10;
      const randomAxis = Math.random();
      if (randomAxis > 0.5) {
        leaf.rotation.axis = 'X';
      } else if (randomAxis > 0.25) {
        leaf.rotation.axis = 'Y';
        leaf.rotation.x = Math.random() * 180 + 90;
      } else {
        leaf.rotation.axis = 'Z';
        leaf.rotation.x = Math.random() * 360 - 180;
        leaf.rotation.speed = Math.random() * 3;
      }

      leaf.xSpeedVariation = Math.random() * 0.8 - 0.4;
      leaf.ySpeed = Math.random() + 1.2;
      const mobile = isSmallScreen();
      const leafSize = mobile ? 16 + Math.random() * 10 : 18 + Math.random() * 18;
      leaf.el.style.opacity = String((mobile ? 0.28 : 0.42) + Math.random() * (mobile ? 0.24 : 0.42));
      leaf.el.style.width = `${leafSize}px`;
      leaf.el.style.height = leaf.el.style.width;

      return leaf;
    }

    updateWind() {
      if (this.timer !== 0 && this.timer <= this.options.wind.start + this.options.wind.duration) {
        return;
      }

      this.options.wind.magnitude = Math.random() * this.options.wind.maxSpeed;
      this.options.wind.duration = this.options.wind.magnitude * 50 + (Math.random() * 20 - 10);
      this.options.wind.start = this.timer;

      const screenHeight = this.height;
      this.options.wind.speed = function speed(t, y) {
        const a = (this.magnitude / 2) * (screenHeight - (2 * y) / 3) / screenHeight;
        return a * Math.sin((2 * Math.PI / this.duration) * t + (3 * Math.PI) / 2) + a;
      };
    }

    updateLeaf(leaf) {
      const leafWindSpeed = this.options.wind.speed(this.timer - this.options.wind.start, leaf.y);
      const xSpeed = leafWindSpeed + leaf.xSpeedVariation;

      leaf.x -= xSpeed;
      leaf.y += leaf.ySpeed;
      leaf.rotation.value += leaf.rotation.speed;

      let transform = `translateX(${leaf.x}px) translateY(${leaf.y}px) translateZ(${leaf.z}px) rotate${leaf.rotation.axis}(${leaf.rotation.value}deg)`;
      if (leaf.rotation.axis !== 'X') {
        transform += ` rotateX(${leaf.rotation.x}deg)`;
      }
      leaf.el.style.transform = transform;

      if (leaf.x < -48 || leaf.y > this.height + 48) {
        this.resetLeaf(leaf);
      }
    }

    createLeaf() {
      const leaf = {
        el: document.createElement('div'),
        x: 0,
        y: 0,
        z: 0,
        rotation: {
          axis: 'X',
          value: 0,
          speed: 0,
          x: 0,
        },
        xSpeedVariation: 0,
        ySpeed: 0,
      };

      leaf.el.className = 'leaf-particle';
      this.resetLeaf(leaf);
      return leaf;
    }

    init() {
      this.world.className = 'leaf-scene';
      this.world.style.perspective = '420px';
      this.world.style.transformStyle = 'preserve-3d';
      this.viewport.appendChild(this.world);

      this.resize();
      for (let i = 0; i < this.options.numLeaves; i += 1) {
        const leaf = this.createLeaf();
        this.leaves.push(leaf);
        this.world.appendChild(leaf.el);
      }

      window.addEventListener('resize', this.resize, { passive: true });
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    start() {
      if (this.running || prefersReducedMotion()) return;
      this.running = true;
      this.animationFrame = requestAnimationFrame(this.render);
    }

    stop() {
      this.running = false;
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }

    handleVisibilityChange() {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    }

    render() {
      if (!this.running) return;

      this.updateWind();
      for (let i = 0; i < this.leaves.length; i += 1) {
        this.updateLeaf(this.leaves[i]);
      }
      this.timer += 1;

      this.animationFrame = requestAnimationFrame(this.render);
    }

    destroy() {
      this.stop();
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('resize', this.resize);
      this.world.remove();
      this.leaves = [];
    }
  }

  const effectThemes = [
    {
      id: 'leaves',
      name: 'Falling Leaves',
      mount({ target = document.body } = {}) {
        const root = document.createElement('div');
        root.className = 'site-effect site-effect--leaves';
        root.dataset.effectTheme = 'leaves';

        (target || document.body).appendChild(root);

        const scene = new LeafScene(root);
        scene.init();
        scene.start();

        return () => {
          scene.destroy();
          root.remove();
        };
      },
    },
  ];

  const state = {
    cleanup: null,
    activeId: null,
  };

  const persistActive = effectId => {
    try {
      localStorage.setItem(PERSIST_KEY, effectId);
    } catch (error) {
      // Access to storage might be blocked; ignore.
    }
  };

  const readPersisted = () => {
    try {
      return localStorage.getItem(PERSIST_KEY) || DEFAULT_EFFECT_ID;
    } catch (error) {
      return DEFAULT_EFFECT_ID;
    }
  };

  const activate = effectId => {
    if (!effectId) return false;
    if (state.activeId === effectId) return true;

    const theme = effectThemes.find(item => item.id === effectId);
    if (!theme) return false;

    if (state.cleanup) {
      state.cleanup();
      state.cleanup = null;
    }

    const cleanup = theme.mount();
    state.cleanup = typeof cleanup === 'function' ? cleanup : null;
    state.activeId = effectId;
    persistActive(effectId);
    return true;
  };

  const bootstrap = () => {
    const preferred = readPersisted();
    if (!activate(preferred) && preferred !== DEFAULT_EFFECT_ID) {
      activate(DEFAULT_EFFECT_ID);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }

  window.__SITE_EFFECTS__ = {
    list: effectThemes.map(({ id, name }) => ({ id, name })),
    activate,
    get active() {
      return state.activeId;
    },
  };
})();
