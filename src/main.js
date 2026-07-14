import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

const CABINET_GLB_SIZE_BYTES = 18598924

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x0d0821, 8, 25)
scene.background = new THREE.Color(0x0d0821)

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

let joystickParts = []
let joystickPivot = null
let screenMesh = null
const buttonMeshes = {}
const JOYSTICK_PIVOT_OFFSET_Y = 0 // the rebuilt mesh's own origin already lines up with the pivot point — no offset needed
let joystickMesh = null
let joystickRestRotation = null
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let isDraggingJoystick = false
let dragStartX = 0
let dragStartY = 0
let hasTriggeredMove = false
let hasEntered = false

const renderer = new THREE.WebGLRenderer({antialias: true})
renderer.setSize(window.innerWidth,window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled=true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.2
// without this, a touch-drag on the canvas also scrolls/pinch-zooms the page
// underneath it — the browser treats canvas drags as page gestures by default
renderer.domElement.style.touchAction = 'none'
document.body.appendChild(renderer.domElement)

// selective bloom: render the scene twice — once with the screen blacked out (feeds
// the bloom blur), once normally — then additively combine, so the cabinet's neon
// still glows but the screen's text/UI stays crisp and un-bloomed
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.7,   // strength — how much brightness gets added to glowing areas
  0.2,   // radius — how far the glow spreads from bright pixels
  0.75   // threshold — only pixels brighter than this (0-1) bloom at all
)

const bloomComposer = new EffectComposer(renderer)
bloomComposer.renderToScreen = false
bloomComposer.addPass(new RenderPass(scene, camera))
bloomComposer.addPass(bloomPass)

const bloomMixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
      }
    `,
  }),
  'baseTexture'
)
bloomMixPass.needsSwap = true

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(bloomMixPass)

const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
const materialBeforeDark = {}

function darkenScreenForBloom(obj) {
  if (obj === screenMesh) {
    materialBeforeDark[obj.uuid] = obj.material
    obj.material = darkMaterial
  }
}

function restoreScreenMaterial(obj) {
  if (materialBeforeDark[obj.uuid]) {
    obj.material = materialBeforeDark[obj.uuid]
    delete materialBeforeDark[obj.uuid]
  }
}



const ambientLight = new THREE.AmbientLight(0xffffff, 0.15)
scene.add(ambientLight)

const keyLight = new THREE.PointLight(0xa855f7,80,20)
keyLight.position.set(3,5,4)
scene.add(keyLight)

const rimLight = new THREE.PointLight(0xec4899,60,15)
rimLight.position.set(-4,3,-3)
scene.add(rimLight)

const fillLight = new THREE.PointLight(0x3b82f6,40,12)
fillLight.position.set(0,2,4)
scene.add(fillLight)

const floorLight = new THREE.PointLight(0xf59e0b,2,8)
floorLight.position.set(0,-0.8,0)
scene.add(floorLight)


const floorGeometry = new THREE.PlaneGeometry(20,20)
const floorMaterial= new THREE.MeshStandardMaterial({
  color:0x0d0821,
  roughness:0.5,
  metalness:0.4,
})

const floor = new THREE.Mesh(floorGeometry, floorMaterial)
floor.rotation.x = -Math.PI / 2
floor.position.y = -1
scene.add(floor)

const wallGeometry = new THREE.PlaneGeometry(20, 10)
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x0d0821,
  roughness: 0.9,
  metalness: 0.1,
})

const backWall = new THREE.Mesh(wallGeometry, wallMaterial)
backWall.position.set(0, 4, -9)
scene.add(backWall)

const sideWall = new THREE.Mesh(wallGeometry, wallMaterial)
sideWall.rotation.y = Math.PI / 2
sideWall.position.set(-9, 4, 0)
scene.add(sideWall)

const leftWall = new THREE.Mesh(wallGeometry, wallMaterial)
leftWall.rotation.y = Math.PI
leftWall.position.set(0, 4, 9)
scene.add(leftWall)

renderer.setClearColor(0x0d0821)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor= 0.05
controls.minDistance = 1
controls.maxDistance = 10
controls.target.set (0,0,0)

const cameraIntroStart = new THREE.Vector3(15, 4, 20)
const cameraIntroLookAt = new THREE.Vector3(0, 1.4, 0)
const cameraIntroEndOffset = new THREE.Vector3(1.9, 0.7, 0) // desktop-tuned offset from cameraIntroLookAt

// on a narrow (portrait) viewport, the same vertical FOV gives a much tighter horizontal
// FOV, so the desktop-tuned resting distance crops the cabinet's sides out of frame —
// pull the camera back along the same direction to compensate. Landscape/desktop aspects
// (>=1) get a pullback of exactly 1, i.e. unchanged from the original tuned position.
function computeCameraIntroEnd() {
  const aspect = window.innerWidth / window.innerHeight
  const pullback = aspect < 1 ? Math.min(1 / aspect, 1.32) : 1
  return cameraIntroLookAt.clone().addScaledVector(cameraIntroEndOffset, pullback)
}

let cameraIntroEnd = computeCameraIntroEnd()
const cameraIntroDuration = 2500
let cameraIntroStartTime = null
let cameraIntroDone = false

camera.position.copy(cameraIntroStart)
camera.lookAt(0,1.4,0)
controls.target.set (0,1.4,0)
controls.enabled = false

const startTime = performance.now()



// the "screen" mesh is a 1.275 x 1.672 world-unit rectangle, not a square —
// matching that aspect here keeps drawn content from being stretched onto it
const SCREEN_W = 1024
const SCREEN_H = 1344

const screenCanvas = document.createElement('canvas')
screenCanvas.width = SCREEN_W
screenCanvas.height = SCREEN_H
const ctx = screenCanvas.getContext('2d')

function drawScreenBorder(color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 8
  ctx.strokeRect(24, 24, 976, SCREEN_H - 48)
}

const projects = [
  {
    name: 'Hotel Reservation System',
    tech: 'Java / SpringBoot',
    description: 'Engineered a full-stack hotel booking platform demonstrating RESTful API design, CRUD operations, layered architecture, and enterprise Java development practices.',
    url: 'https://github.com/FilipMihajlov1/SpringBoot-App',
  },
  {
    name: 'Image Classifier App',
    tech: 'Python / Tensorflow',
    description: 'Deployed an interactive Streamlit web interface enabling real-time image upload and instant predictions — making the model accessible to non-technical users.',
    url: 'https://github.com/FilipMihajlov1/Image-Classifier',
  },
  {
    name: 'Arcade Portfolio',
    tech: 'Three.js / Blender',
    description: 'Built an interactive 3D arcade cabinet as a developer portfolio, featuring a hand-modeled Blender cabinet, custom raycasting-based joystick controls, and a live Canvas2D UI rendered as a WebGL texture.',
    url: 'https://github.com/FilipMihajlov1/arcade-portfolio',
  },
]

const skills = [
  { name: 'Java', level: 7, max: 10, color: '#a855f7' },
  { name: 'PYTHON', level: 6, max: 10, color: '#ec4899' },
  { name: 'C/C++', level: 5, max: 10, color: '#3b82f6' },
  { name: 'SQL', level: 7, max: 10, color: '#10b981' },
  { name: 'HTML5/CSS', level: 5, max: 10, color: '#f59e0b' },
  { name: 'GIT', level: 6, max: 10, color: '#f43f5e' },
  {name: 'Blender', level: 5, max: 10, color:' #611e6d'},
  {name: 'JavaScript', level: 5, max: 10, color:' #0b238e'}

]
const about = {
  name: 'FILIP MIHAJLOV',
  className: 'SOFTWARE DEVELOPER',
  level: 'CS STUDENT',
  seeking: 'DEV ROLE',
  spec: 'INTERACTIVE WEB DEVELOPMENT',
  located: 'SKOPJE, MK',
}

const contact = [
  { 
    label: 'EMAIL',
    value: 'filip_2002_mihajlov@hotmail.com',
    url: 'https://mail.google.com/mail/?view=cm&fs=1&to=filip_2002_mihajlov@hotmail.com&su=Lets%20work%20together',
  },
  {
    label: 'GITHUB',
    value: 'github.com/FilipMihajlov1',
    url: 'https://github.com/FilipMihajlov1',
  },
  {
    label: 'LINKEDIN',
    value: 'linkedin.com/in/filip-mihajlov',
    url: 'https://www.linkedin.com/in/filip-mihajlov-6061b7269/',
  },
  {
    label: 'INSTAGRAM',
    value: 'instagram.com/fmihajlov4',
    url: 'https://www.instagram.com/fmihajlov4/',
  }
]

const builtWith = {
  stack: ['THREE.JS', 'BLENDER', 'VITE', 'CANVAS2D', 'WEB AUDIO API', 'VANILLA JS'],
  facts: [
    'This screen is a live HTML canvas, redrawn every frame and mapped onto the cabinet as a texture.',
    'The joystick uses real 3D raycasting to detect clicks — not a hidden 2D hitbox.',
    'No UI framework was used — every pixel here is hand-drawn with the Canvas2D API.',
    'The entire cabinet is one hand-built Blender model, textured and exported as a single .glb file.',
  ],
}


const highlightableLists = {
  projects,
  skills,
  contact,
}

// screens only reachable via their own dedicated button — joystick left/right can't enter or leave them
const cycleLockedSections = ['attract', 'contact', 'builtwith']

const state = {
  currentSection : 'attract',
  highlightIndex: 0,
  sections: ['attract', 'projects', 'skills', 'about', 'contact', 'builtwith'],
}

window.addEventListener('keydown', (e) => {
  if (!hasEntered) return
  if(e.key === 'ArrowRight' && !cycleLockedSections.includes(state.currentSection)){
    const cycle = ['projects','skills', 'about']
    const currentIndex = cycle.indexOf(state.currentSection)
    const nextIndex = Math.min(currentIndex + 1, cycle.length - 1)
    state.currentSection = cycle[nextIndex]
    state.highlightIndex = 0
    console.log(state.currentSection)
  }
})

function goHome() {
  state.currentSection = 'attract'
  state.highlightIndex = 0
}

function goToContact() {
  state.currentSection = 'contact'
  state.highlightIndex = 0
}

function goToBuiltWith() {
  state.currentSection = 'builtwith'
  state.highlightIndex = 0
}

function handleConfirm() {
  if (state.currentSection === 'attract') {
    playSound('insertCoin')
    state.currentSection = 'projects'
    state.highlightIndex = 0
  } else if (state.currentSection === 'projects') {
    const project = projects[state.highlightIndex]
    window.open(project.url, '_blank')
  } else if (state.currentSection === 'contact') {
    const link = contact[state.highlightIndex]
    window.open(link.url, '_blank')
  }
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const soundBuffers = {}

async function loadSound(name, url) {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  soundBuffers[name] = await audioContext.decodeAudioData(arrayBuffer)
}

function playSound(name) {
  const buffer = soundBuffers[name]
  if (!buffer) return

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.connect(audioContext.destination)
  source.start(0)
}

loadSound('click', '/sounds/click.wav')
loadSound('switch', '/sounds/switch.wav')
loadSound('insertCoin', '/sounds/insert_coin.wav')

function handleButtonPress(name) {
  playSound('click')

  if (name === 'button1') handleConfirm()
  if (name === 'button2') goHome()
  if (name === 'button3') goToBuiltWith()
  if (name === 'button4') goToContact()
}

const keyToButton = {
  z: 'button1',
  x: 'button2',
  a: 'button3',
  s: 'button4',
}

window.addEventListener('keydown', (e) => {
  if (!hasEntered) return
  const buttonName = keyToButton[e.key.toLowerCase()]
  if (buttonName) {
    handleButtonPress(buttonName)
  }
})

window.addEventListener('pointerdown', (e) => {
  if (!hasEntered) return
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }

  const rect = renderer.domElement.getBoundingClientRect()

  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse,camera)

  if(joystickParts.length > 0){
    const intersects = raycaster.intersectObjects(joystickParts)

    if(intersects.length > 0 ){
      isDraggingJoystick = true
      dragStartX= e.clientX
      dragStartY= e.clientY
      hasTriggeredMove = false
      controls.enabled= false
      console.log('Joystick grabbed',performance.now())
    }
  }

  const buttonHits = raycaster.intersectObjects(Object.values(buttonMeshes))

  if (buttonHits.length > 0) {
    const buttonName = buttonHits[0].object.name
    console.log(buttonName, 'pressed')
    handleButtonPress(buttonName)
  }
})

window.addEventListener('pointerup', (e) => {
  isDraggingJoystick = false
  hasTriggeredMove = true
  controls.enabled= true

  if(joystickPivot){
    joystickPivot.rotation.set(0, 0, 0)
  }
  console.log('joystick released',performance.now())
})

window.addEventListener('pointermove', (e) => {
  if(!isDraggingJoystick) return

  const deltaX = e.clientX - dragStartX
  const deltaY = e.clientY - dragStartY

  const maxTilt = 0.3
  const tiltAmountX = THREE.MathUtils.clamp(deltaX / 100, -1, 1) * maxTilt
  const tiltAmountZ = THREE.MathUtils.clamp(deltaY / 100, -1, 1) * maxTilt

  joystickPivot.rotation.z = -tiltAmountZ
  joystickPivot.rotation.x = -tiltAmountX

  if (hasTriggeredMove) return


  const threshold = 40 

  if(Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return

  if(Math.abs(deltaX) > Math.abs(deltaY)) {
    if (state.currentSection === 'contact') {
      // the 3 social links sit side by side on screen, so left/right cycles
      // between them once you're down in that row (index 0 is the email compose block)
      if (state.highlightIndex >= 1) {
        const iconCount = contact.length - 1
        const iconIndex = state.highlightIndex - 1
        const nextIconIndex = deltaX > 0
          ? (iconIndex + 1) % iconCount
          : (iconIndex - 1 + iconCount) % iconCount
        state.highlightIndex = nextIconIndex + 1
        playSound('switch')
      }
    } else if (!cycleLockedSections.includes(state.currentSection)) {
      const cycle = ['projects', 'skills', 'about']
      const currentIndex = cycle.indexOf(state.currentSection)

      if (deltaX > 0){
        const nextIndex = Math.min(currentIndex + 1, cycle.length - 1)
        state.currentSection = cycle[nextIndex]
      }else {
        const nextIndex = Math.max(currentIndex - 1, 0)
        state.currentSection= cycle[nextIndex]
      }

      state.highlightIndex = 0
      playSound('switch')
      console.log(state.currentSection)
    }
  }else {
    if (state.currentSection === 'contact') {
      // up/down toggles between the email compose block (0) and the icon row
      state.highlightIndex = state.highlightIndex === 0 ? 1 : 0
      playSound('switch')
    } else {
      const list = highlightableLists[state.currentSection]

      if (list) {
        const wraps = state.currentSection !== 'skills'

        if (deltaY > 0) {
          state.highlightIndex = wraps
            ? (state.highlightIndex + 1) % list.length
            : Math.min(state.highlightIndex + 1, list.length - 1)
        }else{
          state.highlightIndex = wraps
            ? (state.highlightIndex - 1 + list.length) % list.length
            : Math.max(state.highlightIndex - 1, 0)
        }

        playSound('switch')
        console.log('highlighted index: ',state.highlightIndex)
      }
    }
  }

  hasTriggeredMove = true
})

const FONT = '"Geist Pixel", sans-serif'
const TEXT_MUTED = '#a99bd6' // brighter secondary/label color — the old dim purples got lost under the CRT vignette

document.fonts.ready.then(() => {
  console.log('Fonts loaded')
})

const controlsGuideEl = document.createElement('div')
controlsGuideEl.style.position = 'fixed'
controlsGuideEl.style.right = '24px'
controlsGuideEl.style.bottom = '24px'
controlsGuideEl.style.color = '#6c51b0'
controlsGuideEl.style.fontFamily = FONT
controlsGuideEl.style.fontSize = '25px'
controlsGuideEl.style.pointerEvents = 'none'
controlsGuideEl.style.userSelect = 'none'
controlsGuideEl.style.display = 'flex'
controlsGuideEl.style.flexDirection = 'column'
controlsGuideEl.style.alignItems = 'flex-end'
controlsGuideEl.style.gap = '10px'
document.body.appendChild(controlsGuideEl)

const buttonRowsEl = document.createElement('div')
buttonRowsEl.style.display = 'flex'
buttonRowsEl.style.flexDirection = 'column'
buttonRowsEl.style.alignItems = 'flex-end'
buttonRowsEl.style.gap = '10px'
controlsGuideEl.appendChild(buttonRowsEl)

const joystickGuideStyleEl = document.createElement('style')
joystickGuideStyleEl.textContent = `
  @keyframes nudgeUp    { 0%,100% { opacity:.35; transform:translateY(0); } 50% { opacity:1; transform:translateY(-3px); } }
  @keyframes nudgeDown  { 0%,100% { opacity:.35; transform:translateY(0); } 50% { opacity:1; transform:translateY(3px); } }
  @keyframes nudgeLeft  { 0%,100% { opacity:.35; transform:translateX(0); } 50% { opacity:1; transform:translateX(-3px); } }
  @keyframes nudgeRight { 0%,100% { opacity:.35; transform:translateX(0); } 50% { opacity:1; transform:translateX(3px); } }
`
document.head.appendChild(joystickGuideStyleEl)

const joystickGuideEl = document.createElement('div')
joystickGuideEl.style.position = 'relative'
joystickGuideEl.style.width = '62px'
joystickGuideEl.style.height = '62px'
joystickGuideEl.innerHTML = `
  <span style="position:absolute; top:-2px; left:24px; color:#a855f7; font-size:18px; animation:nudgeUp 1.8s ease-in-out infinite;">▲</span>
  <span style="position:absolute; bottom:-2px; left:24px; color:#a855f7; font-size:18px; animation:nudgeDown 1.8s ease-in-out infinite;">▼</span>
  <span style="position:absolute; left:-4px; top:24px; color:#a855f7; font-size:18px; animation:nudgeLeft 1.8s ease-in-out infinite;">◀</span>
  <span style="position:absolute; right:-4px; top:24px; color:#a855f7; font-size:18px; animation:nudgeRight 1.8s ease-in-out infinite;">▶</span>
  <span style="position:absolute; top:24px; left:24px; width:14px; height:14px; border-radius:50%; background:#a855f7;"></span>
`
controlsGuideEl.appendChild(joystickGuideEl)

const loadingOverlayEl = document.createElement('div')
loadingOverlayEl.style.position = 'fixed'
loadingOverlayEl.style.inset = '0'
loadingOverlayEl.style.backgroundColor = '#0a0520'
loadingOverlayEl.style.zIndex = '9999'
loadingOverlayEl.style.display = 'flex'
loadingOverlayEl.style.flexDirection = 'column'
loadingOverlayEl.style.alignItems = 'center'
loadingOverlayEl.style.justifyContent = 'center'
loadingOverlayEl.style.fontFamily = '"Consolas", "Courier New", monospace'
loadingOverlayEl.style.transition = 'opacity 0.6s ease'

const loadingOverlayStyleEl = document.createElement('style')
loadingOverlayStyleEl.textContent = `
  .boot-col { width: min(560px, 88vw); }
  #bootLog { height: 260px; font-size: 13px; }
  @media (max-width: 700px) {
    #bootLog { height: 34vh; font-size: clamp(10px, 3vw, 13px); }
    #bootPercentText { font-size: clamp(10px, 2.6vw, 12px); }
  }
`
document.head.appendChild(loadingOverlayStyleEl)

loadingOverlayEl.innerHTML = `
  <div id="bootLog" class="boot-col" style="overflow:hidden; color:#a8c8ff; line-height:1.7;"></div>
  <div class="boot-col" style="height:8px; background:#0d1b2e; border:1px solid #1c3a63; margin-top:14px;">
    <div id="bootBarFill" style="width:0%; height:100%; background:#4fa3ff;"></div>
  </div>
  <div id="bootPercentText" class="boot-col" style="margin-top:6px; color:#5b7bb8; font-size:12px;">0%</div>
`
document.body.appendChild(loadingOverlayEl)

const enterOverlayStyleEl = document.createElement('style')
enterOverlayStyleEl.textContent = `
  @keyframes enterPromptBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }
  @keyframes enterStickTilt {
    0%, 100% { transform: rotate(0deg); }
    20% { transform: rotate(-14deg); }
    40% { transform: rotate(0deg); }
    60% { transform: rotate(14deg); }
    80% { transform: rotate(0deg); }
  }
  .enter-overlay { flex-direction: row; }
  .enter-hero { flex: 1.1; gap: 16px; }
  .enter-prompt { margin-top: 30px; }
  .enter-overlay-controls { flex: 1; gap: 22px; border-left: 2px solid #4c2a8f; border-top: none; padding: 14% 6% 0; }
  .enter-stick-box { width: 260px; height: 300px; }
  @media (max-width: 700px), (max-aspect-ratio: 4/5) {
    /* stacked mobile layout: both blocks size to their own content (flex: none) instead
       of splitting the viewport by a fixed ratio — on a short viewport that ratio left
       too little room for the hero text, which then visually overlapped the block below */
    .enter-overlay { flex-direction: column; overflow-y: auto; padding: 20px 0; justify-content: flex-start; }
    .enter-hero { flex: none; gap: 10px; padding: 0 6%; }
    .enter-prompt { margin-top: 14px; }
    .enter-overlay-controls {
      flex: none; border-left: none; border-top: 2px solid #4c2a8f;
      padding: 20px 8% 8px; justify-content: flex-start; gap: 14px;
    }
    /* fixed-px children inside are positioned relative to this box's original 260x300
       size, so shrink it uniformly via transform rather than resizing width/height —
       resizing directly would leave the (still fixed-px) children misaligned/clipped */
    .enter-stick-box { transform: scale(0.72); margin: -40px auto -46px; }
  }
`
document.head.appendChild(enterOverlayStyleEl)

const enterOverlayEl = document.createElement('div')
enterOverlayEl.className = 'enter-overlay'
enterOverlayEl.style.position = 'fixed'
enterOverlayEl.style.inset = '0'
enterOverlayEl.style.backgroundColor = '#0a0520'
enterOverlayEl.style.zIndex = '9998'
enterOverlayEl.style.display = 'none'
enterOverlayEl.style.fontFamily = FONT
enterOverlayEl.style.cursor = 'pointer'
enterOverlayEl.style.transition = 'opacity 0.5s ease'

enterOverlayEl.innerHTML = `
  <div class="enter-hero" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; min-height:0;">
    <div style="font-size:clamp(32px,5vw,64px); color:#f0abfc; font-weight:700; line-height:1.2;">FILIP<br/>MIHAJLOV</div>
    <div style="font-size:clamp(13px,1.4vw,18px); color:#818cf8; letter-spacing:3px;">ARCADE PORTFOLIO</div>
    <div class="enter-prompt" style="font-size:clamp(15px,1.6vw,20px); color:#f59e0b; letter-spacing:1px; animation:enterPromptBlink 1.2s infinite;">
      &gt; CLICK TO ENTER &lt;
    </div>
  </div>
  <div class="enter-overlay-controls" style="display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">
    <div style="width:100%; font-size:clamp(13px,1.4vw,17px); color:#818cf8; letter-spacing:2px; border-bottom:1px solid #4c2a8f; padding-bottom:16px;">CONTROLS</div>
    <div style="width:100%; max-width:320px; display:flex; flex-direction:column; gap:14px; font-size:clamp(14px,1.6vw,20px); color:#a8c8ff;">
      <div style="display:flex; justify-content:space-between;"><span>START</span><span style="color:#f0abfc;">[Z]</span></div>
      <div style="display:flex; justify-content:space-between;"><span>HOME</span><span style="color:#f0abfc;">[X]</span></div>
      <div style="display:flex; justify-content:space-between;"><span>SETTINGS</span><span style="color:#f0abfc;">[A]</span></div>
      <div style="display:flex; justify-content:space-between;"><span>CONTACT</span><span style="color:#f0abfc;">[S]</span></div>
    </div>
    <div class="enter-stick-box" style="position:relative; margin-top:auto; margin-bottom:auto;">
      <div style="position:absolute; bottom:14px; left:50%; width:150px; height:46px; margin-left:-75px; background:radial-gradient(ellipse at center, #2a1a4d, #150c2c 75%); border-radius:50%; box-shadow:0 0 0 1px rgba(124,58,237,0.3);"></div>
      <div style="position:absolute; bottom:34px; left:50%; width:18px; height:160px; margin-left:-9px; transform-origin:bottom center; animation:enterStickTilt 3.6s ease-in-out infinite;">
        <div style="width:100%; height:100%; background:linear-gradient(to top, #6d3fc9, #a855f7); border-radius:7px;"></div>
        <div style="position:absolute; top:-32px; left:50%; width:68px; height:68px; margin-left:-34px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #d9b8ff, #a855f7 60%, #6d3fc9); box-shadow:0 0 32px 5px rgba(168,85,247,0.55);"></div>
      </div>
    </div>
  </div>
`
document.body.appendChild(enterOverlayEl)

function enterSite() {
  if (hasEntered) return
  hasEntered = true

  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }

  enterOverlayEl.style.opacity = '0'
  setTimeout(() => {
    enterOverlayEl.remove()
    setTimeout(() => {
      cameraIntroEnd = computeCameraIntroEnd()
      cameraIntroStartTime = performance.now()
    }, 700)
  }, 500)
}

enterOverlayEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
  enterSite()
})

const bootLog = loadingOverlayEl.querySelector('#bootLog')

const bootLines = [
  'mounting scene graph',
  'initializing WebGL renderer',
  'compiling shaders',
  'calibrating joystick raycaster',
  'registering button meshes',
  'building canvas screen texture',
  'parsing GLTF node hierarchy',
  'decoding textures',
  'checking font availability (Geist Pixel)',
  'warming up ambient + point lights',
  'linking highlightable lists',
  'aligning joystick pivot transform',
  'priming pointer event listeners',
  'verifying no UI framework was harmed',
  'loading cabinet.glb',
]

let bootLineIndex = 0

const bootLineInterval = setInterval(() => {
  const line = document.createElement('div')
  line.textContent = `> ${bootLines[bootLineIndex % bootLines.length]} [ok]`
  bootLog.appendChild(line)
  bootLog.scrollTop = bootLog.scrollHeight
  bootLineIndex++
}, 220)

const controlsGuideBySection = {
  attract:  [{ key: 'Z', action: 'START' },  { key: 'A', action: 'SETTINGS' }, { key: 'S', action: 'CONTACT' }],
  projects: [{ key: 'Z', action: 'SELECT' }, { key: 'X', action: 'HOME' }, { key: 'A', action: 'SETTINGS' }, { key: 'S', action: 'CONTACT' }],
  skills:   [{ key: 'X', action: 'HOME' },   { key: 'A', action: 'SETTINGS' }, { key: 'S', action: 'CONTACT' }],
  about:    [{ key: 'X', action: 'HOME' },   { key: 'A', action: 'SETTINGS' }, { key: 'S', action: 'CONTACT' }],
  contact:  [{ key: 'Z', action: 'OPEN LINK' }, { key: 'X', action: 'HOME' }, { key: 'A', action: 'SETTINGS' }],
  builtwith: [{ key: 'X', action: 'HOME' },  { key: 'S', action: 'CONTACT' }],
}

function updateControlsGuide() {
  const rows = controlsGuideBySection[state.currentSection] || []

  buttonRowsEl.innerHTML = rows.map(row => `
    <div style="display:flex; align-items:center; gap:10px;">
      <span>${row.action}</span>
      <span style="
        display:flex; align-items:center; justify-content:center;
        width:36px; height:36px; border-radius:50%;
        border:2px solid #4c3880; flex-shrink:0;
        font-weight:700; font-size:16px;
      ">${row.key}</span>
    </div>
  `).join('')
}

function drawAttractScreen() {
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  drawScreenBorder('#7c3aed')

  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 45px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Filip Mihajlov', 512, 315)

  ctx.fillStyle = '#818cf8'
  ctx.font = `26px ${FONT}`
  ctx.fillText('SOFTWARE DEVELOPER', 512, 407)

  //divider
  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, 459)
  ctx.lineTo(904, 459)
  ctx.stroke()

  //blinking press start
  if (Math.floor(Date.now() / 700) % 2 === 0) {
    ctx.fillStyle = '#f0abfc'
    ctx.font = `55px ${FONT}`
    ctx.fillText('PRESS START', 512, 643)
  }

  //insert coin
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `bold 37px ${FONT}`
  ctx.fillText('INSERT COIN TO CONTINUE', 512, 1181)

  const dotColors = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b']
  dotColors.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(340 + i * 80, 984, 24, 24)
  })
}
function wrapText(text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = ctx.measureText(testLine).width

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  })

  if (currentLine) lines.push(currentLine)
  return lines
}

function drawBuiltWithScreen() {
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  drawScreenBorder('#f43f5e')

  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 50px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('SETTINGS', 512, 171)

  ctx.fillStyle = '#818cf8'
  ctx.font = `25px ${FONT}`
  ctx.fillText('HOW THIS WORKS', 512, 223)

  //divider
  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, 256)
  ctx.lineTo(904, 256)
  ctx.stroke()

  ctx.fillStyle = '#f43f5e'
  ctx.font = `bold 27px ${FONT}`

  const stackLines = wrapText(builtWith.stack.join('   ·   '), 780)
  const stackLineHeight = 42

  stackLines.forEach((line, i) => {
    ctx.fillText(line, 512, 341 + i * stackLineHeight)
  })

  ctx.fillStyle = '#d4c8f0'
  ctx.font = `30px ${FONT}`

  const factStartY = 551
  const factGap = 171
  const factLineHeight = 34

  builtWith.facts.forEach((fact, i) => {
    const factY = factStartY + i * factGap
    const factLines = wrapText(fact, 700)

    factLines.forEach((line, j) => {
      ctx.fillText(line, 512, factY + j * factLineHeight)
    })
  })
}

function drawProjectsScreen() {
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  drawScreenBorder('#ec4899')

  const current = state.highlightIndex
  const total = projects.length
  const project = projects[current]

  const dividerX = 380
  const leftCenterX = (24 + dividerX) / 2
  const rightX = 430
  const rightMaxWidth = 550

  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(dividerX, 24)
  ctx.lineTo(dividerX, SCREEN_H - 24)
  ctx.stroke()

  // --- left column: index ---
  ctx.textAlign = 'center'
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `bold 24px ${FONT}`
  ctx.fillText('PROJECT', leftCenterX, 197)

  const pulse = 12 + Math.sin(Date.now() / 500) * 6
  ctx.shadowColor = '#a855f7'
  ctx.shadowBlur = pulse
  ctx.fillStyle = '#a855f7'
  ctx.font = `bold 110px ${FONT}`
  ctx.fillText(String(current + 1).padStart(2, '0'), leftCenterX, 394)
  ctx.shadowBlur = 0

  ctx.fillStyle = TEXT_MUTED
  ctx.font = `24px ${FONT}`
  ctx.fillText(`of ${String(total).padStart(2, '0')}`, leftCenterX, 446)

  const trackTop = 551
  const trackHeight = 446
  ctx.fillStyle = 'rgba(139, 92, 246, 0.18)'
  ctx.fillRect(leftCenterX - 1.5, trackTop, 3, trackHeight)

  const segmentHeight = trackHeight / total
  ctx.fillStyle = '#ec4899'
  ctx.fillRect(leftCenterX - 1.5, trackTop + segmentHeight * current, 3, segmentHeight)

  ctx.fillStyle = TEXT_MUTED
  ctx.font = `20px ${FONT}`
  ctx.fillText('JOYSTICK ▲ ▼ BROWSE', leftCenterX, 1050)

  // --- right column: project details ---
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 46px ${FONT}`
  const titleLines = wrapText(project.name, rightMaxWidth)
  const titleLineHeight = 60
  titleLines.forEach((line, i) => {
    ctx.fillText(line, rightX, 289 + i * titleLineHeight)
  })
  const titleBottomY = 289 + (titleLines.length - 1) * titleLineHeight

  const underlineWidth = 46 + Math.sin(Date.now() / 500) * 16
  ctx.fillStyle = '#ec4899'
  ctx.fillRect(rightX, titleBottomY + 34, underlineWidth, 4)

  const tags = project.tech.split('/').map(t => t.trim())
  let tagY = titleBottomY + 92
  ctx.font = `24px ${FONT}`
  tags.forEach(tag => {
    ctx.fillStyle = '#a855f7'
    ctx.fillRect(rightX, tagY - 16, 3, 20)
    ctx.fillStyle = '#818cf8'
    ctx.fillText(tag.toUpperCase(), rightX + 14, tagY)
    tagY += 45
  })

  // terminal-style description panel, sized to fit its own content, flush
  // against the divider line
  const panelX = dividerX + 10
  const panelTop = tagY + 16
  const panelWidth = rightX + rightMaxWidth - panelX
  const panelPadding = 32
  const arrowGutter = 26

  ctx.font = `30px ${FONT}`
  const descWrapWidth = panelWidth - panelPadding * 2 - arrowGutter
  const descLines = wrapText(project.description, descWrapWidth)
  const descLineHeight = 42

  const commentGap = 14
  const commentLineHeight = descLineHeight
  const panelHeight = panelPadding * 2 + commentLineHeight + commentGap + descLines.length * descLineHeight - (descLineHeight - 30)

  ctx.fillStyle = '#0a0716'
  ctx.beginPath()
  ctx.roundRect(panelX, panelTop, panelWidth, panelHeight, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = TEXT_MUTED
  ctx.font = `bold 25px ${FONT}`
  ctx.fillText('/* description */', panelX + panelPadding, panelTop + panelPadding + 14)

  const descStartY = panelTop + panelPadding + 14 + commentGap + 30
  const textX = panelX + panelPadding + arrowGutter

  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = '#ec4899'
    ctx.font = `bold 30px ${FONT}`
    ctx.fillText('▸', panelX + panelPadding, descStartY)
  }

  ctx.fillStyle = '#a7c9f0'
  ctx.font = `30px ${FONT}`
  descLines.forEach((line, i) => {
    ctx.fillText(line, textX, descStartY + i * descLineHeight)
  })

  ctx.fillStyle = '#ec4899'
  ctx.font = `bold 20px ${FONT}`
  ctx.fillText('PRESS Z TO VIEW ON GITHUB →', rightX, panelTop + panelHeight + 55)
}

const SKILLS_HIGHLIGHT_COLOR = '#ec4899'

function skillMonogram(name) {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
}

function drawSkillsScreen(){
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0,0,SCREEN_W,SCREEN_H)

  drawScreenBorder('#10b981')

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e67fdb'
  ctx.font = `bold 45px ${FONT}`
  ctx.fillText('SKILLS', 512,144)

  ctx.fillStyle = '#818cf8'
  ctx.font = `25px ${FONT}`
  ctx.fillText('SYSTEMS & LANGUAGES', 512,203)

  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120,230)
  ctx.lineTo(904,230)
  ctx.stroke()

  const rowHeight = 158
  const startY = 315
  const visibleRows = 6

  let scrollOffset = state.highlightIndex - Math.floor(visibleRows / 2)
  scrollOffset = Math.max(0, Math.min(scrollOffset, skills.length - visibleRows))
  if (skills.length <= visibleRows) scrollOffset = 0

  const visibleSkills = skills.slice(scrollOffset, scrollOffset + visibleRows)
  const badgeSize = 72
  const badgeX = 90
  const trackX = 290
  const trackWidth = 460
  const trackHeight = 12

  visibleSkills.forEach((skill,i) => {
    const rowY = startY + i * rowHeight
    const skillIndex = scrollOffset + i
    const isActive = skillIndex === state.highlightIndex

    if (isActive && Math.floor(Date.now() / 700) % 2 === 0) {
      ctx.fillStyle = 'rgba(236, 72, 153, 0.08)'
      ctx.beginPath()
      ctx.roundRect(70, rowY - 54, 860, 104, 12)
      ctx.fill()
      ctx.strokeStyle = SKILLS_HIGHLIGHT_COLOR
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // monogram badge
    const badgeCenterY = rowY - 6
    ctx.fillStyle = skill.color.trim()
    ctx.beginPath()
    ctx.roundRect(badgeX, badgeCenterY - badgeSize / 2, badgeSize, badgeSize, 14)
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#06040f'
    ctx.font = `bold 28px ${FONT}`
    ctx.fillText(skillMonogram(skill.name), badgeX + badgeSize / 2, badgeCenterY + 10)

    // name
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f0e8ff'
    ctx.font = `bold 24px ${FONT}`
    ctx.fillText(skill.name.trim(), trackX, rowY - 20)

    // gradient-glow track
    const trackY = rowY - 2
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.beginPath()
    ctx.roundRect(trackX, trackY, trackWidth, trackHeight, 6)
    ctx.fill()

    const fillWidth = Math.max((skill.level / skill.max) * trackWidth, trackHeight)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(trackX, trackY, fillWidth, trackHeight, 6)
    ctx.clip()
    ctx.fillStyle = skill.color.trim()
    ctx.fillRect(trackX, trackY, fillWidth, trackHeight)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fillRect(trackX, trackY, fillWidth, trackHeight / 2)
    ctx.restore()

    // level readout
    ctx.textAlign = 'right'
    ctx.fillStyle = TEXT_MUTED
    ctx.font = `bold 22px ${FONT}`
    ctx.fillText(`LV${skill.level}`, 900, rowY - 6)
  })
}

function drawAboutScreen(){
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0,0,SCREEN_W,SCREEN_H)

  drawScreenBorder('#3b82f6')

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 45px ${FONT}`
  ctx.fillText('ABOUT', 512,171)

  ctx.fillStyle = '#818cf8'
  ctx.font = `20px ${FONT}`
  ctx.fillText('PLAYER CARD', 512,223)

  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120,256)
  ctx.lineTo(904,256)
  ctx.stroke()

  const portraitX = 100
  const portraitY = 289
  const portraitSize = 220

  ctx.fillStyle = '#1a1030'
  ctx.fillRect(portraitX, portraitY, portraitSize, portraitSize)

  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 3
  ctx.strokeRect(portraitX, portraitY, portraitSize, portraitSize)

  const initials = about.name.split(' ').map(word => word[0]).join('')

  ctx.textAlign = 'center'
  ctx.fillStyle = '#3b82f6'
  ctx.font = `bold 80px ${FONT}`
  ctx.fillText(initials, portraitX + portraitSize / 2, portraitY + portraitSize / 2 + 28)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 40px ${FONT}`
  ctx.fillText(about.name, portraitX + portraitSize + 40, portraitY + 118)

  ctx.fillStyle = '#3b82f6'
  ctx.font = `20px ${FONT}`
  ctx.fillText(about.className, portraitX + portraitSize + 40, portraitY + 171)

  const col1X = 100
  const col2X = 560
  const rowGap = 144

  const fields = [
    [{ label: 'SEEKING', value: about.seeking }, { label: 'LEVEL', value: about.level }],
    [{ label: 'LOCATED', value: about.located }, null],
    [{ label: 'SPEC', value: about.spec }, null],
  ]

  fields.forEach((row, rowIndex) => {
    const rowY = 735 + rowIndex * rowGap

    row.forEach((field, colIndex) => {
      if (!field) return
      const x = colIndex === 0 ? col1X : col2X

      ctx.fillStyle = TEXT_MUTED
      ctx.font = `bold 29px ${FONT}`
      ctx.fillText(field.label, x, rowY)

      ctx.fillStyle = '#d4c8f0'
      ctx.font = `bold 30px ${FONT}`
      ctx.fillText(field.value, x, rowY + 45)
    })
  })
}

function drawContactScreen(){
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0,0,SCREEN_W,SCREEN_H)

  drawScreenBorder('#ec4899')

  // --- terminal titlebar ---
  const titlebarY = 24
  const titlebarHeight = 90

  ctx.fillStyle = '#150c2c'
  ctx.fillRect(25, titlebarY, 974, titlebarHeight)
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(24, titlebarY + titlebarHeight)
  ctx.lineTo(999, titlebarY + titlebarHeight)
  ctx.stroke()

  const dotY = titlebarY + titlebarHeight / 2
  const dotColors = ['#ff5f57', '#febc2e', '#28c840']
  dotColors.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(64 + i * 30, dotY, 9, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.textAlign = 'left'
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `bold 24px ${FONT}`
  ctx.fillText('compose_message.eml', 165, dotY + 7)

  // --- compose block (contact[0], the email link) ---
  const emailActive = state.highlightIndex === 0
  const composeX = 62
  const composeWidth = 900
  const composeY = titlebarY + titlebarHeight + 34
  const composeHeight = 320

  const bodyX = composeX + 10
  ctx.textAlign = 'left'
  ctx.font = `italic bold 24px ${FONT}`
  ctx.fillStyle = TEXT_MUTED
  ctx.fillText('// press Z to open in your email client', bodyX, composeY + 40)

  ctx.font = `bold 26px ${FONT}`
  ctx.fillStyle = '#38bdf8'
  ctx.fillText('to:', bodyX, composeY + 100)
  ctx.fillStyle = '#10b981'
  ctx.fillText(contact[0].value, bodyX + 60, composeY + 100)

  ctx.fillStyle = '#38bdf8'
  ctx.fillText('subject:', bodyX, composeY + 160)
  ctx.fillStyle = '#10b981'
  ctx.fillText('Lets work together', bodyX + 140, composeY + 160)

  ctx.fillStyle = '#d4c8f0'
  ctx.font = `26px ${FONT}`
  ctx.fillText('Hey Filip, I saw your portfolio and', bodyX, composeY + 250)
  if (emailActive && Math.floor(Date.now() / 500) % 2 === 0) {
    const cursorX = bodyX + ctx.measureText('Hey Filip, I saw your portfolio and').width + 6
    ctx.fillStyle = '#ec4899'
    ctx.fillRect(cursorX, composeY + 226, 12, 26)
  }

  // --- connect row: github / linkedin / instagram as CLI-style flags,
  // anchored near the bottom of the screen ---
  const connectRowY = SCREEN_H - 24 - 110

  // divider separating the compose block from the social links, sitting
  // just above the icon row instead of right under the compose block
  const dividerY = connectRowY - 74
  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, dividerY)
  ctx.lineTo(904, dividerY)
  ctx.stroke()

  const connectItems = [
    { key: 'github', label: '--github', color: '#e5e5e5' },
    { key: 'linkedin', label: '--linkedin', color: '#0077b5' },
    { key: 'instagram', label: '--instagram', color: '#dd2a7b' },
  ]
  const slotWidth = 900 / connectItems.length
  ctx.textAlign = 'center'

  const connectFont = `bold 24px ${FONT}`
  const swatchSize = 20
  const iconGap = 12

  connectItems.forEach((item, i) => {
    const centerX = 62 + slotWidth * i + slotWidth / 2
    const contactIndex = i + 1 // contact[0] is email, 1-3 are the socials
    const isActive = state.highlightIndex === contactIndex

    ctx.font = connectFont
    const labelWidth = ctx.measureText(item.label).width
    const groupWidth = swatchSize + iconGap + labelWidth
    const groupStartX = centerX - groupWidth / 2

    if (isActive && Math.floor(Date.now() / 1000) % 2 === 0) {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ec4899'
      ctx.font = `bold 32px ${FONT}`
      ctx.fillText('▸', groupStartX - 10, connectRowY + 10)
      ctx.font = connectFont
    }

    ctx.fillStyle = item.color
    ctx.beginPath()
    ctx.roundRect(groupStartX, connectRowY - swatchSize / 2, swatchSize, swatchSize, 5)
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = isActive ? '#ffffff' : TEXT_MUTED
    ctx.fillText(item.label, groupStartX + swatchSize + iconGap, connectRowY + 8)
    ctx.textAlign = 'center'
  })
}

function applyScreenCrtOverlay() {
  // faint scanlines
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.fillStyle = '#000000'
  for (let y = 0; y < SCREEN_H; y += 4) {
    ctx.fillRect(0, y, SCREEN_W, 2)
  }
  ctx.restore()

  // vignette
  const vignette = ctx.createRadialGradient(
    SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.35,
    SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.75
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  // soft diagonal glass sheen
  const sheen = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H)
  sheen.addColorStop(0, 'rgba(255,255,255,0.05)')
  sheen.addColorStop(0.15, 'rgba(255,255,255,0.02)')
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
}

function drawScreen(section) {
  if(section === 'attract'){
    drawAttractScreen()
  }
  if(section === 'projects'){
    drawProjectsScreen()
  }
  if(section === 'skills'){
    drawSkillsScreen()
  }
  if(section === 'about'){
    drawAboutScreen()
  }
  if(section === 'contact'){
    drawContactScreen()
  }
  if(section === 'builtwith'){
    drawBuiltWithScreen()
  }
  applyScreenCrtOverlay()
}

const screenTexture = new THREE.CanvasTexture(screenCanvas)
screenTexture.flipY = false
screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()

const gameOverVideo = document.createElement('video')
gameOverVideo.src = '/videos/Game_Over.mp4'
gameOverVideo.playsInline = true
gameOverVideo.preload = 'auto'
const GAME_OVER_VOLUME = 0.25

const videoCanvas = document.createElement('canvas')
videoCanvas.width = SCREEN_W
videoCanvas.height = SCREEN_H
const videoCtx = videoCanvas.getContext('2d')
const videoScreenTexture = new THREE.CanvasTexture(videoCanvas)
videoScreenTexture.flipY = false

let gameOverActive = false

function drawGameOverFrame() {
  videoCtx.fillStyle = '#0a0520'
  videoCtx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  const inset = 8
  const w = SCREEN_W - inset * 2
  const h = SCREEN_H - inset * 2
  const GAME_OVER_BRIGHTNESS = 0.55
  if (gameOverVideo.videoWidth > 0) {
    const vw = gameOverVideo.videoWidth
    const vh = gameOverVideo.videoHeight
    const scale = Math.min(w / vw, h / vh)
    const drawW = vw * scale
    const drawH = vh * scale
    const dx = inset + (w - drawW) / 2
    const dy = inset + (h - drawH) / 2

    videoCtx.save()
    videoCtx.beginPath()
    videoCtx.rect(inset, inset, w, h)
    videoCtx.clip()
    videoCtx.filter = `brightness(${GAME_OVER_BRIGHTNESS})`
    videoCtx.drawImage(gameOverVideo, dx, dy, drawW, drawH)
    videoCtx.filter = 'none'
    videoCtx.restore()
  }

  videoCtx.strokeStyle = '#f43f5e'
  videoCtx.lineWidth = 6
  videoCtx.strokeRect(inset, inset, w, h)

  videoScreenTexture.needsUpdate = true
}

function playGameOverClip() {
  if (!screenMesh) return
  gameOverActive = true
  screenMesh.material.emissiveMap = videoScreenTexture
  screenMesh.material.needsUpdate = true
  gameOverVideo.currentTime = 0
  gameOverVideo.volume = GAME_OVER_VOLUME
  gameOverVideo.muted = false
  gameOverVideo.play().catch(() => {
    // autoplay-with-sound blocked since no user gesture happened yet — fall back to muted
    gameOverVideo.muted = true
    gameOverVideo.play()
  })
}

gameOverVideo.addEventListener('ended', () => {
  gameOverActive = false
  if (!screenMesh) return
  screenMesh.material.emissiveMap = screenTexture
  screenMesh.material.needsUpdate = true
})


const loader = new GLTFLoader()

loader.load(
  '/cabinet.glb',
  (gltf) => {
    const cabinet = gltf.scene
    scene.add(cabinet)

    // force Three.js to update all world transforms after rotation
    cabinet.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(cabinet)
    console.log('min y:', box.min.y, 'max y:', box.max.y)

    cabinet.position.y -= box.min.y +1
    cabinet.position.x -= (box.min.x + box.max.x) / 2
    cabinet.position.z -= (box.min.z + box.max.z) / 2

    cabinet.traverse((child) => {
      if (child.isMesh) {
        console.log('Found mesh:', child.name)

        if(child.name === 'screen') {
          child.material = new THREE.MeshStandardMaterial({
            emissive: 0xffffff,
            emissiveMap: screenTexture,
            emissiveIntensity: 1.15,
            color: 0x000000,
            roughness: 0.35,
            metalness: 0,
          })
          child.material.toneMapped = false
          screenMesh = child
          console.log('Screen texture applied')
        }

        if(child.name.startsWith('joystick_handle')){
          joystickParts.push(child)
          console.log(child.name, 'found (joystick part)')
        }

        if (['button1', 'button2', 'button3', 'button4'].includes(child.name)) {
          buttonMeshes[child.name] = child
          console.log(child.name, 'mesh stored')
        }
      }
    })

    if (joystickParts.length > 0) {
      // multi-material Blender objects get split into a wrapping Group with one mesh
      // per material — all our matched parts share that same Group as their parent,
      // so reparenting the Group itself carries every part along in one shot
      const joystickGroup = joystickParts[0].parent

      const groupSize = new THREE.Vector3()
      new THREE.Box3().setFromObject(joystickGroup).getSize(groupSize)
      console.log('joystick group size:', groupSize.x, groupSize.y, groupSize.z)

      const pivot = new THREE.Group()
      pivot.position.copy(joystickGroup.position)
      pivot.position.y += JOYSTICK_PIVOT_OFFSET_Y
      joystickGroup.parent.add(pivot)
      pivot.attach(joystickGroup)

      joystickPivot = pivot
      console.log('Joystick pivot created, wrapping group:', joystickGroup.name)
    }

    clearInterval(bootLineInterval)
    const readyLine = document.createElement('div')
    readyLine.textContent = '> cabinet ready [ok]'
    bootLog.appendChild(readyLine)

    loadingOverlayEl.style.opacity = '0'
    setTimeout(() => loadingOverlayEl.remove(), 600)

    enterOverlayEl.style.display = 'flex'
  },
  (progress) => {
    // some servers omit Content-Length, leaving progress.total at 0 (Infinity% bug) —
    // fall back to the asset's known size on disk so the bar always has a real denominator
    const total = progress.total || CABINET_GLB_SIZE_BYTES
    const percent = Math.min((progress.loaded / total) * 100, 100)
    const bootBarFill = document.getElementById('bootBarFill')
    const bootPercentText = document.getElementById('bootPercentText')
    if (bootBarFill) bootBarFill.style.width = `${percent}%`
    if (bootPercentText) bootPercentText.textContent = `${percent.toFixed(0)}%`
    console.log(`Loading: ${percent.toFixed(0)}%`)
  },
  (error) => {
    console.error('Error loading cabinet:', error)
  }
)


function animate(){
  requestAnimationFrame(animate)

  if (cameraIntroStartTime !== null && !cameraIntroDone) {
    const elapsed = performance.now() - cameraIntroStartTime
    const progress = Math.min(elapsed / cameraIntroDuration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)

    camera.position.lerpVectors(cameraIntroStart, cameraIntroEnd, eased)
    camera.lookAt(0, 1.4, 0)

    if (progress === 1) {
      cameraIntroDone = true
      controls.enabled = true
    }
  }

  if (cameraIntroDone) {
    controls.update()
  }

  if (gameOverActive) {
    drawGameOverFrame()
  } else if (!cameraIntroDone) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    screenTexture.needsUpdate = true
  } else {
    drawScreen(state.currentSection)
    screenTexture.needsUpdate = true
  }
  updateControlsGuide()

  scene.traverse(darkenScreenForBloom)
  bloomComposer.render()
  scene.traverse(restoreScreenMaterial)
  composer.render()
}

animate()

window.addEventListener('resize', () =>{
  camera.aspect= window.innerWidth/ window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  bloomComposer.setSize(window.innerWidth, window.innerHeight)
})

