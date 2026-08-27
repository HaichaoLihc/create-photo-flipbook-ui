import { Float, useCursor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { easing } from "maath";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  type Group,
  type Texture,
} from "three";
import type { PhotoBookPage } from "./book-pages";
import { loadPagesTextures, paperTexture, type PageTextures } from "./book-textures";
import "./photo-flipbook.css";

export const PAGE_WIDTH = 1.28;
export const PAGE_DEPTH = 0.0035;
const PAGE_SEGMENTS = 20;
const HIGHLIGHT = new Color("#fff1d3");
/** The turn arc runs for this long after a leaf flips. */
const TURN_MS = 420;
/** Damped values below this are treated as arrived, which parks the leaf. */
const SETTLE_EPSILON = 0.0002;

export type Sheet = {
  id: string;
  front: PhotoBookPage;
  back: PhotoBookPage;
};

export function representativeRatio(pages: PhotoBookPage[]) {
  const ratios = pages
    .filter((page) => page.width && page.height)
    .map((page) => page.width! / page.height!)
    .sort((a, b) => a - b);
  if (!ratios.length) return 0.735;
  return ratios[Math.floor(ratios.length / 2)];
}

export function makeSheets(pages: PhotoBookPage[]) {
  const leaves = [...pages];
  if (leaves.length % 2) {
    leaves.push({ id: "back-cover", alt: "Blank back cover" });
  }
  const sheets: Sheet[] = [];
  for (let index = 0; index < leaves.length; index += 2) {
    sheets.push({
      id: `${leaves[index].id}-${leaves[index + 1].id}`,
      front: leaves[index],
      back: leaves[index + 1],
    });
  }
  return sheets;
}

export const sheetCountOf = (pages: PhotoBookPage[]) => Math.ceil(pages.length / 2);

export function makeGeometry(pageHeight: number) {
  const segmentWidth = PAGE_WIDTH / PAGE_SEGMENTS;
  const geometry = new BoxGeometry(
    PAGE_WIDTH,
    pageHeight,
    PAGE_DEPTH,
    PAGE_SEGMENTS,
    2,
  );
  geometry.translate(PAGE_WIDTH / 2, 0, 0);

  const position = geometry.attributes.position;
  const vertex = new Vector3();
  const skinIndexes: number[] = [];
  const skinWeights: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const skinIndex = Math.max(0, Math.floor(vertex.x / segmentWidth));
    const skinWeight = (vertex.x % segmentWidth) / segmentWidth;
    skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndexes, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  return geometry;
}

/** Build one bound skinned leaf. Exported so the renderer can precompile the
 *  page shader before a book is ever opened. */
export function makePageMesh({
  geometry,
  front,
  back,
  isCover = false,
}: {
  geometry: BoxGeometry;
  front: Texture;
  back: Texture;
  isCover?: boolean;
}) {
  const segmentWidth = PAGE_WIDTH / PAGE_SEGMENTS;
  const bones: Bone[] = [];
  for (let index = 0; index <= PAGE_SEGMENTS; index += 1) {
    const bone = new Bone();
    bone.position.x = index === 0 ? 0 : segmentWidth;
    bones.push(bone);
    if (index > 0) bones[index - 1].add(bone);
  }
  const skeleton = new Skeleton(bones);
  const edge = new MeshStandardMaterial({ color: "#e9e3d7", roughness: 0.85 });
  const roughness = isCover ? 0.72 : 0.62;
  const materials = [
    edge,
    edge,
    edge,
    edge,
    new MeshStandardMaterial({ map: front, roughness, emissive: HIGHLIGHT, emissiveIntensity: 0 }),
    new MeshStandardMaterial({ map: back, roughness, emissive: HIGHLIGHT, emissiveIntensity: 0 }),
  ];
  const mesh = new SkinnedMesh(geometry, materials);
  mesh.castShadow = isCover;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.add(skeleton.bones[0]);
  mesh.bind(skeleton);
  return mesh;
}

export function disposePageMesh(mesh: SkinnedMesh) {
  new Set(mesh.material as MeshStandardMaterial[]).forEach((material) => material.dispose());
  mesh.skeleton.dispose();
}

function textureFor(textures: PageTextures, page: PhotoBookPage) {
  return (page.image && textures.get(page.image)) || paperTexture();
}

function AnimatedSheet({
  sheet,
  textures,
  geometry,
  number,
  page,
  sheetCount,
  frozen,
  interactive,
  onSelect,
}: {
  sheet: Sheet;
  textures: PageTextures;
  geometry: BoxGeometry;
  number: number;
  page: number;
  sheetCount: number;
  frozen: boolean;
  interactive: boolean;
  onSelect: (page: number) => void;
}) {
  const group = useRef<Group>(null);
  const mesh = useRef<SkinnedMesh>(null);
  const turnedAt = useRef(-Infinity);
  const lastOpened = useRef(page > number);
  /** Cleared once every damped value has arrived, so a resting book costs
   *  nothing per frame instead of 21 bone updates per leaf. */
  const animating = useRef(true);
  const [highlighted, setHighlighted] = useState(false);
  const opened = page > number;
  const bookClosed = page === 0 || page === sheetCount;
  const isCover = number === 0 || number === sheetCount - 1;
  useCursor(highlighted && interactive);

  const skinnedPage = useMemo(
    () =>
      makePageMesh({
        geometry,
        front: textureFor(textures, sheet.front),
        back: textureFor(textures, sheet.back),
        isCover,
      }),
    [geometry, isCover, sheet.back, sheet.front, textures],
  );
  useEffect(() => () => disposePageMesh(skinnedPage), [skinnedPage]);

  useEffect(() => {
    animating.current = true;
  }, [opened, bookClosed, highlighted, page, frozen]);

  useFrame((_, delta) => {
    if (frozen || !animating.current || !mesh.current || !group.current) return;
    const materials = mesh.current.material as MeshStandardMaterial[];
    const frontMaterial = materials[4];
    const backMaterial = materials[5];
    const glow = highlighted ? 0.12 : 0;
    frontMaterial.emissiveIntensity = MathUtils.damp(frontMaterial.emissiveIntensity, glow, 9, delta);
    backMaterial.emissiveIntensity = frontMaterial.emissiveIntensity;

    if (lastOpened.current !== opened) {
      turnedAt.current = performance.now();
      lastOpened.current = opened;
    }
    const sinceTurn = performance.now() - turnedAt.current;
    const turning = Math.sin((Math.min(TURN_MS, sinceTurn) / TURN_MS) * Math.PI);
    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) targetRotation += MathUtils.degToRad(number * 0.75);

    const bones = mesh.current.skeleton.bones;
    let residual = Math.abs(frontMaterial.emissiveIntensity - glow);
    for (let index = 0; index < bones.length; index += 1) {
      const bone = bones[index];
      const target = index === 0 ? group.current : bone;
      const inside = index < 8 ? Math.sin(index * 0.2 + 0.25) : 0;
      const outside = index >= 8 ? Math.cos(index * 0.3 + 0.09) : 0;
      const turn = Math.sin((index * Math.PI) / bones.length) * turning;
      let y = 0.18 * inside * targetRotation - 0.05 * outside * targetRotation + 0.09 * turn * targetRotation;
      let x = MathUtils.degToRad(Math.sign(targetRotation) * 2);
      if (bookClosed) {
        y = index === 0 ? targetRotation : 0;
        x = 0;
      }
      const fold = index > 8 ? Math.sin((index * Math.PI) / bones.length - 0.5) * turning : 0;
      residual = Math.max(
        residual,
        Math.abs(target.rotation.y - y),
        Math.abs(target.rotation.x - x * fold),
      );
      easing.dampAngle(target.rotation, "y", y, 0.5, delta);
      easing.dampAngle(target.rotation, "x", x * fold, 0.3, delta);
    }

    // The turn arc keeps moving the targets, so only park once it has expired.
    if (residual < SETTLE_EPSILON && sinceTurn > TURN_MS + 80) animating.current = false;
  });

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    <group
      ref={group}
      onPointerEnter={(event) => { stop(event); if (interactive) setHighlighted(true); }}
      onPointerLeave={(event) => { stop(event); setHighlighted(false); }}
      onClick={(event) => {
        stop(event);
        if (!interactive) return;
        onSelect(opened ? number : number + 1);
        setHighlighted(false);
      }}
    >
      <primitive
        ref={mesh}
        object={skinnedPage}
        position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
      />
    </group>
  );
}

/**
 * Advance one leaf at a time toward `page`. Each step is its own scheduled
 * effect, so an interrupted run cancels cleanly instead of leaving orphaned
 * timers, and the state updater stays free of side effects.
 */
function useLeafByLeafPage(page: number) {
  const [renderedPage, setRenderedPage] = useState(page);
  const immediate = useRef(false);

  useEffect(() => {
    immediate.current = true;
  }, [page]);

  useEffect(() => {
    if (renderedPage === page) return;
    const direction = Math.sign(page - renderedPage);
    const gap = Math.abs(page - renderedPage);
    const delay = immediate.current ? 0 : gap > 2 ? 55 : 155;
    immediate.current = false;
    const timer = window.setTimeout(
      () => setRenderedPage((current) => current + direction),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [page, renderedPage]);

  return renderedPage;
}

/** Milliseconds a leaf-by-leaf run from `from` to `to` takes to finish. */
export function pageTravelDuration(from: number, to: number) {
  const gap = Math.abs(to - from);
  if (!gap) return 0;
  return (gap - 1) * (gap > 2 ? 55 : 155) + TURN_MS;
}

export function Book({
  sheets,
  textures,
  page,
  pageRatio,
  frozen = false,
  interactive = true,
  onSelect,
}: {
  sheets: Sheet[];
  textures: PageTextures;
  page: number;
  pageRatio: number;
  frozen?: boolean;
  interactive?: boolean;
  onSelect: (page: number) => void;
}) {
  const renderedPage = useLeafByLeafPage(page);
  const spine = useRef<Group>(null);
  const geometry = useMemo(() => makeGeometry(PAGE_WIDTH / pageRatio), [pageRatio]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Seed the spine imperatively: a declarative prop would be re-applied on
  // every page change and snap straight over the damped value below.
  useLayoutEffect(() => {
    if (spine.current) spine.current.position.x = -PAGE_WIDTH / 2;
  }, []);

  // Leaves hinge at x = 0 and extend one page width to one side, so a *closed*
  // book sits half a page off centre. Slide the spine to keep the visible
  // block centred whether the book is shut, open, or mid-turn.
  useFrame((_, delta) => {
    if (!spine.current) return;
    const shift =
      renderedPage === 0
        ? -PAGE_WIDTH / 2
        : renderedPage === sheets.length
          ? PAGE_WIDTH / 2
          : 0;
    easing.damp(spine.current.position, "x", shift, 0.3, delta);
  });

  return (
    <group ref={spine}>
      <group rotation-y={-Math.PI / 2}>
        {sheets.map((sheet, index) => (
          <AnimatedSheet
            key={sheet.id}
            sheet={sheet}
            textures={textures}
            geometry={geometry}
            number={index}
            page={renderedPage}
            sheetCount={sheets.length}
            frozen={frozen}
            interactive={interactive}
            onSelect={onSelect}
          />
        ))}
      </group>
    </group>
  );
}

export function PhotoBook3D({
  pages,
  textures,
  page,
  pageRatio,
  frozen,
  interactive,
  onSelect,
}: {
  pages: PhotoBookPage[];
  textures: PageTextures;
  page: number;
  pageRatio: number;
  frozen?: boolean;
  interactive?: boolean;
  onSelect: (page: number) => void;
}) {
  const sheets = useMemo(() => makeSheets(pages), [pages]);
  return (
    <Book
      sheets={sheets}
      textures={textures}
      page={page}
      pageRatio={pageRatio}
      frozen={frozen}
      interactive={interactive}
      onSelect={onSelect}
    />
  );
}

/** Resolve every leaf of a standalone book before anything is mounted. */
function usePageTextures(pages: PhotoBookPage[], pageRatio: number) {
  const [textures, setTextures] = useState<PageTextures | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTextures(null);
    loadPagesTextures(pages, pageRatio).then((loaded) => {
      if (!cancelled) setTextures(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [pageRatio, pages]);
  return textures;
}

function Scene({ sheets, textures, page, pageRatio, onSelect }: {
  sheets: Sheet[];
  textures: PageTextures;
  page: number;
  pageRatio: number;
  onSelect: (page: number) => void;
}) {
  const pageHeight = PAGE_WIDTH / pageRatio;
  return (
    <>
      <Float
        rotation-x={-Math.PI / 5.2}
        rotation-z={-0.025}
        floatIntensity={0.18}
        rotationIntensity={0.14}
        speed={1.35}
        scale={pageRatio > 1 ? 1.45 : 1}
      >
        <Book
          sheets={sheets}
          textures={textures}
          page={page}
          pageRatio={pageRatio}
          onSelect={onSelect}
        />
      </Float>
      <hemisphereLight args={["#fffdf8", "#77746d", 1.6]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[2, 5, 3]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <mesh position-y={-pageHeight * (pageRatio > 1 ? 0.85 : 0.63)} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.22} />
      </mesh>
    </>
  );
}

export function PhotoFlipbook({
  pages,
  title = "Photo Book",
  onClose,
}: {
  pages: PhotoBookPage[];
  title?: string;
  kicker?: string;
  meta?: string;
  onClose?: () => void;
}) {
  const sheets = useMemo(() => makeSheets(pages), [pages]);
  const pageRatio = useMemo(() => representativeRatio(pages), [pages]);
  const textures = usePageTextures(pages, pageRatio);
  const [page, setPage] = useState(0);
  const previous = useCallback(() => setPage((current) => Math.max(0, current - 1)), []);
  const next = useCallback(() => setPage((current) => Math.min(sheets.length, current + 1)), [sheets.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); next(); }
      if (event.key === "Home") setPage(0);
      if (event.key === "End") setPage(sheets.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, sheets.length]);

  const label = page === 0
    ? "Cover"
    : page === sheets.length
      ? "Back cover"
      : `Spread ${String(page).padStart(2, "0")} / ${String(sheets.length - 1).padStart(2, "0")}`;
  const style = { "--book-accent-ratio": pageRatio } as CSSProperties;

  return (
    <main className="r3f-book-room" style={style}>
      <header className="r3f-book-header">
        <span>Interactive folio</span>
        <h1>{title}</h1>
        {onClose ? <button type="button" onClick={onClose}>Close <kbd>Esc</kbd></button> : <span />}
      </header>
      <div className="r3f-book-canvas" aria-label={`${title} interactive 3D photo book`}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 0.45, 4.15], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
        >
          {textures ? (
            <Scene sheets={sheets} textures={textures} page={page} pageRatio={pageRatio} onSelect={setPage} />
          ) : null}
        </Canvas>
      </div>
      <footer className="r3f-book-controls" aria-label="Book controls">
        <button type="button" onClick={previous} disabled={page === 0 || !textures} aria-label="Previous spread">‹</button>
        <div aria-live="polite">
          <span>{textures ? label : "Loading"}</span>
          <small>Click a page or use arrow keys</small>
        </div>
        <button type="button" onClick={next} disabled={page === sheets.length || !textures} aria-label="Next spread">›</button>
      </footer>
    </main>
  );
}
