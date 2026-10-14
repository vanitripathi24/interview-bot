import Human from "@vladmandic/human";

// Replaces face-api.js (detection+landmarks+recognition in one unified,
// actively maintained pipeline). Only the 3 models we actually use
// (detector/mesh/recognition) are enabled and bundled locally — iris,
// emotion, antispoof, body, hand etc. are off so their weights are never
// fetched.
const HUMAN_CONFIG = {
  backend: "webgl",
  modelBasePath: "/models/human/",
  cacheSensitivity: 0, // we poll on our own schedule — never reuse a stale/interpolated result
  debug: false,
  face: {
    enabled: true,
    detector: { enabled: true, rotation: false, maxDetected: 1, skipFrames: 0, skipTime: 0 },
    mesh: { enabled: true, skipFrames: 0, skipTime: 0 },
    attention: { enabled: false },
    iris: { enabled: false },
    description: { enabled: false, skipFrames: 0, skipTime: 0 },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
    gear: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
};

let human = null;
let loadPromise = null;

export function getHuman() {
  if (!human) human = new Human(HUMAN_CONFIG);
  return human;
}

export function loadFaceModels() {
  if (!loadPromise) {
    const h = getHuman();
    loadPromise = h.load().then(() => h.warmup());
  }
  return loadPromise;
}
