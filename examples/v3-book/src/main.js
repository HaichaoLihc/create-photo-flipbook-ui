import * as THREE from "three";
import { FlipBook } from "quick_flipbook";
import { books } from "./books.js";
import "./style.css";

const canvas = document.querySelector("#book-scene");
const library = document.querySelector("#library");
const previousButton = document.querySelector("#previous-page");
const nextButton = document.querySelector("#next-page");
const pageState = document.querySelector("#page-state");
const loadingCard = document.querySelector("#loading-card");
const loadingCopy = document.querySelector("#loading-copy");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#ffffff");

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
camera.position.set(0, 5, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight("#ffffff", "#e7e7e4", 1.65));

const keyLight = new THREE.DirectionalLight("#ffffff", 2.25);
keyLight.position.set(-2.8, 5.2, 2.7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 14;
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
scene.add(keyLight);

const rimLight = new THREE.PointLight("#ffffff", 2.4, 8, 2);
rimLight.position.set(2.5, 1.8, -2.4);
scene.add(rimLight);

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 18),
  new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, metalness: 0 }),
);
table.rotation.x = -Math.PI / 2;
table.position.y = -0.035;
table.receiveShadow = true;
scene.add(table);

const bookRig = new THREE.Group();
bookRig.rotation.set(0, 0, 0);
scene.add(bookRig);

const flipBook = new FlipBook({
  flipDuration: 0.62,
  yBetweenPages: 0.0012,
  pageSubdivisions: 30,
});
flipBook.traverse((object) => {
  if (object.isMesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
});
bookRig.add(flipBook);

let selectedBook = books[0];
let loading = false;
let loadToken = 0;
let pointerStart = null;
let lastStatusKey = "";
const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();
const materialCache = new Map();
const blankMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });

function pageMaterial(source) {
  if (!source) return Promise.resolve(blankMaterial);
  if (materialCache.has(source)) return materialCache.get(source);

  const request = textureLoader.loadAsync(source).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }).catch(() => blankMaterial);
  materialCache.set(source, request);
  return request;
}

function setLoading(value, copy = "Preparing edition") {
  loading = value;
  loadingCard.classList.toggle("is-visible", value);
  loadingCopy.textContent = copy;
  previousButton.disabled = value;
  nextButton.disabled = value;
}

function renderLibrary() {
  library.innerHTML = books
    .map(
      (book) => `
        <button class="library-book ${book.id === selectedBook.id ? "is-active" : ""}"
          type="button" data-book="${book.id}" aria-label="Open ${book.title}" title="${book.title}">
          <span aria-hidden="true">${book.mark}</span>
        </button>`,
    )
    .join("");
}

async function selectBook(book, immediate = false) {
  if (!book || (book.id === selectedBook.id && !immediate)) return;

  selectedBook = book;
  const token = ++loadToken;
  renderLibrary();
  setLoading(true, `Preparing ${book.title}`);
  resize();

  const pageMaterials = await Promise.all(book.pages.map(pageMaterial));
  if (token !== loadToken) return;

  flipBook.scale.x = book.ratio;
  flipBook.setPages(pageMaterials);
  flipBook.progress = 0;
  // Quick FlipBook assigns supplied materials through an internal promise
  // chain. Drain those microtasks before making the new edition interactive.
  for (let index = 0; index < pageMaterials.length; index += 1) await Promise.resolve();
  if (token !== loadToken) return;
  flipBook.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  setLoading(false);
  updateStatus();
}

function nextPage() {
  if (!loading && flipBook.currentPage < flipBook.totalPages) flipBook.nextPage();
}

function previousPage() {
  if (!loading && flipBook.currentPage > 0) flipBook.previousPage();
}

function updateStatus() {
  const current = Math.round(flipBook.currentPage || 0);
  const total = flipBook.totalPages || selectedBook.pages.length;
  const shown = Math.min(current, total);
  const statusKey = `${loading}:${shown}:${total}`;
  if (statusKey === lastStatusKey) return;
  lastStatusKey = statusKey;
  if (shown === 0) pageState.textContent = "Cover";
  else if (shown >= total) pageState.textContent = "Back cover";
  else pageState.textContent = `Spread ${Math.ceil(shown / 2)} of ${Math.ceil(total / 2)}`;
  previousButton.disabled = loading || shown <= 0;
  nextButton.disabled = loading || shown >= total;
}

library.addEventListener("click", (event) => {
  const button = event.target.closest("[data-book]");
  if (button) selectBook(books.find((book) => book.id === button.dataset.book));
});

previousButton.addEventListener("click", previousPage);
nextButton.addEventListener("click", nextPage);

canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
  canvas.setPointerCapture?.(event.pointerId);
});

canvas.addEventListener("pointerup", (event) => {
  const start = pointerStart;
  pointerStart = null;
  if (!start || loading) return;
  const deltaX = event.clientX - start.x;
  const deltaY = event.clientY - start.y;
  const elapsed = performance.now() - start.time;

  if (Math.abs(deltaX) > 36 && Math.abs(deltaX) > Math.abs(deltaY)) {
    deltaX < 0 ? nextPage() : previousPage();
  } else if (elapsed < 500 && Math.abs(deltaY) < 20) {
    event.clientX < window.innerWidth / 2 ? previousPage() : nextPage();
  }
});

canvas.addEventListener("pointercancel", () => {
  pointerStart = null;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    nextPage();
  }
  if (event.key === "ArrowLeft") previousPage();
  if (event.key === "Home") flipBook.currentPage = 0;
  if (event.key === "End") flipBook.currentPage = flipBook.totalPages;
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / Math.max(1, height);
  const spreadWidth = selectedBook.ratio * 2;
  const padding = width < 620 ? 1.16 : 1.1;
  const halfHeight = Math.max(0.62, (spreadWidth * padding) / (2 * aspect));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();
renderLibrary();
selectBook(books[0], true);

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  flipBook.animate(delta);
  updateStatus();
  renderer.render(scene, camera);
}

animate();
