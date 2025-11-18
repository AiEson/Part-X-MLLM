const {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} = React;

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function MeshGenCard({ item }) {
  const wrapRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [explode, setExplode] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const explodeDataRef = useRef({ ready: false, parts: [], radius: 1, root: null, center: null });
  const threeRef = useRef({ renderer: null, scene: null, camera: null, controls: null, raf: 0 });

  const resolveThreeScene = useCallback((el) => {
    if (!el) return null;
    // Fast paths
    if (el.scene && el.scene.traverse) return el.scene;
    if (el.scene && el.scene.threeScene && el.scene.threeScene.traverse) return el.scene.threeScene;
    // Symbols
    try {
      const syms = Object.getOwnPropertySymbols(el);
      for (const s of syms) {
        const v = el[s];
        if (!v) continue;
        if (v.scene?.traverse) return v.scene;
        if (v.threeScene?.traverse) return v.threeScene;
        if (v.renderer?.scene?.traverse) return v.renderer.scene;
      }
    } catch {}
    // String keys (limited scan)
    try {
      const keys = Object.getOwnPropertyNames(el).slice(0, 50);
      for (const k of keys) {
        const v = el[k];
        if (!v || typeof v !== 'object') continue;
        if (v.scene?.traverse) return v.scene;
        if (v.threeScene?.traverse) return v.threeScene;
      }
    } catch {}
    return null;
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const loadScript = (src) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = () => reject(new Error(`Load failed: ${src}`));
      document.head.appendChild(s);
    });
    const loadAny = async (urls) => {
      let lastErr;
      for (const u of urls) {
        try { await loadScript(u); return; } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('All CDN sources failed');
    };

    const ensureThree = async () => {
      if (!window.THREE) {
        await loadAny([
          'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js',
          'https://unpkg.com/three@0.134.0/build/three.min.js',
        ]);
      }
      if (!window.THREE.OrbitControls) {
        await loadAny([
          'https://cdn.jsdelivr.net/npm/three/examples/js/controls/OrbitControls.js',
          'https://unpkg.com/three/examples/js/controls/OrbitControls.js',
        ]);
      }
      if (!window.THREE.GLTFLoader) {
        await loadAny([
          'https://cdn.jsdelivr.net/npm/three/examples/js/loaders/GLTFLoader.js',
          'https://unpkg.com/three/examples/js/loaders/GLTFLoader.js',
        ]);
      }
      if (!window.THREE.DRACOLoader) {
        await loadAny([
          'https://cdn.jsdelivr.net/npm/three/examples/js/loaders/DRACOLoader.js',
          'https://unpkg.com/three/examples/js/loaders/DRACOLoader.js',
        ]);
      }
      if (!window.MeshoptDecoder) {
        await loadAny([
          'https://unpkg.com/meshoptimizer@0.20.0/meshopt_decoder.js',
          'https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_decoder.js',
        ]);
      }
    };

    let disposed = false;
    (async () => {
      try {
        await ensureThree();
        if (disposed) return;

        // Cleanup previous
        if (threeRef.current.raf) cancelAnimationFrame(threeRef.current.raf);
        if (threeRef.current.renderer) {
          try { wrap.removeChild(threeRef.current.renderer.domElement); } catch {}
        }

        // Init THREE renderer/scene/camera
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setClearColor(0x262335, 1);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        const width = wrap.clientWidth || 320;
        const height = wrap.clientHeight || 300;
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        wrap.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 100);
        camera.position.set(0, 0, 3);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // Softer, studio-style lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.25));
        const hemi = new THREE.HemisphereLight(0x6e7bbf, 0x050509, 0.35); scene.add(hemi);
        const dir1 = new THREE.DirectionalLight(0xffffff, 0.8); dir1.position.set(6, 10, 8); scene.add(dir1);
        const dir2 = new THREE.DirectionalLight(0xffffff, 0.35); dir2.position.set(-6, 6, -4); scene.add(dir2);
        const rim = new THREE.DirectionalLight(0xffffff, 0.25); rim.position.set(0, 0, -6); scene.add(rim);

        threeRef.current = { renderer, scene, camera, controls, raf: 0 };
        setProgress(0.01); setLoading(true); setExplode(0); setErrorMsg(null);
        if (threeRef.current.progressTimer) clearInterval(threeRef.current.progressTimer);
        threeRef.current.progressTimer = setInterval(() => {
          setProgress((p) => (p < 0.9 ? Math.min(0.9, p + 0.02) : p));
        }, 400);

        // Load GLB
        const loader = new THREE.GLTFLoader();
        if (window.THREE.DRACOLoader) {
          const draco = new THREE.DRACOLoader();
          draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
          loader.setDRACOLoader(draco);
        }
        if (window.MeshoptDecoder) {
          loader.setMeshoptDecoder(window.MeshoptDecoder);
        }
        const url = new URL(item.src, window.location.href).href;
        const baseForParse = new URL('./', url).href;

        const onSuccess = (gltf) => {
          if (disposed) return;
          const root = gltf.scene;
          root.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.metalness = 0.0;
              child.material.roughness = 0.85;
              if (typeof child.material.envMapIntensity === 'number') {
                child.material.envMapIntensity = 0.2;
              }
              child.material.needsUpdate = true;
            }
          });

          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const target = 1.6;
          const scale = target / maxDim;
          root.scale.setScalar(scale);
          root.position.sub(center.multiplyScalar(scale));
          scene.add(root);

          const fov = camera.fov * (Math.PI / 180);
          const dist = (maxDim * scale) / (2 * Math.tan(fov / 2)) + 0.5;
          camera.position.set(0.6 * dist, 0.3 * dist, dist);
          camera.lookAt(0, 0, 0);

          const partsParent = root.children[0] || root;
          const parts = [];
          partsParent.children.forEach((part) => {
            part.userData.originalPosition = part.position.clone();
            parts.push(part);
          });
          const radius = Math.max(size.x, size.y, size.z) * scale || 1;
          explodeDataRef.current = { ready: parts.length > 1, parts, radius, root: partsParent, center: new THREE.Vector3(0,0,0) };

          if (threeRef.current.progressTimer) { clearInterval(threeRef.current.progressTimer); threeRef.current.progressTimer = null; }
          setProgress(1); setLoading(false); setErrorMsg(null);
          applyExplodeImmediate(explode);
        };

        const onProgress = (xhr) => {
          if (disposed) return;
          const t = xhr.total || 0;
          if (t > 0) {
            setProgress(Math.min(1, xhr.loaded / t));
          } else {
            setProgress((p) => (p < 0.5 ? 0.5 : p));
          }
        };

        const onError = async (err) => {
          console && console.warn && console.warn('GLB direct load failed, trying fetch+parse', url, err);
          try {
            const resp = await fetch(url);
            const buf = await resp.arrayBuffer();
            loader.parse(buf, baseForParse, onSuccess, (e) => {
              console && console.error && console.error('GLB parse failed', e);
              if (threeRef.current.progressTimer) { clearInterval(threeRef.current.progressTimer); threeRef.current.progressTimer = null; }
              if (!disposed) { setLoading(false); setProgress(0); setErrorMsg('Load failed'); }
            });
          } catch (e2) {
            console && console.error && console.error('GLB fetch failed', e2);
            if (threeRef.current.progressTimer) { clearInterval(threeRef.current.progressTimer); threeRef.current.progressTimer = null; }
            if (!disposed) { setLoading(false); setProgress(0); setErrorMsg('Load failed'); }
          }
        };

        loader.load(
          url,
          onSuccess,
          onProgress,
          onError
        );

        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          threeRef.current.raf = requestAnimationFrame(animate);
        };
        animate();

        const onResize = () => {
          const W = wrap.clientWidth || width;
          const H = wrap.clientHeight || height;
          renderer.setSize(W, H);
          camera.aspect = W / H;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);

        threeRef.current.cleanup = () => {
          window.removeEventListener('resize', onResize);
          if (threeRef.current.raf) cancelAnimationFrame(threeRef.current.raf);
          try { controls.dispose(); } catch {}
          try { renderer.dispose(); } catch {}
          try { wrap.removeChild(renderer.domElement); } catch {}
          if (threeRef.current.progressTimer) { clearInterval(threeRef.current.progressTimer); threeRef.current.progressTimer = null; }
          threeRef.current = { renderer: null, scene: null, camera: null, controls: null, raf: 0 };
        };
      } catch (e) {
        console && console.error && console.error('Three ensure failed', e);
        setErrorMsg('Lib load failed');
        setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      if (threeRef.current.cleanup) threeRef.current.cleanup();
    };
  }, [item?.src]);

  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));

  // Apply exploded transform when slider moves (Three.js scene)
  const applyExplodeImmediate = useCallback((value) => {
    const data = explodeDataRef.current;
    if (!data.ready || !data.parts?.length) return;
    const distance = (data.radius || 1) * 0.6 * value;
    data.parts.forEach((part) => {
      try {
        // direction from origin (0,0,0) to part center
        const bbox = new THREE.Box3().setFromObject(part);
        const c = bbox.getCenter(new THREE.Vector3());
        const dir = c.normalize();
        const base = part.userData.originalPosition || part.position.clone();
        const offset = dir.multiplyScalar(distance);
        part.position.copy(base.clone().add(offset));
      } catch {}
    });
  }, []);

  useEffect(() => {
    applyExplodeImmediate(explode);
  }, [explode, applyExplodeImmediate]);

  return (
    <div className="viewer-card meshgen-card">
      <span className="viewer-label">{item.label}</span>
      <div ref={wrapRef} className="three-wrap" style={{ width: '100%', height: '300px', background: '#262335' }} />
      <div className="mv-progress" style={{ opacity: loading || errorMsg ? 1 : 0 }} aria-hidden={!(loading || errorMsg)}>
        <div className="mv-progress-track">
          <div className="mv-progress-bar" style={{ width: `${pct}%` }} />
        </div>
        <div className="mv-progress-text">{errorMsg ? errorMsg : `${pct}%`}</div>
      </div>
      {!loading && (
        <div className="mv-explode">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(explode * 100)}
            onChange={(e) => setExplode(Math.max(0, Math.min(1, Number(e.target.value) / 100)))}
            onInput={(e) => setExplode(Math.max(0, Math.min(1, Number(e.target.value) / 100)))}
            aria-label="Exploded view"
            style={{ ['--explode-pct']: `${Math.round(explode * 100)}%` }}
          />
          <span className="mv-explode-label">Explode</span>
        </div>
      )}
    </div>
  );
}

function MeshGenSection() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch('./static/meshes/mesh_gen/manifest.json')
      .then((res) => res.json())
      .then((data) => setItems(data || []))
      .catch(() => setItems([]));
  }, []);

  return (
    <section id="mesh-gen" className="section section-dark">
      <div className="container">
        <p className="section-heading">Mesh Generation</p>
        <h2 className="section-title">Single-object GLB Gallery</h2>

        {items.length ? (
          <div className="meshgen-grid">
            {items.map((it) => (
              <MeshGenCard key={it.id} item={it} />
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: '1.5rem' }}>Loading mesh list…</p>
        )}
      </div>
    </section>
  );
}

function EditingSection() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const beforeRef = useRef(null);
  const afterRef = useRef(null);
  const stripRef = useRef(null);

  useEffect(() => {
    fetch('./static/meshes/editing/manifest.json')
      .then((res) => res.json())
      .then((data) => setItems(data || []))
      .catch(() => setItems([]));
  }, []);

  const current = items[active];

  const prev = () => setActive((i) => (i - 1 + items.length) % items.length);
  const next = () => setActive((i) => (i + 1) % items.length);

  const resetView = () => {
    [beforeRef.current, afterRef.current].forEach((el) => {
      if (el) {
        el.setAttribute('camera-orbit', '-35deg 75deg auto');
        el.setAttribute('camera-target', 'auto');
        el.setAttribute('field-of-view', '25deg');
      }
    });
  };

  const scrollToActive = (index) => {
    const strip = stripRef.current;
    if (!strip) return;
    const cards = strip.querySelectorAll('.thumb-card');
    const card = cards[index];
    if (!card) return;
    const stripWidth = strip.clientWidth;
    const maxScroll = strip.scrollWidth - stripWidth;
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const target = Math.min(Math.max(cardCenter - stripWidth / 2, 0), Math.max(maxScroll, 0));
    strip.scrollTo({ left: target, behavior: 'smooth' });
  };

  useEffect(() => {
    if (items.length) scrollToActive(active);
  }, [active, items.length]);

  return (
    <section id="editing-viewer" className="section section-dark">
      <div className="container">
        <p className="section-heading">Editing</p>
        <h2 className="section-title">Edited Meshes Gallery</h2>
        <p className="section-lead">
        </p>

        {current ? (
          <div className="model-grid">
            <div className="viewer-card">
              <span className="viewer-label">Before</span>
              <model-viewer
                src={current.srcGlb}
                alt={`Before model of ${current.id}`}
                exposure="1.1"
                shadow-intensity="0.4"
                environment-image="neutral"
                camera-controls
                interaction-prompt="none"
                interaction-policy="always-allow"
                camera-target="auto"
                camera-orbit="-35deg 75deg auto"
                field-of-view="25deg"
                bounds="tight"
                ref={beforeRef}
                style={{ width: '100%', height: '420px', background: '#262335' }}
              />
            </div>
            <div className="viewer-card">
              <span className="viewer-label">After</span>
              <model-viewer
                src={current.tarGlb}
                alt={`After model of ${current.id}`}
                exposure="1.1"
                shadow-intensity="0.4"
                environment-image="neutral"
                camera-controls
                interaction-prompt="none"
                interaction-policy="always-allow"
                camera-target="auto"
                camera-orbit="-35deg 75deg auto"
                field-of-view="25deg"
                bounds="tight"
                ref={afterRef}
                style={{ width: '100%', height: '420px', background: '#262335' }}
              />
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: '1.5rem' }}>Loading editing assets…</p>
        )}

        <div className="viewer-tools">
          <button type="button" className="btn-mini" onClick={resetView}>
            Reset to -35°
          </button>
        </div>

        <div className="thumbs">
          <button type="button" className="thumbs-nav is-left" onClick={prev} aria-label="Previous group">
            <i className="fas fa-chevron-left" />
          </button>
          <div className="thumbs-strip" ref={stripRef}>
            {items.map((it, idx) => (
              <button
                key={it.id}
                type="button"
                className={`thumb-card ${idx === active ? 'is-active' : ''}`}
                onClick={() => setActive(idx)}
                aria-label={`Select ${it.label}`}
              >
                <div className="thumb-pair">
                  <img src={it.srcThumb} alt={`${it.label} before (-35°)`} />
                  <img src={it.tarThumb} alt={`${it.label} after (-35°)`} />
                </div>
                <div className="thumb-caption">{it.label}</div>
              </button>
            ))}
          </div>
          <button type="button" className="thumbs-nav is-right" onClick={next} aria-label="Next group">
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================
// ReactBits Components
// From: https://reactbits.dev
// ============================================

// Gradient Text Component
function GradientText({ 
  children, 
  className = '', 
  colors = ['#47c8ff', '#a658ff', '#ff4fa3', '#47c8ff'],
  animationSpeed = 8,
  showBorder = false 
}) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(', ')})`,
    animationDuration: `${animationSpeed}s`,
    backgroundSize: '300% 100%',
  };

  return (
    <span
      className={`gradient-text-wrapper ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {showBorder && (
        <span
          className="gradient-text-border"
          style={{
            ...gradientStyle,
            position: 'absolute',
            inset: 0,
            animation: 'gradient-shift 8s linear infinite',
          }}
        />
      )}
      <span
        className="gradient-text-content"
        style={{
          ...gradientStyle,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          animation: 'gradient-shift 8s linear infinite',
          display: 'inline-block',
        }}
      >
        {children}
      </span>
    </span>
  );
}

// ============================================
// ReactBits Rotating Text Component
// ============================================

function resolveMotion() {
  if (typeof window === 'undefined') {
    return { motion: undefined, AnimatePresence: undefined };
  }

  // Try to get from window.motion and window.AnimatePresence (set by our script)
  if (window.motion && window.AnimatePresence) {
    return { motion: window.motion, AnimatePresence: window.AnimatePresence };
  }

  // Try to get from window.Motion (Framer Motion global)
  if (window.Motion) {
    const motionExport = window.Motion.motion || window.Motion;
    const animatePresenceExport = window.Motion.AnimatePresence;
    if (motionExport && animatePresenceExport) {
      return { motion: motionExport, AnimatePresence: animatePresenceExport };
    }
  }

  // Try other potential global names
  const globalNames = ['framerMotion', 'FramerMotion'];
  for (const name of globalNames) {
    const mod = window[name];
    if (mod && mod.motion && mod.AnimatePresence) {
      return { motion: mod.motion, AnimatePresence: mod.AnimatePresence };
    }
  }

  return { motion: undefined, AnimatePresence: undefined };
}

const RotatingText = forwardRef((props, ref) => {
  const {
    texts,
    transition = { type: 'spring', damping: 25, stiffness: 300 },
    initial = { y: '100%', opacity: 0 },
    animate = { y: 0, opacity: 1 },
    exit = { y: '-120%', opacity: 0 },
    animatePresenceMode = 'wait',
    animatePresenceInitial = false,
    rotationInterval = 2000,
    staggerDuration = 0,
    staggerFrom = 'first',
    loop = true,
    auto = true,
    splitBy = 'characters',
    onNext,
    mainClassName,
    splitLevelClassName,
    elementLevelClassName,
    ...rest
  } = props;

  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [motionLib, setMotionLib] = useState(() => resolveMotion());
  const { motion, AnimatePresence } = motionLib;
  const hasMotion = Boolean(motion && AnimatePresence);

  // Poll for motion library if not available initially
  useEffect(() => {
    if (hasMotion || typeof window === 'undefined') {
      return undefined;
    }
    const pollId = window.setInterval(() => {
      const found = resolveMotion();
      if (found.motion && found.AnimatePresence) {
        window.clearInterval(pollId);
        setMotionLib(found);
      }
    }, 100);
    return () => window.clearInterval(pollId);
  }, [hasMotion]);

  const splitIntoCharacters = useCallback((text) => {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text), (segment) => segment.segment);
    }
    return Array.from(text);
  }, []);

  const elements = useMemo(() => {
    const currentText = texts[currentTextIndex] || '';
    if (splitBy === 'characters') {
      const words = currentText.split(' ');
      return words.map((word, i) => ({
        characters: splitIntoCharacters(word),
        needsSpace: i !== words.length - 1,
      }));
    }
    if (splitBy === 'words') {
      return currentText.split(' ').map((word, i, arr) => ({
        characters: [word],
        needsSpace: i !== arr.length - 1,
      }));
    }
    if (splitBy === 'lines') {
      return currentText.split('\n').map((line, i, arr) => ({
        characters: [line],
        needsSpace: i !== arr.length - 1,
      }));
    }
    return currentText.split(splitBy).map((part, i, arr) => ({
      characters: [part],
      needsSpace: i !== arr.length - 1,
    }));
  }, [texts, currentTextIndex, splitBy, splitIntoCharacters]);

  const getStaggerDelay = useCallback(
    (index, totalChars) => {
      if (staggerFrom === 'first') return index * staggerDuration;
      if (staggerFrom === 'last') return (totalChars - 1 - index) * staggerDuration;
      if (staggerFrom === 'center') {
        const center = Math.floor(totalChars / 2);
        return Math.abs(center - index) * staggerDuration;
      }
      if (staggerFrom === 'random') {
        const randomIndex = Math.floor(Math.random() * totalChars);
        return Math.abs(randomIndex - index) * staggerDuration;
      }
      return Math.abs((staggerFrom || 0) - index) * staggerDuration;
    },
    [staggerFrom, staggerDuration]
  );

  const handleIndexChange = useCallback(
    (newIndex) => {
      setCurrentTextIndex(newIndex);
      if (onNext) onNext(newIndex);
    },
    [onNext]
  );

  const next = useCallback(() => {
    const nextIndex =
      currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
    if (nextIndex !== currentTextIndex) {
      handleIndexChange(nextIndex);
    }
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  const previous = useCallback(() => {
    const prevIndex =
      currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1;
    if (prevIndex !== currentTextIndex) {
      handleIndexChange(prevIndex);
    }
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  const jumpTo = useCallback(
    (index) => {
      const validIndex = Math.max(0, Math.min(index, texts.length - 1));
      if (validIndex !== currentTextIndex) {
        handleIndexChange(validIndex);
      }
    },
    [texts.length, currentTextIndex, handleIndexChange]
  );

  const reset = useCallback(() => {
    if (currentTextIndex !== 0) {
      handleIndexChange(0);
    }
  }, [currentTextIndex, handleIndexChange]);

  useImperativeHandle(
    ref,
    () => ({
      next,
      previous,
      jumpTo,
      reset,
    }),
    [next, previous, jumpTo, reset]
  );

  useEffect(() => {
    if (!auto) return undefined;
    const intervalId = setInterval(next, rotationInterval);
    return () => clearInterval(intervalId);
  }, [next, rotationInterval, auto]);

  // Fallback if motion library is not available
  if (!hasMotion) {
    return (
      <span className={cn('rotating-text-fallback', mainClassName)} {...rest}>
        {texts[currentTextIndex]}
      </span>
    );
  }

  const currentText = texts[currentTextIndex];
  const totalCharacters = elements.reduce((sum, word) => sum + word.characters.length, 0);

  return (
    <motion.span
      className={cn('rotating-text', mainClassName)}
      layout
      transition={transition}
      {...rest}
    >
      <span className="sr-only">{currentText}</span>
      <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
        <motion.span
          key={currentTextIndex}
          className={cn(
            'rotating-text-layer',
            splitBy === 'lines' ? 'rotating-text-lines' : null
          )}
          layout
          aria-hidden="true"
        >
          {elements.map((wordObj, wordIndex, array) => {
            const previousCharsCount = array
              .slice(0, wordIndex)
              .reduce((sum, word) => sum + word.characters.length, 0);
            return (
              <span
                key={wordIndex}
                className={cn('rotating-text-word', splitLevelClassName)}
              >
                {wordObj.characters.map((char, charIndex) => (
                  <motion.span
                    key={charIndex}
                    initial={initial}
                    animate={animate}
                    exit={exit}
                    transition={{
                      ...transition,
                      delay: getStaggerDelay(previousCharsCount + charIndex, totalCharacters),
                    }}
                    className={cn('rotating-text-char', elementLevelClassName)}
                  >
                    {char}
                  </motion.span>
                ))}
                {wordObj.needsSpace && <span className="rotating-text-space"> </span>}
              </span>
            );
          })}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
});

const ROTATING_X_TEXTS = ['X', 'Grounding', 'Captioning', 'Understanding', 'Editing', 'Generation'];

const NAV_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "abstract", label: "Abstract" },
  { id: "playground", label: "Pipeline" },
  { id: "editing-viewer", label: "Editing" },
  { id: "mesh-gen", label: "Part Gen" },
  { id: "citation", label: "Citation" },
  { id: "authors", label: "Acknowledgments" },
];

const AUTHORS = [
  {
    name: "Chunshi Wang",
    markers: ["†", "1", "2"],
    profile: "https://chunshi.wang/",
  },
  {
    name: "Junliang Ye",
    markers: ["†", "‡", "3", "2"],
    profile: "https://jamesyjl.github.io/",
  },
  {
    name: "Yunhan Yang",
    markers: ["†", "4", "2"],
    profile: "https://yhyang-myron.github.io/",
  },
  {
    name: "Yang Li",
    markers: ["2"],
    profile: "https://yang-l1.github.io/",
  },
  {
    name: "Zizhuo Lin",
    markers: ["1"],
    profile: null,
  },
  {
    name: "Jun Zhu",
    markers: ["3"],
    profile: "https://ml.cs.tsinghua.edu.cn/~jun/",
  },
  {
    name: "Zhuo Chen",
    markers: ["2"],
    profile: null,
  },
  {
    name: "Yawei Luo",
    markers: ["✉", "1"],
    profile: "https://scholar.google.com/citations?user=pnVwaGsAAAAJ",
  },
  {
    name: "Chunchao Guo",
    markers: ["✉", "2"],
    profile: null,
  },
];

const AFFILIATIONS = [
  { id: "1", name: "Zhejiang University" },
  { id: "2", name: "Tencent Hunyuan" },
  { id: "3", name: "Tsinghua University" },
  { id: "4", name: "The University of Hong Kong" },
];

const AUTHOR_LEGENDS = [
  { symbol: "†", description: "Equal Contribution" },
  { symbol: "‡", description: "Project Lead" },
  { symbol: "✉", description: "Corresponding Author" },
];

const ACKNOWLEDGMENTS = [
  { name: "OmniPart", profile: "https://omnipart.github.io/" },
  { name: "Nano3D", profile: "https://jamesyjl.github.io/Nano3D/" },
  { name: "VoxHammer", profile: "https://huanngzh.github.io/VoxHammer-Page/" },
  { name: "ShapeLLM-Omni", profile: "https://jamesyjl.github.io/ShapeLLM/" },
  { name: "PointLLM", profile: "https://runsenxu.com/projects/PointLLM/" },
  { name: "Hunyuan3D-Omni", profile: "https://github.com/Tencent-Hunyuan/Hunyuan3D-Omni" },
];

const HERO_METADATA = [
  { icon: "fas fa-atom", text: "Dual-encoder 3D geometry & appearance" },
  { icon: "fas fa-shapes", text: "Programmatic part-level planning" },
  { icon: "fas fa-project-diagram", text: "Universal frontend for 3D engines" },
];

const ABSTRACT_PARAGRAPHS = [
  "We introduce Part-X-MLLM, a native 3D multimodal large language model that unifies diverse 3D tasks by formulating them as programs in a structured, executable grammar. Given an RGB point cloud and a natural language prompt, our model autoregressively generates a single, coherent token sequence encoding part-level bounding boxes, semantic descriptions, and edit commands. This structured output serves as a versatile interface to drive downstream geometry-aware modules for part-based generation and editing. By decoupling the symbolic planning from the geometric synthesis, our approach allows any compatible geometry engine to be controlled through a single, language-native frontend. We pre-train a dual-encoder architecture to disentangle structure from semantics and instruction-tune the model on a large-scale, part-centric dataset. Experiments demonstrate that our model excels at producing high-quality, structured plans, enabling state-of-the-art performance in grounded Q&A, compositional generation, and localized editing through one unified interface.",
];

const PLAYGROUND_PRESETS = [
  {
    prompt: "Add a panoramic roof and extend the rear spoiler.",
    plan: [
      "select_part(name='roof')",
      "extrude(axis='z', scale=1.2)",
      "replace_material('glass_panorama')",
      "select_part(name='rear_spoiler')",
      "scale(axis='x', factor=1.3)",
      "apply_finish('carbon_weave')",
    ],
  },
  {
    prompt: "Highlight the camera array and remove the side antenna.",
    plan: [
      "select_part(description~'camera array')",
      "emit_glow(color='#4EC8FF', intensity=0.8)",
      "select_part(type='antenna', side='left')",
      "delete_part()",
    ],
  },
  {
    prompt: "Split the arm into forearm and claw for fine manipulation.",
    plan: [
      "select_part(name='arm_segment')",
      "bisect(plane='joint_local')",
      "label_part('forearm')",
      "label_part('precision_claw')",
      "activate_rigging(mode='dexterity')",
    ],
  },
];

const FEATURE_ITEMS = [
  {
    icon: "fas fa-cube",
    title: "Unified 3D Multimodal Model",
    description:
      "Language-native planning fused with geometric reasoning to control any compatible 3D engine through a single programmatic interface.",
  },
  {
    icon: "fas fa-sitemap",
    title: "Structured Program Generation",
    description:
      "Grammar-constrained decoding ensures each instruction resolves to precise, executable part-level operations.",
  },
  {
    icon: "fas fa-draw-polygon",
    title: "Part-Aware Editing",
    description:
      "Autoregressive bounding box synthesis captures semantic and spatial context for high-fidelity localized edits.",
  },
  {
    icon: "fas fa-rocket",
    title: "Geometry Agnostic Interface",
    description:
      "Decoupled symbolic planning seamlessly integrates with diverse downstream synthesis or simulation modules.",
  },
];

const RESULTS_CATEGORIES = [
  {
    id: "generation",
    label: "Generation",
    items: [
      {
        type: "video",
        src: "./static/videos/fullbody.mp4",
        title: "Holistic Assembly",
        description:
          "From a coarse instruction, Part-X-MLLM decomposes and arranges 23 functional components with consistent alignment.",
      },
      {
        type: "video",
        src: "./static/videos/steve.mp4",
        title: "Concept Vehicle Blueprint",
        description:
          "Generates structural scaffolds and localized edits that transfer directly into CAD-ready geometry.",
      },
      {
        type: "image",
        src: "./static/images/detail_pipeline.png",
        title: "Hierarchical Plan Visualization",
        description:
          "Program trace rendered as layered bounding boxes, revealing the model's interpretable reasoning steps.",
      },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    items: [
      {
        type: "video",
        src: "./static/videos/dollyzoom-stacked.mp4",
        title: "Dynamic Part Relighting",
        description:
          "Language-driven relighting applied to the cabin interior while preserving the vehicle hull.",
      },
      {
        type: "video",
        src: "./static/videos/matting.mp4",
        title: "Selective Part Removal",
        description:
          "Targeted deletion of antenna clusters produces clean silhouettes ready for downstream rendering.",
      },
      {
        type: "video",
        src: "./static/videos/replay.mp4",
        title: "Program Replay",
        description:
          "Executable plans can be replayed to audit each edit and export per-step deltas.",
      },
    ],
  },
  {
    id: "qa",
    label: "Q&A",
    items: [
      {
        type: "image",
        src: "./static/images/pipeline.png",
        title: "UniPart Dialogue",
        description:
          "Natural language queries ground into explicit component references with associated spatial programs.",
      },
      {
        type: "video",
        src: "./static/videos/shiba.mp4",
        title: "Multi-turn Inspection",
        description:
          "Iterative questioning narrows down to individual assemblies, enabling precise structural diagnostics.",
      },
      {
        type: "video",
        src: "./static/videos/coffee.mp4",
        title: "Explainable Reasoning",
        description:
          "Model narrates the rationale behind each manipulation as the plan executes.",
      },
    ],
  },
];

const METHODOLOGY_STEPS = [
  {
    icon: "fas fa-code-branch",
    title: "Dual-Encoder Alignment",
    description:
      "Disentangles structural cues from semantic cues by pairing a geometry encoder with a language-grounded appearance encoder.",
  },
  {
    icon: "fas fa-puzzle-piece",
    title: "Grammar-Constrained Decoding",
    description:
      "Structured tokens serialize bounding boxes, attributes, and executable instructions with deterministic validity checks.",
  },
  {
    icon: "fas fa-microchip",
    title: "Program-to-Geometry Bridge",
    description:
      "Plans interface with any compatible synthesis engine, enabling plug-and-play generation, editing, or simulation backends.",
  },
];

const BENCHMARK_METRICS = [
  { metric: "Voxel Recall", ours: "74.11", baseline: "+1.79 vs. OmniPart" },
  { metric: "Voxel IoU", ours: "48.74", baseline: "+1.12 vs. OmniPart" },
  { metric: "BBox IoU", ours: "42.55", baseline: "+2.77 vs. OmniPart" },
];

const QA_METRICS = [
  { metric: "SBERT", ours: "78.98", gain: "+17.7" },
  { metric: "SimCSE", ours: "84.25", gain: "+25.8" },
  { metric: "BLEU-1", ours: "40.54", gain: "+17.2" },
  { metric: "ROUGE-L", ours: "42.26", gain: "+9.7" },
  { metric: "METEOR", ours: "34.24", gain: "+9.8" },
];

const BIBTEX = `@misc{wang2025partxmllmpartaware3dmultimodal,
      title={Part-X-MLLM: Part-aware 3D Multimodal Large Language Model}, 
      author={Chunshi Wang and Junliang Ye and Yunhan Yang and Yang Li and Zizhuo Lin and Jun Zhu and Zhuo Chen and Yawei Luo and Chunchao Guo},
      year={2025},
      eprint={2511.13647},
      archivePrefix={arXiv},
      primaryClass={cs.CV},
      url={https://arxiv.org/abs/2511.13647}, 
}`;

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="navbar" role="navigation" aria-label="main navigation">
      <div className="container">
        <div className="navbar-brand">
          <a className="navbar-item" href="#overview">
            <strong>Part-X-MLLM</strong>
          </a>
          <button
            className={`navbar-burger ${isOpen ? "is-active" : ""}`}
            aria-label="menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
        <div className={`navbar-menu ${isOpen ? "is-active" : ""}`}>
          <div className="navbar-end">
            {NAV_SECTIONS.map((section) => (
              <a
                key={section.id}
                className="navbar-item"
                href={`#${section.id}`}
                onClick={() => setIsOpen(false)}
              >
                {section.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section id="overview" className="hero-section" style={{ position: "relative" }}>
      <div
        className="hero-media"
        style={{ backgroundImage: "url('./static/images/teaser.png')" }}
        aria-hidden="true"
      />
      <div className="hero-overlay" aria-hidden="true" />
      <div className="container">
        <div className="hero-content">
          <span className="tag is-tech">Part-centric Multimodal Intelligence</span>
          <h1 className="hero-title">
            <GradientText 
              colors={['#47c8ff', '#a658ff', '#ff4fa3', '#47c8ff']}
              animationSpeed={6}
              className="hero-title-gradient"
            >
              Part-
            </GradientText>
            <RotatingText
              texts={ROTATING_X_TEXTS}
              rotationInterval={2400}
              staggerDuration={0.03}
              transition={{ 
                type: 'spring', 
                damping: 15, 
                stiffness: 150,
                mass: 0.5
              }}
              initial={{ y: '100%', opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: '-100%', opacity: 0, scale: 0.8 }}
              animatePresenceMode="wait"
              mainClassName="rotating-x"
            />
            <GradientText 
              colors={['#47c8ff', '#a658ff', '#ff4fa3', '#47c8ff']}
              animationSpeed={6}
              className="hero-title-gradient"
            >
              -MLLM
            </GradientText>
          </h1>
          <p className="hero-tagline">
            A part-aware multimodal language model for unified 3D generation, editing, and grounding —
            engineered to bridge natural language and geometry-native execution.
          </p>
          <div className="cta-group">
            <a className="button cta-button is-primary" href="https://arxiv.org/abs/2511.13647" target="_blank" rel="noopener noreferrer">
              <span className="icon">
                <i className="fas fa-file-alt" />
              </span>
              <span>Paper</span>
            </a>
            <a className="button cta-button" href="https://github.com/AiEson/Part-X-MLLM" target="_blank" rel="noopener noreferrer">
              <span className="icon">
                <i className="fab fa-github" />
              </span>
              <span>Code</span>
            </a>
            <a className="button cta-button" href="#playground">
              <span className="icon">
                <i className="fas fa-play" />
              </span>
              <span>Live Demo (Coming Soon)</span>
            </a>
          </div>
          <div className="metadata-bar">
            {HERO_METADATA.map((item) => (
              <div className="metadata-item" key={item.text}>
                <span className="icon">
                  <i className={item.icon} />
                </span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Author Information */}
          <div className="hero-authors-section">
            <div className="hero-authors-list">
              <div className="hero-authors-row">
                {AUTHORS.slice(0, 5).map((author) => (
                  <div key={author.name} className="hero-author-item">
                    {author.profile ? (
                      <a
                        href={author.profile}
                        className="hero-author-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {author.name}
                      </a>
                    ) : (
                      <span className="hero-author-text">{author.name}</span>
                    )}
                    {author.markers.map((marker) => (
                      <sup key={marker} className="hero-author-marker">{marker}</sup>
                    ))}
                  </div>
                ))}
              </div>
              <div className="hero-authors-row">
                {AUTHORS.slice(5).map((author) => (
                  <div key={author.name} className="hero-author-item">
                    {author.profile ? (
                      <a
                        href={author.profile}
                        className="hero-author-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {author.name}
                      </a>
                    ) : (
                      <span className="hero-author-text">{author.name}</span>
                    )}
                    {author.markers.map((marker) => (
                      <sup key={marker} className="hero-author-marker">{marker}</sup>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-affiliations">
              {AFFILIATIONS.map((affiliation) => (
                <div key={affiliation.id} className="hero-affiliation-item">
                  <span className="hero-affiliation-id">{affiliation.id}</span>
                  <span className="hero-affiliation-name">{affiliation.name}</span>
                </div>
              ))}
            </div>

            <div className="hero-legends">
              {AUTHOR_LEGENDS.map((legend, index) => (
                <span key={legend.symbol} className="hero-legend-item">
                  <span className="hero-legend-symbol">{legend.symbol}</span>
                  <span className="hero-legend-text">{legend.description}</span>
                  {index < AUTHOR_LEGENDS.length - 1 && <span className="hero-legend-separator">·</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthorsSection() {
  return (
    <section id="authors" className="section section-dark">
      <div className="container">
        <p className="section-heading">Acknowledgments</p>
        <h2 className="section-title">Special Thanks</h2>
        <p className="section-lead">
          We extend our gratitude to the following individuals and teams for their invaluable contributions and support.
        </p>
        <div className="acknowledgments-section" style={{ marginTop: "2.5rem" }}>
          <div className="ack-grid">
            {ACKNOWLEDGMENTS.map((paper) => {
              const isCode = /github\.com/i.test(paper.profile || '');
              const domain = (() => {
                try { return new URL(paper.profile).hostname.replace(/^www\./, ''); } catch { return paper.profile; }
              })();
              return (
                <a
                  key={paper.name}
                  href={paper.profile}
                  className="ack-card"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="ack-card-badge">{isCode ? 'Code' : 'Paper'}</span>
                  <div className="ack-card-icon">
                    <i className={isCode ? 'fas fa-code-branch' : 'fas fa-book'} />
                  </div>
                  <div className="ack-card-title">{paper.name}</div>
                  <div className="ack-card-domain">{domain}</div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function AbstractSection() {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <section id="abstract" className="section section-alt">
      <div className="container">
        <p className="section-heading">Abstract</p>
        <h2 className="section-title">Part-Aware 3D MLLM</h2>
        <div className="columns is-variable is-6">
          <div className="column is-two-thirds">
            <div className="content" style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
              {ABSTRACT_PARAGRAPHS.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="column">
            <div
              className="abstract-image-preview"
              onDoubleClick={() => setIsZoomed(true)}
            >
              <img
                src="./static/images/teaser.png"
                alt="Part-X-MLLM teaser"
              />
            </div>
          </div>
        </div>

        {isZoomed && (
          <div
            className="abstract-image-overlay"
            onClick={() => setIsZoomed(false)}
          >
            <div
              className="abstract-image-overlay-inner"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="abstract-image-close"
                aria-label="Close preview"
                onClick={() => setIsZoomed(false)}
              >
                <i className="fas fa-times" />
              </button>
              <img
                src="./static/images/teaser.png"
                alt="Part-X-MLLM teaser enlarged"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PlaygroundSection() {
  return (
    <section id="playground" className="section section-dark">
      <div className="container">
        <p className="section-heading">Pipeline</p>
        <h2 className="section-title">From Point Clouds to X</h2>
        <p className="section-lead">
          Part-X-MLLM encodes 3D geometry and RGB appearance with dual encoders, fuses them with a language
          prompt, and decodes a program-like token sequence that describes parts, bounding boxes, and edit
          commands for downstream 3D engines.
        </p>
        <div className="pipeline-layout">
          <div className="pipeline-card">
            <span className="pipeline-pill">Pipeline Overview</span>
            <h3 className="pipeline-card-title">Structure-aware planning over 3D perception</h3>
            <p className="muted">
              RGB point clouds are lifted into structure tokens and appearance tokens, fused with a prompt-aware text tokenizer,
              and decoded into a compact planning language that downstream 3D engines can execute without ambiguity.
            </p>
            <p className="muted">
              Dual encoders first process xyz+normal features alongside RGB appearance to produce structure-aware and semantic-aware token stacks.
              These tokens are concatenated with prompt tokens and passed into a decoder-only LLM that emits a programmatic description of each part.
            </p>
            <p className="muted">
              Specialized heads interpret the decoded tokens as bounding boxes, edit commands, and question-answer hooks so external 3D engines can generate,
              refine, or localize edits directly from language instructions without manual retargeting.
            </p>
          </div>
          <div className="pipeline-figure">
            <div className="pipeline-figure-inner">
              <img
                src="./static/images/pipeline.png"
                alt="Part-X-MLLM pipeline"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="section section-alt">
      <div className="container">
        <div className="keycontrib-card">
          <p className="section-heading">Pipeline Details</p>
          <h2 className="section-title">Task Realization with a Planning Language</h2>
          <p className="section-lead">
            This figure summarizes how a single planning language in Part-X-MLLM drives part-aware mesh generation, grounded Q&amp;A, and auto-located 3D editing through one executable program.
          </p>
          <div className="keycontrib-layout">
            <div className="keycontrib-copy">
              <p className="muted">
                In <strong>part-aware mesh generation</strong>, the decoder outputs bounding boxes and optional part text, which a synthesis module treats as spatial guides to create high-fidelity, part-based assets.
              </p>
              <p className="muted">
                In <strong>Q&amp;A with grounding</strong>, answers are augmented with BBox tokens so the language response carries explicit, persistent references to parts instead of free-form descriptions alone.
              </p>
              <p className="muted">
                For <strong>auto-located 3D editing</strong>, the model generates bounding boxes together with edit commands (e.g., {"<adds>"}), and a downstream editing head applies masked edits inside the predicted cuboids.
              </p>
              <p className="muted">
                The same box-and-text representation also supports <strong>semantic granularity control</strong>, clustering part boxes by text embeddings to smoothly merge fine-grained parts into coarser semantic components.
              </p>
            </div>
            <div className="keycontrib-figure">
              <img
                src="./static/images/detail_pipeline.png"
                alt="Task realization with a planning language in Part-X-MLLM"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultsSection() {
  return (
    <section id="results" className="section section-dark">
      <div className="container">
        <p className="section-heading">Results</p>
        <h2 className="section-title">Quantitative Evaluation on UniPart-Bench</h2>
        <p className="section-lead">
          UniPart-Bench is a held-out set of 400 part-centric 3D objects used to evaluate the quality of our structured plans&mdash;from BBox layouts to downstream generation and editing driven by external geometry engines.
        </p>
        <div className="results-layout">
          <article className="results-block">
            <h3 className="title is-5">Bounding Box Generation</h3>
            <p className="muted">
              We compare against PartField and OmniPart on Voxel Recall, Voxel IoU, and BBox IoU. Part-X-MLLM consumes RGB point cloud tokens and a text prompt, and autoregressively emits an ordered list of bounding boxes following our box grammar.
            </p>
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Voxel recall &uarr;</th>
                  <th>Voxel IoU &uarr;</th>
                  <th>BBox IoU &uarr;</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>PartField</td>
                  <td>69.65</td>
                  <td>46.04</td>
                  <td>37.33</td>
                </tr>
                <tr>
                  <td>OmniPart</td>
                  <td>72.32</td>
                  <td>47.62</td>
                  <td>39.78</td>
                </tr>
                <tr>
                  <td className="metric-highlight">Part-X-MLLM (Ours)</td>
                  <td className="metric-highlight">74.11</td>
                  <td className="metric-highlight">48.74</td>
                  <td className="metric-highlight">42.55</td>
                </tr>
              </tbody>
            </table>
          </article>

          <article className="results-block">
            <h3 className="title is-5">Ablation: Dual vs. Single Encoder</h3>
            <p className="muted">
              To validate our dual-encoder design, we compare against a single-encoder variant that jointly processes geometry and appearance. The dual encoder consistently improves IoU and text metrics across box listing, multi-part grounding, and part QA.
            </p>
            <div className="results-table-scroll">
              <table className="metric-table metric-table--compact">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Model</th>
                    <th>IoU &uarr;</th>
                    <th>SBERT &uarr;</th>
                    <th>SimCSE &uarr;</th>
                    <th>BLEU-1 &uarr;</th>
                    <th>ROUGE-L &uarr;</th>
                    <th>METEOR &uarr;</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td rowSpan={3}>Pure Box Listing</td>
                    <td className="metric-highlight">Dual Encoder (Ours)</td>
                    <td className="metric-highlight">75.53</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                  <tr>
                    <td>Single Encoder</td>
                    <td>68.47</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                  <tr>
                    <td>&Delta; Gain</td>
                    <td>+7.06</td>
                    <td>&mdash;</td>
                    <td>&mdash;</td>
                    <td>&mdash;</td>
                    <td>&mdash;</td>
                    <td>&mdash;</td>
                  </tr>
                  <tr>
                    <td rowSpan={3}>Multi-Part Grounding</td>
                    <td className="metric-highlight">Dual Encoder (Ours)</td>
                    <td className="metric-highlight">72.82</td>
                    <td className="metric-highlight">55.60</td>
                    <td className="metric-highlight">54.19</td>
                    <td className="metric-highlight">35.55</td>
                    <td className="metric-highlight">35.58</td>
                    <td className="metric-highlight">18.09</td>
                  </tr>
                  <tr>
                    <td>Single Encoder</td>
                    <td>69.78</td>
                    <td>54.18</td>
                    <td>53.53</td>
                    <td>33.95</td>
                    <td>33.97</td>
                    <td>17.27</td>
                  </tr>
                  <tr>
                    <td>&Delta; Gain</td>
                    <td>+3.04</td>
                    <td>+1.42</td>
                    <td>+0.66</td>
                    <td>+1.60</td>
                    <td>+1.61</td>
                    <td>+0.82</td>
                  </tr>
                  <tr>
                    <td rowSpan={3}>Part QA</td>
                    <td className="metric-highlight">Dual Encoder (Ours)</td>
                    <td className="metric-highlight">55.44</td>
                    <td className="metric-highlight">78.98</td>
                    <td className="metric-highlight">84.25</td>
                    <td className="metric-highlight">40.54</td>
                    <td className="metric-highlight">42.26</td>
                    <td className="metric-highlight">34.24</td>
                  </tr>
                  <tr>
                    <td>Single Encoder</td>
                    <td>54.24</td>
                    <td>78.44</td>
                    <td>83.13</td>
                    <td>39.29</td>
                    <td>41.31</td>
                    <td>33.06</td>
                  </tr>
                  <tr>
                    <td>&Delta; Gain</td>
                    <td>+1.20</td>
                    <td>+0.54</td>
                    <td>+1.12</td>
                    <td>+1.25</td>
                    <td>+0.95</td>
                    <td>+1.18</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function MethodologySection() {
  return (
    <section id="method" className="section section-alt">
      <div className="container">
        <p className="section-heading">How It Works</p>
        <h2 className="section-title">A Modular Architecture for Symbolic + Geometric Intelligence</h2>
        <p className="section-lead">
          Part-X-MLLM orchestrates reasoning across complementary modules to translate natural language intent into machine-actionable geometry programs.
        </p>
        <div className="columns is-variable is-6" style={{ marginTop: "2.5rem" }}>
          <div className="column is-two-thirds">
            <div className="columns is-multiline is-variable is-4">
              {METHODOLOGY_STEPS.map((step) => (
                <div key={step.title} className="column is-full">
                  <article className="methodology-card">
                    <span className="icon-circle">
                      <i className={step.icon} />
                    </span>
                    <h3 className="title is-5">{step.title}</h3>
                    <p className="muted">{step.description}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
          <div className="column">
            <div className="method-image">
              <img src="./static/images/pipeline.png" alt="Part-X-MLLM pipeline" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BenchmarkSection() {
  return (
    <section id="benchmark" className="section section-dark">
      <div className="container">
        <p className="section-heading">UniPart-Bench</p>
        <h2 className="section-title">Benchmarking Structured Part Reasoning</h2>
        <p className="section-lead">
          UniPart-Bench is our held-out evaluation suite of 400 assets designed to stress-test program validity, geometric fidelity, and part-aware grounding. Part-X-MLLM sets a new frontier across metrics.
        </p>
        <div className="stat-cards">
          {BENCHMARK_METRICS.map((item) => (
            <div key={item.metric} className="stat-card">
              <div className="stat-value">{item.ours}</div>
              <div className="stat-label">{item.metric}</div>
              <p className="muted" style={{ marginTop: "0.65rem" }}>{item.baseline}</p>
            </div>
          ))}
        </div>
        <h3 className="title is-4" style={{ marginTop: "3rem" }}>Part Understanding Q&A Performance</h3>
        <table className="metric-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Part-X-MLLM</th>
              <th>Gain vs. Strongest Baseline</th>
            </tr>
          </thead>
          <tbody>
            {QA_METRICS.map((metric) => (
              <tr key={metric.metric}>
                <td>{metric.metric}</td>
                <td className="metric-highlight">{metric.ours}</td>
                <td>{metric.gain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CitationSection() {
  return (
    <section id="citation" className="section section-alt">
      <div className="container">
        <p className="section-heading">Citation</p>
        <h2 className="section-title">Reference Part-X-MLLM</h2>
        <p className="section-lead">
          Use the following BibTeX entry to cite our work.
        </p>
        <pre>
          <code>{BIBTEX}</code>
        </pre>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="content has-text-centered">
          <a className="icon-link" href="#overview">
            <i className="fas fa-arrow-up" />
          </a>
          <a className="icon-link" href="https://3d.hunyuan.tencent.com/">
            <i className="fas fa-globe" />
          </a>
        </div>
        <div className="columns is-centered" style={{ marginTop: "1.5rem" }}>
          <div className="column is-8">
            <div className="content has-text-centered">
              <p>
                Project page for Part-X-MLLM, adapted from the Nerfies website template. If you reuse this design, please credit both Nerfies and Part-X-MLLM.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <React.Fragment>
      <Navbar />
      <HeroSection />
      <AbstractSection />
      <PlaygroundSection />
      <FeaturesSection />
      <EditingSection />
      <MeshGenSection />
      <CitationSection />
      <AuthorsSection />
      <Footer />
    </React.Fragment>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
