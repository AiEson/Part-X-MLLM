(() => {
  const {
    useMemo,
    useState,
    useCallback,
    useEffect,
    useImperativeHandle,
    forwardRef,
    useRef
  } = React;
  function cn(...classes) {
    return classes.filter(Boolean).join(" ");
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
      var _a, _b, _c, _d, _e, _f;
      if (!el) return null;
      if (el.scene && el.scene.traverse) return el.scene;
      if (el.scene && el.scene.threeScene && el.scene.threeScene.traverse) return el.scene.threeScene;
      try {
        const syms = Object.getOwnPropertySymbols(el);
        for (const s of syms) {
          const v = el[s];
          if (!v) continue;
          if ((_a = v.scene) == null ? void 0 : _a.traverse) return v.scene;
          if ((_b = v.threeScene) == null ? void 0 : _b.traverse) return v.threeScene;
          if ((_d = (_c = v.renderer) == null ? void 0 : _c.scene) == null ? void 0 : _d.traverse) return v.renderer.scene;
        }
      } catch (e) {
      }
      try {
        const keys = Object.getOwnPropertyNames(el).slice(0, 50);
        for (const k of keys) {
          const v = el[k];
          if (!v || typeof v !== "object") continue;
          if ((_e = v.scene) == null ? void 0 : _e.traverse) return v.scene;
          if ((_f = v.threeScene) == null ? void 0 : _f.traverse) return v.threeScene;
        }
      } catch (e) {
      }
      return null;
    }, []);
    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const loadScript = (src) => new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.defer = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Load failed: ${src}`));
        document.head.appendChild(s);
      });
      const loadAny = async (urls) => {
        let lastErr;
        for (const u of urls) {
          try {
            await loadScript(u);
            return;
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr || new Error("All CDN sources failed");
      };
      const ensureThree = async () => {
        if (!window.THREE) {
          await loadAny([
            "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js",
            "https://unpkg.com/three@0.134.0/build/three.min.js"
          ]);
        }
        if (!window.THREE.OrbitControls) {
          await loadAny([
            "https://cdn.jsdelivr.net/npm/three/examples/js/controls/OrbitControls.js",
            "https://unpkg.com/three/examples/js/controls/OrbitControls.js"
          ]);
        }
        if (!window.THREE.GLTFLoader) {
          await loadAny([
            "https://cdn.jsdelivr.net/npm/three/examples/js/loaders/GLTFLoader.js",
            "https://unpkg.com/three/examples/js/loaders/GLTFLoader.js"
          ]);
        }
        if (!window.THREE.DRACOLoader) {
          await loadAny([
            "https://cdn.jsdelivr.net/npm/three/examples/js/loaders/DRACOLoader.js",
            "https://unpkg.com/three/examples/js/loaders/DRACOLoader.js"
          ]);
        }
        if (!window.MeshoptDecoder) {
          await loadAny([
            "https://unpkg.com/meshoptimizer@0.20.0/meshopt_decoder.js",
            "https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_decoder.js"
          ]);
        }
      };
      let disposed = false;
      (async () => {
        try {
          await ensureThree();
          if (disposed) return;
          if (threeRef.current.raf) cancelAnimationFrame(threeRef.current.raf);
          if (threeRef.current.renderer) {
            try {
              wrap.removeChild(threeRef.current.renderer.domElement);
            } catch (e) {
            }
          }
          const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
          renderer.setClearColor(2499381, 1);
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
          scene.add(new THREE.AmbientLight(16777215, 0.25));
          const hemi = new THREE.HemisphereLight(7240639, 328969, 0.35);
          scene.add(hemi);
          const dir1 = new THREE.DirectionalLight(16777215, 0.8);
          dir1.position.set(6, 10, 8);
          scene.add(dir1);
          const dir2 = new THREE.DirectionalLight(16777215, 0.35);
          dir2.position.set(-6, 6, -4);
          scene.add(dir2);
          const rim = new THREE.DirectionalLight(16777215, 0.25);
          rim.position.set(0, 0, -6);
          scene.add(rim);
          threeRef.current = { renderer, scene, camera, controls, raf: 0 };
          setProgress(0.01);
          setLoading(true);
          setExplode(0);
          setErrorMsg(null);
          if (threeRef.current.progressTimer) clearInterval(threeRef.current.progressTimer);
          threeRef.current.progressTimer = setInterval(() => {
            setProgress((p) => p < 0.9 ? Math.min(0.9, p + 0.02) : p);
          }, 400);
          const loader = new THREE.GLTFLoader();
          if (window.THREE.DRACOLoader) {
            const draco = new THREE.DRACOLoader();
            draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
            loader.setDRACOLoader(draco);
          }
          if (window.MeshoptDecoder) {
            loader.setMeshoptDecoder(window.MeshoptDecoder);
          }
          const url = new URL(item.src, window.location.href).href;
          const baseForParse = new URL("./", url).href;
          const onSuccess = (gltf) => {
            if (disposed) return;
            const root = gltf.scene;
            root.traverse((child) => {
              if (child.isMesh && child.material) {
                child.material.metalness = 0;
                child.material.roughness = 0.85;
                if (typeof child.material.envMapIntensity === "number") {
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
            const dist = maxDim * scale / (2 * Math.tan(fov / 2)) + 0.5;
            camera.position.set(0.6 * dist, 0.3 * dist, dist);
            camera.lookAt(0, 0, 0);
            const partsParent = root.children[0] || root;
            const parts = [];
            partsParent.children.forEach((part) => {
              part.userData.originalPosition = part.position.clone();
              parts.push(part);
            });
            const radius = Math.max(size.x, size.y, size.z) * scale || 1;
            explodeDataRef.current = { ready: parts.length > 1, parts, radius, root: partsParent, center: new THREE.Vector3(0, 0, 0) };
            if (threeRef.current.progressTimer) {
              clearInterval(threeRef.current.progressTimer);
              threeRef.current.progressTimer = null;
            }
            setProgress(1);
            setLoading(false);
            setErrorMsg(null);
            applyExplodeImmediate(explode);
          };
          const onProgress = (xhr) => {
            if (disposed) return;
            const t = xhr.total || 0;
            if (t > 0) {
              setProgress(Math.min(1, xhr.loaded / t));
            } else {
              setProgress((p) => p < 0.5 ? 0.5 : p);
            }
          };
          const onError = async (err) => {
            console && console.warn && console.warn("GLB direct load failed, trying fetch+parse", url, err);
            try {
              const resp = await fetch(url);
              const buf = await resp.arrayBuffer();
              loader.parse(buf, baseForParse, onSuccess, (e) => {
                console && console.error && console.error("GLB parse failed", e);
                if (threeRef.current.progressTimer) {
                  clearInterval(threeRef.current.progressTimer);
                  threeRef.current.progressTimer = null;
                }
                if (!disposed) {
                  setLoading(false);
                  setProgress(0);
                  setErrorMsg("Load failed");
                }
              });
            } catch (e2) {
              console && console.error && console.error("GLB fetch failed", e2);
              if (threeRef.current.progressTimer) {
                clearInterval(threeRef.current.progressTimer);
                threeRef.current.progressTimer = null;
              }
              if (!disposed) {
                setLoading(false);
                setProgress(0);
                setErrorMsg("Load failed");
              }
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
          window.addEventListener("resize", onResize);
          threeRef.current.cleanup = () => {
            window.removeEventListener("resize", onResize);
            if (threeRef.current.raf) cancelAnimationFrame(threeRef.current.raf);
            try {
              controls.dispose();
            } catch (e) {
            }
            try {
              renderer.dispose();
            } catch (e) {
            }
            try {
              wrap.removeChild(renderer.domElement);
            } catch (e) {
            }
            if (threeRef.current.progressTimer) {
              clearInterval(threeRef.current.progressTimer);
              threeRef.current.progressTimer = null;
            }
            threeRef.current = { renderer: null, scene: null, camera: null, controls: null, raf: 0 };
          };
        } catch (e) {
          console && console.error && console.error("Three ensure failed", e);
          setErrorMsg("Lib load failed");
          setLoading(false);
        }
      })();
      return () => {
        disposed = true;
        if (threeRef.current.cleanup) threeRef.current.cleanup();
      };
    }, [item == null ? void 0 : item.src]);
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    const applyExplodeImmediate = useCallback((value) => {
      var _a;
      const data = explodeDataRef.current;
      if (!data.ready || !((_a = data.parts) == null ? void 0 : _a.length)) return;
      const distance = (data.radius || 1) * 0.6 * value;
      data.parts.forEach((part) => {
        try {
          const bbox = new THREE.Box3().setFromObject(part);
          const c = bbox.getCenter(new THREE.Vector3());
          const dir = c.normalize();
          const base = part.userData.originalPosition || part.position.clone();
          const offset = dir.multiplyScalar(distance);
          part.position.copy(base.clone().add(offset));
        } catch (e) {
        }
      });
    }, []);
    useEffect(() => {
      applyExplodeImmediate(explode);
    }, [explode, applyExplodeImmediate]);
    return /* @__PURE__ */ React.createElement("div", { className: "viewer-card meshgen-card" }, /* @__PURE__ */ React.createElement("span", { className: "viewer-label" }, item.label), /* @__PURE__ */ React.createElement("div", { ref: wrapRef, className: "three-wrap", style: { width: "100%", height: "300px", background: "#262335" } }), /* @__PURE__ */ React.createElement("div", { className: "mv-progress", style: { opacity: loading || errorMsg ? 1 : 0 }, "aria-hidden": !(loading || errorMsg) }, /* @__PURE__ */ React.createElement("div", { className: "mv-progress-track" }, /* @__PURE__ */ React.createElement("div", { className: "mv-progress-bar", style: { width: `${pct}%` } })), /* @__PURE__ */ React.createElement("div", { className: "mv-progress-text" }, errorMsg ? errorMsg : `${pct}%`)), !loading && /* @__PURE__ */ React.createElement("div", { className: "mv-explode" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "range",
        min: "0",
        max: "100",
        value: Math.round(explode * 100),
        onChange: (e) => setExplode(Math.max(0, Math.min(1, Number(e.target.value) / 100))),
        onInput: (e) => setExplode(Math.max(0, Math.min(1, Number(e.target.value) / 100))),
        "aria-label": "Exploded view",
        style: { ["--explode-pct"]: `${Math.round(explode * 100)}%` }
      }
    ), /* @__PURE__ */ React.createElement("span", { className: "mv-explode-label" }, "Explode")));
  }
  function MeshGenSection() {
    const [items, setItems] = useState([]);
    useEffect(() => {
      fetch("./static/meshes/mesh_gen/manifest.json").then((res) => res.json()).then((data) => setItems(data || [])).catch(() => setItems([]));
    }, []);
    return /* @__PURE__ */ React.createElement("section", { id: "mesh-gen", className: "section section-dark" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("p", { className: "section-heading" }, "Mesh Generation"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Single-object GLB Gallery"), items.length ? /* @__PURE__ */ React.createElement("div", { className: "meshgen-grid" }, items.map((it) => /* @__PURE__ */ React.createElement(MeshGenCard, { key: it.id, item: it }))) : /* @__PURE__ */ React.createElement("p", { className: "muted", style: { marginTop: "1.5rem" } }, "Loading mesh list\u2026")));
  }
  function EditingSection() {
    const [items, setItems] = useState([]);
    const [active, setActive] = useState(0);
    const beforeRef = useRef(null);
    const afterRef = useRef(null);
    const stripRef = useRef(null);
    useEffect(() => {
      fetch("./static/meshes/editing/manifest.json").then((res) => res.json()).then((data) => setItems(data || [])).catch(() => setItems([]));
    }, []);
    const current = items[active];
    const prev = () => setActive((i) => (i - 1 + items.length) % items.length);
    const next = () => setActive((i) => (i + 1) % items.length);
    const resetView = () => {
      [beforeRef.current, afterRef.current].forEach((el) => {
        if (el) {
          el.setAttribute("camera-orbit", "-35deg 75deg auto");
          el.setAttribute("camera-target", "auto");
          el.setAttribute("field-of-view", "25deg");
        }
      });
    };
    const scrollToActive = (index) => {
      const strip = stripRef.current;
      if (!strip) return;
      const cards = strip.querySelectorAll(".thumb-card");
      const card = cards[index];
      if (!card) return;
      const stripWidth = strip.clientWidth;
      const maxScroll = strip.scrollWidth - stripWidth;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const target = Math.min(Math.max(cardCenter - stripWidth / 2, 0), Math.max(maxScroll, 0));
      strip.scrollTo({ left: target, behavior: "smooth" });
    };
    useEffect(() => {
      if (items.length) scrollToActive(active);
    }, [active, items.length]);
    return /* @__PURE__ */ React.createElement("section", { id: "editing-viewer", className: "section section-dark" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("p", { className: "section-heading" }, "Editing"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Edited Meshes Gallery"), /* @__PURE__ */ React.createElement("p", { className: "section-lead" }), current ? /* @__PURE__ */ React.createElement("div", { className: "model-grid" }, /* @__PURE__ */ React.createElement("div", { className: "viewer-card" }, /* @__PURE__ */ React.createElement("span", { className: "viewer-label" }, "Before"), /* @__PURE__ */ React.createElement(
      "model-viewer",
      {
        src: current.srcGlb,
        alt: `Before model of ${current.id}`,
        exposure: "1.1",
        "shadow-intensity": "0.4",
        "environment-image": "neutral",
        "camera-controls": true,
        "interaction-prompt": "none",
        "interaction-policy": "always-allow",
        "camera-target": "auto",
        "camera-orbit": "-35deg 75deg auto",
        "field-of-view": "25deg",
        bounds: "tight",
        ref: beforeRef,
        style: { width: "100%", height: "420px", background: "#262335" }
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "viewer-card" }, /* @__PURE__ */ React.createElement("span", { className: "viewer-label" }, "After"), /* @__PURE__ */ React.createElement(
      "model-viewer",
      {
        src: current.tarGlb,
        alt: `After model of ${current.id}`,
        exposure: "1.1",
        "shadow-intensity": "0.4",
        "environment-image": "neutral",
        "camera-controls": true,
        "interaction-prompt": "none",
        "interaction-policy": "always-allow",
        "camera-target": "auto",
        "camera-orbit": "-35deg 75deg auto",
        "field-of-view": "25deg",
        bounds: "tight",
        ref: afterRef,
        style: { width: "100%", height: "420px", background: "#262335" }
      }
    ))) : /* @__PURE__ */ React.createElement("p", { className: "muted", style: { marginTop: "1.5rem" } }, "Loading editing assets\u2026"), /* @__PURE__ */ React.createElement("div", { className: "viewer-tools" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-mini", onClick: resetView }, "Reset to -35\xB0")), /* @__PURE__ */ React.createElement("div", { className: "thumbs" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "thumbs-nav is-left", onClick: prev, "aria-label": "Previous group" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-chevron-left" })), /* @__PURE__ */ React.createElement("div", { className: "thumbs-strip", ref: stripRef }, items.map((it, idx) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: it.id,
        type: "button",
        className: `thumb-card ${idx === active ? "is-active" : ""}`,
        onClick: () => setActive(idx),
        "aria-label": `Select ${it.label}`
      },
      /* @__PURE__ */ React.createElement("div", { className: "thumb-pair" }, /* @__PURE__ */ React.createElement("img", { src: it.srcThumb, alt: `${it.label} before (-35\xB0)` }), /* @__PURE__ */ React.createElement("img", { src: it.tarThumb, alt: `${it.label} after (-35\xB0)` })),
      /* @__PURE__ */ React.createElement("div", { className: "thumb-caption" }, it.label)
    ))), /* @__PURE__ */ React.createElement("button", { type: "button", className: "thumbs-nav is-right", onClick: next, "aria-label": "Next group" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-chevron-right" })))));
  }
  function GradientText({
    children,
    className = "",
    colors = ["#47c8ff", "#a658ff", "#ff4fa3", "#47c8ff"],
    animationSpeed = 8,
    showBorder = false
  }) {
    const gradientStyle = {
      backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
      animationDuration: `${animationSpeed}s`,
      backgroundSize: "300% 100%"
    };
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        className: `gradient-text-wrapper ${className}`,
        style: { position: "relative", display: "inline-block" }
      },
      showBorder && /* @__PURE__ */ React.createElement(
        "span",
        {
          className: "gradient-text-border",
          style: {
            ...gradientStyle,
            position: "absolute",
            inset: 0,
            animation: "gradient-shift 8s linear infinite"
          }
        }
      ),
      /* @__PURE__ */ React.createElement(
        "span",
        {
          className: "gradient-text-content",
          style: {
            ...gradientStyle,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            animation: "gradient-shift 8s linear infinite",
            display: "inline-block"
          }
        },
        children
      )
    );
  }
  function resolveMotion() {
    if (typeof window === "undefined") {
      return { motion: void 0, AnimatePresence: void 0 };
    }
    if (window.motion && window.AnimatePresence) {
      return { motion: window.motion, AnimatePresence: window.AnimatePresence };
    }
    if (window.Motion) {
      const motionExport = window.Motion.motion || window.Motion;
      const animatePresenceExport = window.Motion.AnimatePresence;
      if (motionExport && animatePresenceExport) {
        return { motion: motionExport, AnimatePresence: animatePresenceExport };
      }
    }
    const globalNames = ["framerMotion", "FramerMotion"];
    for (const name of globalNames) {
      const mod = window[name];
      if (mod && mod.motion && mod.AnimatePresence) {
        return { motion: mod.motion, AnimatePresence: mod.AnimatePresence };
      }
    }
    return { motion: void 0, AnimatePresence: void 0 };
  }
  const RotatingText = forwardRef((props, ref) => {
    const {
      texts,
      transition = { type: "spring", damping: 25, stiffness: 300 },
      initial = { y: "100%", opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: "-120%", opacity: 0 },
      animatePresenceMode = "wait",
      animatePresenceInitial = false,
      rotationInterval = 2e3,
      staggerDuration = 0,
      staggerFrom = "first",
      loop = true,
      auto = true,
      splitBy = "characters",
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
    useEffect(() => {
      if (hasMotion || typeof window === "undefined") {
        return void 0;
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
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
        return Array.from(segmenter.segment(text), (segment) => segment.segment);
      }
      return Array.from(text);
    }, []);
    const elements = useMemo(() => {
      const currentText2 = texts[currentTextIndex] || "";
      if (splitBy === "characters") {
        const words = currentText2.split(" ");
        return words.map((word, i) => ({
          characters: splitIntoCharacters(word),
          needsSpace: i !== words.length - 1
        }));
      }
      if (splitBy === "words") {
        return currentText2.split(" ").map((word, i, arr) => ({
          characters: [word],
          needsSpace: i !== arr.length - 1
        }));
      }
      if (splitBy === "lines") {
        return currentText2.split("\n").map((line, i, arr) => ({
          characters: [line],
          needsSpace: i !== arr.length - 1
        }));
      }
      return currentText2.split(splitBy).map((part, i, arr) => ({
        characters: [part],
        needsSpace: i !== arr.length - 1
      }));
    }, [texts, currentTextIndex, splitBy, splitIntoCharacters]);
    const getStaggerDelay = useCallback(
      (index, totalChars) => {
        if (staggerFrom === "first") return index * staggerDuration;
        if (staggerFrom === "last") return (totalChars - 1 - index) * staggerDuration;
        if (staggerFrom === "center") {
          const center = Math.floor(totalChars / 2);
          return Math.abs(center - index) * staggerDuration;
        }
        if (staggerFrom === "random") {
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
      const nextIndex = currentTextIndex === texts.length - 1 ? loop ? 0 : currentTextIndex : currentTextIndex + 1;
      if (nextIndex !== currentTextIndex) {
        handleIndexChange(nextIndex);
      }
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);
    const previous = useCallback(() => {
      const prevIndex = currentTextIndex === 0 ? loop ? texts.length - 1 : currentTextIndex : currentTextIndex - 1;
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
        reset
      }),
      [next, previous, jumpTo, reset]
    );
    useEffect(() => {
      if (!auto) return void 0;
      const intervalId = setInterval(next, rotationInterval);
      return () => clearInterval(intervalId);
    }, [next, rotationInterval, auto]);
    if (!hasMotion) {
      return /* @__PURE__ */ React.createElement("span", { className: cn("rotating-text-fallback", mainClassName), ...rest }, texts[currentTextIndex]);
    }
    const currentText = texts[currentTextIndex];
    const totalCharacters = elements.reduce((sum, word) => sum + word.characters.length, 0);
    return /* @__PURE__ */ React.createElement(
      motion.span,
      {
        className: cn("rotating-text", mainClassName),
        layout: true,
        transition,
        ...rest
      },
      /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, currentText),
      /* @__PURE__ */ React.createElement(AnimatePresence, { mode: animatePresenceMode, initial: animatePresenceInitial }, /* @__PURE__ */ React.createElement(
        motion.span,
        {
          key: currentTextIndex,
          className: cn(
            "rotating-text-layer",
            splitBy === "lines" ? "rotating-text-lines" : null
          ),
          layout: true,
          "aria-hidden": "true"
        },
        elements.map((wordObj, wordIndex, array) => {
          const previousCharsCount = array.slice(0, wordIndex).reduce((sum, word) => sum + word.characters.length, 0);
          return /* @__PURE__ */ React.createElement(
            "span",
            {
              key: wordIndex,
              className: cn("rotating-text-word", splitLevelClassName)
            },
            wordObj.characters.map((char, charIndex) => /* @__PURE__ */ React.createElement(
              motion.span,
              {
                key: charIndex,
                initial,
                animate,
                exit,
                transition: {
                  ...transition,
                  delay: getStaggerDelay(previousCharsCount + charIndex, totalCharacters)
                },
                className: cn("rotating-text-char", elementLevelClassName)
              },
              char
            )),
            wordObj.needsSpace && /* @__PURE__ */ React.createElement("span", { className: "rotating-text-space" }, " ")
          );
        })
      ))
    );
  });
  const ROTATING_X_TEXTS = ["X", "Grounding", "Captioning", "Understanding", "Editing", "Generation"];
  const NAV_SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "abstract", label: "Abstract" },
    { id: "playground", label: "Pipeline" },
    { id: "editing-viewer", label: "Editing" },
    { id: "mesh-gen", label: "Part Gen" },
    { id: "citation", label: "Citation" },
    { id: "authors", label: "Acknowledgments" }
  ];
  const AUTHORS = [
    {
      name: "Chunshi Wang",
      markers: ["\u2020", "1", "2"],
      profile: "https://chunshi.wang/"
    },
    {
      name: "Junliang Ye",
      markers: ["\u2020", "\u2021", "3", "2"],
      profile: "https://jamesyjl.github.io/"
    },
    {
      name: "Yunhan Yang",
      markers: ["\u2020", "4", "2"],
      profile: "https://yhyang-myron.github.io/"
    },
    {
      name: "Yang Li",
      markers: ["2"],
      profile: "https://yang-l1.github.io/"
    },
    {
      name: "Zizhuo Lin",
      markers: ["1"],
      profile: null
    },
    {
      name: "Jun Zhu",
      markers: ["3"],
      profile: "https://ml.cs.tsinghua.edu.cn/~jun/"
    },
    {
      name: "Zhuo Chen",
      markers: ["2"],
      profile: null
    },
    {
      name: "Yawei Luo",
      markers: ["\u2709", "1"],
      profile: "https://scholar.google.com/citations?user=pnVwaGsAAAAJ"
    },
    {
      name: "Chunchao Guo",
      markers: ["\u2709", "2"],
      profile: null
    }
  ];
  const AFFILIATIONS = [
    { id: "1", name: "Zhejiang University" },
    { id: "2", name: "Tencent Hunyuan" },
    { id: "3", name: "Tsinghua University" },
    { id: "4", name: "The University of Hong Kong" }
  ];
  const AUTHOR_LEGENDS = [
    { symbol: "\u2020", description: "Equal Contribution" },
    { symbol: "\u2021", description: "Project Lead" },
    { symbol: "\u2709", description: "Corresponding Author" }
  ];
  const ACKNOWLEDGMENTS = [
    { name: "OmniPart", profile: "https://omnipart.github.io/" },
    { name: "Nano3D", profile: "https://jamesyjl.github.io/Nano3D/" },
    { name: "VoxHammer", profile: "https://huanngzh.github.io/VoxHammer-Page/" },
    { name: "ShapeLLM-Omni", profile: "https://jamesyjl.github.io/ShapeLLM/" },
    { name: "PointLLM", profile: "https://runsenxu.com/projects/PointLLM/" },
    { name: "Hunyuan3D-Omni", profile: "https://github.com/Tencent-Hunyuan/Hunyuan3D-Omni" }
  ];
  const HERO_METADATA = [
    { icon: "fas fa-atom", text: "Dual-encoder 3D geometry & appearance" },
    { icon: "fas fa-shapes", text: "Programmatic part-level planning" },
    { icon: "fas fa-project-diagram", text: "Universal frontend for 3D engines" }
  ];
  const ABSTRACT_PARAGRAPHS = [
    "We introduce Part-X-MLLM, a native 3D multimodal large language model that unifies diverse 3D tasks by formulating them as programs in a structured, executable grammar. Given an RGB point cloud and a natural language prompt, our model autoregressively generates a single, coherent token sequence encoding part-level bounding boxes, semantic descriptions, and edit commands. This structured output serves as a versatile interface to drive downstream geometry-aware modules for part-based generation and editing. By decoupling the symbolic planning from the geometric synthesis, our approach allows any compatible geometry engine to be controlled through a single, language-native frontend. We pre-train a dual-encoder architecture to disentangle structure from semantics and instruction-tune the model on a large-scale, part-centric dataset. Experiments demonstrate that our model excels at producing high-quality, structured plans, enabling state-of-the-art performance in grounded Q&A, compositional generation, and localized editing through one unified interface."
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
    return /* @__PURE__ */ React.createElement("nav", { className: "navbar", role: "navigation", "aria-label": "main navigation" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("div", { className: "navbar-brand" }, /* @__PURE__ */ React.createElement("a", { className: "navbar-item", href: "#overview" }, /* @__PURE__ */ React.createElement("strong", null, "Part-X-MLLM")), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: `navbar-burger ${isOpen ? "is-active" : ""}`,
        "aria-label": "menu",
        "aria-expanded": isOpen,
        onClick: () => setIsOpen((prev) => !prev),
        type: "button"
      },
      /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }),
      /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }),
      /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" })
    )), /* @__PURE__ */ React.createElement("div", { className: `navbar-menu ${isOpen ? "is-active" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "navbar-end" }, NAV_SECTIONS.map((section) => /* @__PURE__ */ React.createElement(
      "a",
      {
        key: section.id,
        className: "navbar-item",
        href: `#${section.id}`,
        onClick: () => setIsOpen(false)
      },
      section.label
    ))))));
  }
  function HeroSection() {
    return /* @__PURE__ */ React.createElement("section", { id: "overview", className: "hero-section", style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "hero-media",
        style: { backgroundImage: "url('./static/images/teaser.png')" },
        "aria-hidden": "true"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "hero-overlay", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("div", { className: "hero-content" }, /* @__PURE__ */ React.createElement("span", { className: "tag is-tech" }, "Part-centric Multimodal Intelligence"), /* @__PURE__ */ React.createElement("h1", { className: "hero-title" }, /* @__PURE__ */ React.createElement(
      GradientText,
      {
        colors: ["#47c8ff", "#a658ff", "#ff4fa3", "#47c8ff"],
        animationSpeed: 6,
        className: "hero-title-gradient"
      },
      "Part-"
    ), /* @__PURE__ */ React.createElement(
      RotatingText,
      {
        texts: ROTATING_X_TEXTS,
        rotationInterval: 2400,
        staggerDuration: 0.03,
        transition: {
          type: "spring",
          damping: 15,
          stiffness: 150,
          mass: 0.5
        },
        initial: { y: "100%", opacity: 0, scale: 0.8 },
        animate: { y: 0, opacity: 1, scale: 1 },
        exit: { y: "-100%", opacity: 0, scale: 0.8 },
        animatePresenceMode: "wait",
        mainClassName: "rotating-x"
      }
    ), /* @__PURE__ */ React.createElement(
      GradientText,
      {
        colors: ["#47c8ff", "#a658ff", "#ff4fa3", "#47c8ff"],
        animationSpeed: 6,
        className: "hero-title-gradient"
      },
      "-MLLM"
    )), /* @__PURE__ */ React.createElement("p", { className: "hero-tagline" }, "A part-aware multimodal language model for unified 3D generation, editing, and grounding \u2014 engineered to bridge natural language and geometry-native execution."), /* @__PURE__ */ React.createElement("div", { className: "cta-group" }, /* @__PURE__ */ React.createElement("a", { className: "button cta-button is-primary", href: "https://arxiv.org/abs/2511.13647", target: "_blank", rel: "noopener noreferrer" }, /* @__PURE__ */ React.createElement("span", { className: "icon" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-file-alt" })), /* @__PURE__ */ React.createElement("span", null, "Paper")), /* @__PURE__ */ React.createElement("a", { className: "button cta-button", href: "https://github.com/AiEson/Part-X-MLLM", target: "_blank", rel: "noopener noreferrer" }, /* @__PURE__ */ React.createElement("span", { className: "icon" }, /* @__PURE__ */ React.createElement("i", { className: "fab fa-github" })), /* @__PURE__ */ React.createElement("span", null, "Code")), /* @__PURE__ */ React.createElement("a", { className: "button cta-button", href: "#playground" }, /* @__PURE__ */ React.createElement("span", { className: "icon" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-play" })), /* @__PURE__ */ React.createElement("span", null, "Live Demo (Coming Soon)"))), /* @__PURE__ */ React.createElement("div", { className: "metadata-bar" }, HERO_METADATA.map((item) => /* @__PURE__ */ React.createElement("div", { className: "metadata-item", key: item.text }, /* @__PURE__ */ React.createElement("span", { className: "icon" }, /* @__PURE__ */ React.createElement("i", { className: item.icon })), /* @__PURE__ */ React.createElement("span", null, item.text)))), /* @__PURE__ */ React.createElement("div", { className: "hero-authors-section" }, /* @__PURE__ */ React.createElement("div", { className: "hero-authors-list" }, /* @__PURE__ */ React.createElement("div", { className: "hero-authors-row" }, AUTHORS.slice(0, 5).map((author) => /* @__PURE__ */ React.createElement("div", { key: author.name, className: "hero-author-item" }, author.profile ? /* @__PURE__ */ React.createElement(
      "a",
      {
        href: author.profile,
        className: "hero-author-link",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      author.name
    ) : /* @__PURE__ */ React.createElement("span", { className: "hero-author-text" }, author.name), author.markers.map((marker) => /* @__PURE__ */ React.createElement("sup", { key: marker, className: "hero-author-marker" }, marker))))), /* @__PURE__ */ React.createElement("div", { className: "hero-authors-row" }, AUTHORS.slice(5).map((author) => /* @__PURE__ */ React.createElement("div", { key: author.name, className: "hero-author-item" }, author.profile ? /* @__PURE__ */ React.createElement(
      "a",
      {
        href: author.profile,
        className: "hero-author-link",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      author.name
    ) : /* @__PURE__ */ React.createElement("span", { className: "hero-author-text" }, author.name), author.markers.map((marker) => /* @__PURE__ */ React.createElement("sup", { key: marker, className: "hero-author-marker" }, marker)))))), /* @__PURE__ */ React.createElement("div", { className: "hero-affiliations" }, AFFILIATIONS.map((affiliation) => /* @__PURE__ */ React.createElement("div", { key: affiliation.id, className: "hero-affiliation-item" }, /* @__PURE__ */ React.createElement("span", { className: "hero-affiliation-id" }, affiliation.id), /* @__PURE__ */ React.createElement("span", { className: "hero-affiliation-name" }, affiliation.name)))), /* @__PURE__ */ React.createElement("div", { className: "hero-legends" }, AUTHOR_LEGENDS.map((legend, index) => /* @__PURE__ */ React.createElement("span", { key: legend.symbol, className: "hero-legend-item" }, /* @__PURE__ */ React.createElement("span", { className: "hero-legend-symbol" }, legend.symbol), /* @__PURE__ */ React.createElement("span", { className: "hero-legend-text" }, legend.description), index < AUTHOR_LEGENDS.length - 1 && /* @__PURE__ */ React.createElement("span", { className: "hero-legend-separator" }, "\xB7"))))))));
  }
  function AuthorsSection() {
    return /* @__PURE__ */ React.createElement("section", { id: "authors", className: "section section-dark" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("p", { className: "section-heading" }, "Acknowledgments"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Special Thanks"), /* @__PURE__ */ React.createElement("p", { className: "section-lead" }, "We extend our gratitude to the following individuals and teams for their invaluable contributions and support."), /* @__PURE__ */ React.createElement("div", { className: "acknowledgments-section", style: { marginTop: "2.5rem" } }, /* @__PURE__ */ React.createElement("div", { className: "ack-grid" }, ACKNOWLEDGMENTS.map((paper) => {
      const isCode = /github\.com/i.test(paper.profile || "");
      const domain = (() => {
        try {
          return new URL(paper.profile).hostname.replace(/^www\./, "");
        } catch (e) {
          return paper.profile;
        }
      })();
      return /* @__PURE__ */ React.createElement(
        "a",
        {
          key: paper.name,
          href: paper.profile,
          className: "ack-card",
          target: "_blank",
          rel: "noopener noreferrer"
        },
        /* @__PURE__ */ React.createElement("span", { className: "ack-card-badge" }, isCode ? "Code" : "Paper"),
        /* @__PURE__ */ React.createElement("div", { className: "ack-card-icon" }, /* @__PURE__ */ React.createElement("i", { className: isCode ? "fas fa-code-branch" : "fas fa-book" })),
        /* @__PURE__ */ React.createElement("div", { className: "ack-card-title" }, paper.name),
        /* @__PURE__ */ React.createElement("div", { className: "ack-card-domain" }, domain)
      );
    })))));
  }
  function AbstractSection() {
    const [isZoomed, setIsZoomed] = useState(false);
    return /* @__PURE__ */ React.createElement("section", { id: "abstract", className: "section section-alt" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("p", { className: "section-heading" }, "Abstract"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Part-Aware 3D MLLM"), /* @__PURE__ */ React.createElement("div", { className: "columns is-variable is-6" }, /* @__PURE__ */ React.createElement("div", { className: "column is-two-thirds" }, /* @__PURE__ */ React.createElement("div", { className: "content", style: { color: "var(--text-secondary)", fontSize: "1.05rem" } }, ABSTRACT_PARAGRAPHS.map((paragraph, index) => /* @__PURE__ */ React.createElement("p", { key: index }, paragraph)))), /* @__PURE__ */ React.createElement("div", { className: "column" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "abstract-image-preview",
        onDoubleClick: () => setIsZoomed(true)
      },
      /* @__PURE__ */ React.createElement(
        "img",
        {
          src: "./static/images/teaser.png",
          alt: "Part-X-MLLM teaser"
        }
      )
    ))), isZoomed && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "abstract-image-overlay",
        onClick: () => setIsZoomed(false)
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "abstract-image-overlay-inner",
          onClick: (event) => event.stopPropagation()
        },
        /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            className: "abstract-image-close",
            "aria-label": "Close preview",
            onClick: () => setIsZoomed(false)
          },
          /* @__PURE__ */ React.createElement("i", { className: "fas fa-times" })
        ),
        /* @__PURE__ */ React.createElement(
          "img",
          {
            src: "./static/images/teaser.png",
            alt: "Part-X-MLLM teaser enlarged"
          }
        )
      )
    )));
  }
  function PlaygroundSection() {
    return /* @__PURE__ */ React.createElement("section", { id: "playground", className: "section section-dark" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("p", { className: "section-heading" }, "Pipeline"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "From Point Clouds to X"), /* @__PURE__ */ React.createElement("p", { className: "section-lead" }, "Part-X-MLLM encodes 3D geometry and RGB appearance with dual encoders, fuses them with a language prompt, and decodes a program-like token sequence that describes parts, bounding boxes, and edit commands for downstream 3D engines."), /* @__PURE__ */ React.createElement("div", { className: "pipeline-layout" }, /* @__PURE__ */ React.createElement("div", { className: "pipeline-card" }, /* @__PURE__ */ React.createElement("span", { className: "pipeline-pill" }, "Pipeline Overview"), /* @__PURE__ */ React.createElement("h3", { className: "pipeline-card-title" }, "Structure-aware planning over 3D perception"), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "RGB point clouds are lifted into structure tokens and appearance tokens, fused with a prompt-aware text tokenizer, and decoded into a compact planning language that downstream 3D engines can execute without ambiguity."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Dual encoders first process xyz+normal features alongside RGB appearance to produce structure-aware and semantic-aware token stacks. These tokens are concatenated with prompt tokens and passed into a decoder-only LLM that emits a programmatic description of each part."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Specialized heads interpret the decoded tokens as bounding boxes, edit commands, and question-answer hooks so external 3D engines can generate, refine, or localize edits directly from language instructions without manual retargeting.")), /* @__PURE__ */ React.createElement("div", { className: "pipeline-figure" }, /* @__PURE__ */ React.createElement("div", { className: "pipeline-figure-inner" }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: "./static/images/pipeline.png",
        alt: "Part-X-MLLM pipeline"
      }
    ))))));
  }
  function FeaturesSection() {
    return /* @__PURE__ */ React.createElement("section", { className: "section section-alt" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("div", { className: "keycontrib-card" }, /* @__PURE__ */ React.createElement("p", { className: "section-heading" }, "Pipeline Details"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Task Realization with a Planning Language"), /* @__PURE__ */ React.createElement("p", { className: "section-lead" }, "This figure summarizes how a single planning language in Part-X-MLLM drives part-aware mesh generation, grounded Q&A, and auto-located 3D editing through one executable program."), /* @__PURE__ */ React.createElement("div", { className: "keycontrib-layout" }, /* @__PURE__ */ React.createElement("div", { className: "keycontrib-copy" }, /* @__PURE__ */ React.createElement("p", { className: "muted" }, "In ", /* @__PURE__ */ React.createElement("strong", null, "part-aware mesh generation"), ", the decoder outputs bounding boxes and optional part text, which a synthesis module treats as spatial guides to create high-fidelity, part-based assets."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "In ", /* @__PURE__ */ React.createElement("strong", null, "Q&A with grounding"), ", answers are augmented with BBox tokens so the language response carries explicit, persistent references to parts instead of free-form descriptions alone."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "For ", /* @__PURE__ */ React.createElement("strong", null, "auto-located 3D editing"), ", the model generates bounding boxes together with edit commands (e.g., ", "<adds>", "), and a downstream editing head applies masked edits inside the predicted cuboids."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "The same box-and-text representation also supports ", /* @__PURE__ */ React.createElement("strong", null, "semantic granularity control"), ", clustering part boxes by text embeddings to smoothly merge fine-grained parts into coarser semantic components.")), /* @__PURE__ */ React.createElement("div", { className: "keycontrib-figure" }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: "./static/images/detail_pipeline.png",
        alt: "Task realization with a planning language in Part-X-MLLM"
      }
    ))))));
  }
  function CitationSection() {
    return /* @__PURE__ */ React.createElement("section", { id: "citation", className: "section section-alt" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("p", { className: "section-heading" }, "Citation"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Reference Part-X-MLLM"), /* @__PURE__ */ React.createElement("p", { className: "section-lead" }, "Use the following BibTeX entry to cite our work."), /* @__PURE__ */ React.createElement("pre", null, /* @__PURE__ */ React.createElement("code", null, BIBTEX))));
  }
  function Footer() {
    return /* @__PURE__ */ React.createElement("footer", { className: "footer" }, /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("div", { className: "content has-text-centered" }, /* @__PURE__ */ React.createElement("a", { className: "icon-link", href: "#overview" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-arrow-up" })), /* @__PURE__ */ React.createElement("a", { className: "icon-link", href: "https://3d.hunyuan.tencent.com/" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-globe" }))), /* @__PURE__ */ React.createElement("div", { className: "columns is-centered", style: { marginTop: "1.5rem" } }, /* @__PURE__ */ React.createElement("div", { className: "column is-8" }, /* @__PURE__ */ React.createElement("div", { className: "content has-text-centered" }, /* @__PURE__ */ React.createElement("p", null, "Project page for Part-X-MLLM, adapted from the Nerfies website template. If you reuse this design, please credit both Nerfies and Part-X-MLLM."))))));
  }
  function App() {
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Navbar, null), /* @__PURE__ */ React.createElement(HeroSection, null), /* @__PURE__ */ React.createElement(AbstractSection, null), /* @__PURE__ */ React.createElement(PlaygroundSection, null), /* @__PURE__ */ React.createElement(FeaturesSection, null), /* @__PURE__ */ React.createElement(EditingSection, null), /* @__PURE__ */ React.createElement(MeshGenSection, null), /* @__PURE__ */ React.createElement(CitationSection, null), /* @__PURE__ */ React.createElement(AuthorsSection, null), /* @__PURE__ */ React.createElement(Footer, null));
  }
  const rootElement = document.getElementById("root");
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(/* @__PURE__ */ React.createElement(App, null));
  }
})();
