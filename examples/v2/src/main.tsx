import { useCursor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Euler,
  Group,
  MathUtils,
  MeshStandardMaterial,
  Vector3,
  type PerspectiveCamera,
  type Texture,
} from "three";
import {
  PAGE_DEPTH,
  PAGE_WIDTH,
  PhotoBook3D,
  disposePageMesh,
  makeGeometry,
  makePageMesh,
  pageTravelDuration,
  sheetCountOf,
} from "./PhotoFlipbook";
import { books, type LibraryBook } from "./book-pages";
import {
  declaredRatio,
  loadPageTexture,
  paperTexture,
  prefetchBook,
  warmBookTextures,
  type PageTextures,
} from "./book-textures";
import "./library.css";

type Phase = "library" | "opening" | "detail" | "closing" | "returning";
type Point3 = [number, number, number];

const FOCUS_POSITION: Point3 = [0, 0.08, 0.3];
const FOCUS_TILT = Math.PI / 5.2;
const FOCUS_ROTATION: Point3 = [-FOCUS_TILT, 0, 0];
const DETAIL_SCALE = 1.08;
/** Headroom around the framed book so the header and controls do not crowd it. */
const FRAME_MARGIN = 1.32;
const LIBRARY_CAMERA: Point3 = [0, 0.42, 6.8];
/** How long the cover takes to fly back to its slot before the library resumes. */
const RETURN_MS = 820;

const LIBRARY_SLOTS: Point3[] = [
  [-2.55, 0.45, 0.05],
  [-0.9, -0.24, 0.32],
  [0.88, 0.32, 0.08],
  [2.55, -0.12, 0.24],
];

const LIBRARY_ROTATIONS: Point3[] = [
  [-0.18, 0.2, -0.08],
  [-0.28, -0.14, 0.07],
  [-0.16, 0.12, 0.04],
  [-0.25, -0.2, -0.06],
];

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
/** Collapse every spring to a snap when the reader asked for less motion. */
const smooth = (seconds: number) => (REDUCED_MOTION ? 0.001 : seconds);

function FloatingCover({
  book,
  index,
  phase,
  page,
  selected,
  textures,
  onOpen,
  onPage,
  onWarm,
}: {
  book: LibraryBook;
  index: number;
  phase: Phase;
  page: number;
  selected: boolean;
  textures: PageTextures | null;
  onOpen: (book: LibraryBook) => void;
  onPage: (page: number) => void;
  onWarm: (book: LibraryBook) => void;
}) {
  const group = useRef<Group>(null);
  const coverMaterial = useRef<MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const [coverTexture, setCoverTexture] = useState<Texture | null>(null);

  const focused = selected && phase !== "library" && phase !== "returning";
  const visible = selected || phase === "library";
  const interactive = phase === "library";
  // Pages replace the placeholder volume only once their textures are on the
  // GPU, and stay mounted until the cover is home again — the two forms are
  // built to occupy the same space, so the swap is invisible either way.
  const showPages = selected && textures !== null && phase !== "library" && phase !== "opening";
  useCursor(hovered && interactive);

  const basePosition = LIBRARY_SLOTS[index] ?? [0, 0, 0];
  const baseRotation = LIBRARY_ROTATIONS[index] ?? [0, 0, 0];
  const pageHeight = PAGE_WIDTH / book.ratio;
  const sheetCount = sheetCountOf(book.pages);
  // Match the closed page stack exactly, so the placeholder and the real book
  // share a silhouette rather than popping between two thicknesses.
  const stackDepth = Math.max(0.03, sheetCount * PAGE_DEPTH);
  const stackOffset = PAGE_DEPTH / 2 - stackDepth / 2;

  // The very same fitted texture the first leaf uses, so front faces match.
  useEffect(() => {
    let cancelled = false;
    const coverPage = book.pages.find((leaf) => leaf.image === book.cover);
    loadPageTexture(book.cover, book.ratio, coverPage && declaredRatio(coverPage))
      .then((texture) => {
        if (!cancelled) setCoverTexture(texture);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [book]);

  useEffect(() => {
    if (coverMaterial.current) coverMaterial.current.needsUpdate = true;
  }, [coverTexture]);

  // Damped anchor plus an additive idle drift. Keeping the drift additive (and
  // fading its weight to zero on selection) means the book never inherits a
  // frozen offset the way a separate floating wrapper does.
  const anchor = useMemo(
    () => ({
      position: new Vector3(...basePosition),
      rotation: new Euler(...baseRotation),
      scale: 1,
      drift: REDUCED_MOTION ? 0 : 1,
    }),
    // Slots are fixed per index; recomputing would fight the running spring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const seed = useMemo(() => index * 2.7 + 0.4, [index]);
  const driftSpeed = 0.55 + index * 0.06;

  useLayoutEffect(() => {
    if (!group.current) return;
    group.current.position.copy(anchor.position);
    group.current.rotation.copy(anchor.rotation);
  }, [anchor]);

  useFrame((state, delta) => {
    if (!visible || !group.current) return;
    const targetPosition: Point3 = focused
      ? FOCUS_POSITION
      : basePosition;
    const targetRotation: Point3 = focused
      ? FOCUS_ROTATION
      : baseRotation;
    const targetScale = focused
      ? DETAIL_SCALE
      : hovered && interactive
        ? 1.065
        : 1;

    easing.damp3(anchor.position, targetPosition, smooth(0.28), delta);
    easing.dampE(anchor.rotation, targetRotation, smooth(0.28), delta);
    easing.damp(anchor, "scale", targetScale, smooth(0.3), delta);
    easing.damp(anchor, "drift", selected || REDUCED_MOTION ? 0 : 1, smooth(0.4), delta);

    const time = state.clock.elapsedTime * driftSpeed + seed;
    const drift = anchor.drift;
    group.current.position.set(
      anchor.position.x,
      anchor.position.y + Math.sin(time) * 0.05 * drift,
      anchor.position.z,
    );
    group.current.rotation.set(
      anchor.rotation.x + Math.cos(time * 0.83) * 0.045 * drift,
      anchor.rotation.y + Math.sin(time * 0.61) * 0.055 * drift,
      anchor.rotation.z + Math.sin(time * 0.47) * 0.03 * drift,
    );
    group.current.scale.setScalar(anchor.scale);

    if (coverMaterial.current) {
      coverMaterial.current.emissiveIntensity = MathUtils.damp(
        coverMaterial.current.emissiveIntensity,
        hovered && interactive ? 0.12 : 0,
        9,
        delta,
      );
    }
  });

  return (
    <group
      ref={group}
      visible={visible}
      onPointerEnter={(event) => {
        event.stopPropagation();
        if (interactive) {
          setHovered(true);
          onWarm(book);
        }
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        setHovered(false);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (interactive) onOpen(book);
      }}
    >
      <mesh castShadow receiveShadow visible={!showPages} position-z={stackOffset}>
        <boxGeometry args={[PAGE_WIDTH, pageHeight, stackDepth]} />
        <meshStandardMaterial attach="material-0" color="#e9e3d7" roughness={0.85} />
        <meshStandardMaterial attach="material-1" color="#e9e3d7" roughness={0.85} />
        <meshStandardMaterial attach="material-2" color="#e9e3d7" roughness={0.85} />
        <meshStandardMaterial attach="material-3" color="#e9e3d7" roughness={0.85} />
        <meshStandardMaterial
          ref={coverMaterial}
          attach="material-4"
          map={coverTexture ?? paperTexture()}
          color={coverTexture ? "#ffffff" : book.color}
          roughness={0.72}
          emissive="#fff0d1"
          emissiveIntensity={0}
        />
        <meshStandardMaterial attach="material-5" color={book.color} roughness={0.76} />
      </mesh>
      {showPages && textures ? (
        <PhotoBook3D
          pages={book.pages}
          textures={textures}
          page={page}
          pageRatio={book.ratio}
          frozen={phase === "returning"}
          interactive={phase === "detail"}
          onSelect={onPage}
        />
      ) : null}
    </group>
  );
}

/**
 * Decode and upload the selected book off the click path. Nothing here can
 * suspend, so the library keeps rendering while a book loads.
 */
function BookLoader({
  book,
  onLoaded,
}: {
  book: LibraryBook | null;
  onLoaded: (textures: PageTextures) => void;
}) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    warmBookTextures(book, gl, () => cancelled).then((textures) => {
      if (!cancelled) onLoaded(textures);
    });
    return () => {
      cancelled = true;
    };
  }, [book, gl, onLoaded]);
  return null;
}

/**
 * Compile the skinned-page program against a throwaway leaf while the library
 * is idle. Without this the first book open pays a shader-compile stall right
 * in the middle of the flight animation.
 */
function PagePrecompile() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const geometry = makeGeometry(PAGE_WIDTH / 0.75);
      const mesh = makePageMesh({
        geometry,
        front: paperTexture(),
        back: paperTexture(),
        isCover: true,
      });
      const holder = new Group();
      holder.add(mesh);
      const release = () => {
        disposePageMesh(mesh);
        geometry.dispose();
      };
      try {
        Promise.resolve(gl.compileAsync(holder, camera, scene)).then(release, release);
      } catch {
        release();
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [camera, gl, scene]);
  return null;
}

/**
 * Frames the library from a distance and dollies in to fit the selected book,
 * widening as it opens from a single cover to a full spread.
 */
function CameraRig({
  book,
  focused,
  spread,
}: {
  book: LibraryBook | null;
  focused: boolean;
  spread: number;
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const look = useMemo(() => new Vector3(0, 0, 0), []);
  const target = useMemo(() => new Vector3(...LIBRARY_CAMERA), []);
  const lookTarget = useMemo(() => new Vector3(0, 0, 0), []);
  const width = useRef(1);

  useFrame((_, delta) => {
    if (book && focused) {
      easing.damp(width, "current", spread, smooth(0.4), delta);
      const halfFov = Math.tan(MathUtils.degToRad(camera.fov) / 2);
      const aspect = Math.max(0.4, size.width / Math.max(1, size.height));
      const spreadWidth = PAGE_WIDTH * width.current * DETAIL_SCALE;
      // The book is tilted away from the camera, so its silhouette is shorter
      // than the sheet itself.
      const spreadHeight = (PAGE_WIDTH / book.ratio) * DETAIL_SCALE * Math.cos(FOCUS_TILT);
      const distance =
        Math.max(spreadHeight / 2 / halfFov, spreadWidth / 2 / (halfFov * aspect)) *
        FRAME_MARGIN;
      target.set(FOCUS_POSITION[0], FOCUS_POSITION[1] + 0.06, FOCUS_POSITION[2] + distance);
      lookTarget.set(...FOCUS_POSITION);
    } else {
      width.current = 1;
      target.set(...LIBRARY_CAMERA);
      lookTarget.set(0, 0, 0);
    }
    easing.damp3(camera.position, target, smooth(0.42), delta);
    easing.damp3(look, lookTarget, smooth(0.42), delta);
    camera.lookAt(look);
  });
  return null;
}

function BookWorld({
  activeBook,
  phase,
  page,
  textures,
  onOpen,
  onPage,
  onWarm,
}: {
  activeBook: LibraryBook | null;
  phase: Phase;
  page: number;
  textures: PageTextures | null;
  onOpen: (book: LibraryBook) => void;
  onPage: (page: number) => void;
  onWarm: (book: LibraryBook) => void;
}) {
  const sheetCount = activeBook ? sheetCountOf(activeBook.pages) : 0;
  return (
    <>
      {books.map((book, index) => (
        <FloatingCover
          key={book.id}
          book={book}
          index={index}
          phase={phase}
          page={page}
          selected={activeBook?.id === book.id}
          textures={activeBook?.id === book.id ? textures : null}
          onOpen={onOpen}
          onPage={onPage}
          onWarm={onWarm}
        />
      ))}
      <CameraRig
        book={activeBook}
        focused={phase !== "library" && phase !== "returning"}
        spread={page > 0 && page < sheetCount ? 2 : 1}
      />
      <hemisphereLight args={["#fff8ec", "#151817", 1.75]} />
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[2.5, 6, 4]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0001}
      />
      <mesh position-y={-1.55} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[30, 20]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
    </>
  );
}

function LibraryExperience() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("library");
  const [page, setPage] = useState(0);
  const [textures, setTextures] = useState<PageTextures | null>(null);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeId) ?? null,
    [activeId],
  );
  const sheetCount = activeBook ? sheetCountOf(activeBook.pages) : 0;
  const readable = phase === "detail" && textures !== null;

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  const schedule = useCallback((callback: () => void, delay: number) => {
    timers.current.push(window.setTimeout(callback, delay));
  }, []);

  const warm = useCallback((book: LibraryBook) => prefetchBook(book), []);

  const open = useCallback(
    (book: LibraryBook) => {
      if (phaseRef.current !== "library") return;
      clearTimers();
      setPage(0);
      setTextures(null);
      setActiveId(book.id);
      setPhase("opening");
    },
    [clearTimers],
  );

  // Only an in-flight open may promote to the reader; if the reader backed out
  // first, the textures stay cached for next time and nothing pops in.
  const handleLoaded = useCallback((loaded: PageTextures) => {
    if (phaseRef.current !== "opening") return;
    setTextures(loaded);
    setPhase("detail");
  }, []);

  const startReturn = useCallback(() => {
    setPhase("returning");
    schedule(() => {
      setActiveId(null);
      setTextures(null);
      setPage(0);
      setPhase("library");
    }, REDUCED_MOTION ? 0 : RETURN_MS);
  }, [schedule]);

  const close = useCallback(() => {
    if (phase === "library" || phase === "returning") return;
    clearTimers();
    if (phase === "detail" && page > 0) {
      // Let the book shut leaf by leaf before it flies home.
      setPhase("closing");
      setPage(0);
      schedule(startReturn, REDUCED_MOTION ? 0 : pageTravelDuration(page, 0) + 120);
    } else {
      startReturn();
    }
  }, [clearTimers, page, phase, schedule, startReturn]);

  const turnTo = useCallback(
    (next: number) => {
      if (phaseRef.current !== "detail") return;
      setPage(MathUtils.clamp(next, 0, sheetCount));
    },
    [sheetCount],
  );
  const previous = useCallback(() => turnTo(page - 1), [page, turnTo]);
  const next = useCallback(() => turnTo(page + 1), [page, turnTo]);

  useEffect(() => () => clearTimers(), [clearTimers]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); next(); }
      if (event.key === "Home") turnTo(0);
      if (event.key === "End") turnTo(sheetCount);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, next, previous, sheetCount, turnTo]);

  const status =
    phase === "opening"
      ? `Opening ${activeBook?.title ?? "volume"}`
      : phase === "closing" || phase === "returning"
        ? "Returning to library"
        : page === 0
          ? "Cover"
          : page === sheetCount
            ? "Back cover"
            : `Spread ${String(page).padStart(2, "0")} / ${String(sheetCount - 1).padStart(2, "0")}`;

  return (
    <main className={`library-scene phase-${phase}`}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: LIBRARY_CAMERA, fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        aria-label="Floating photo book library"
      >
        <BookWorld
          activeBook={activeBook}
          phase={phase}
          page={page}
          textures={textures}
          onOpen={open}
          onPage={turnTo}
          onWarm={warm}
        />
        <BookLoader book={phase === "opening" ? activeBook : null} onLoaded={handleLoaded} />
        <PagePrecompile />
      </Canvas>

      <header className="library-header">
        <span>{activeBook ? "Selected edition · v2" : "Photo book library · v2"}</span>
        <h1>{activeBook?.title ?? "Floating Editions"}</h1>
        {phase !== "library" ? (
          <button type="button" onClick={close}>Close <kbd>Esc</kbd></button>
        ) : (
          <span />
        )}
      </header>

      {phase === "library" ? (
        <nav className="library-index" aria-label="Choose a photo book">
          {books.map((book) => (
            <button
              key={book.id}
              type="button"
              onMouseEnter={() => warm(book)}
              onFocus={() => warm(book)}
              onClick={() => open(book)}
            >
              <span>{book.spineMark}</span>
              {book.title}
            </button>
          ))}
        </nav>
      ) : (
        <footer className="detail-controls" aria-label="Book controls">
          <button type="button" onClick={previous} disabled={!readable || page === 0} aria-label="Previous spread">‹</button>
          <div aria-live="polite">
            <span>{status}</span>
            <small>{readable ? "Click a page or use arrow keys" : "Please wait"}</small>
          </div>
          <button type="button" onClick={next} disabled={!readable || page === sheetCount} aria-label="Next spread">›</button>
        </footer>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<LibraryExperience />);
