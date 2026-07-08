import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

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
document.body.appendChild(renderer.domElement)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.7,   // strength — how much brightness gets added to glowing areas
  0.2,   // radius — how far the glow spreads from bright pixels
  0.75   // threshold — only pixels brighter than this (0-1) bloom at all
)
composer.addPass(bloomPass)



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
const cameraIntroEnd = new THREE.Vector3(1.9, 2.1, 0)
const cameraIntroDuration = 4000
let cameraIntroStartTime = null
let cameraIntroDone = false

camera.position.copy(cameraIntroStart)
camera.lookAt(0,1.4,0)
controls.target.set (0,1.4,0)
controls.enabled = false

const startTime = performance.now()



const screenCanvas = document.createElement('canvas')
screenCanvas.width=1024
screenCanvas.height=1024
const ctx = screenCanvas.getContext('2d')

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
    url: 'https://github.com/your-username/project-three',
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
    url: 'mailto:filip_2002_mihajlov@hotmail.com',
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
    if (!cycleLockedSections.includes(state.currentSection)) {
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

  hasTriggeredMove = true
})

const FONT = '"Geist Pixel", sans-serif'

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

loadingOverlayEl.innerHTML = `
  <div id="bootLog" style="width:560px; height:260px; overflow:hidden; color:#a8c8ff; font-size:13px; line-height:1.7;"></div>
  <div style="width:560px; height:8px; background:#0d1b2e; border:1px solid #1c3a63; margin-top:14px;">
    <div id="bootBarFill" style="width:0%; height:100%; background:#4fa3ff;"></div>
  </div>
  <div id="bootPercentText" style="width:560px; margin-top:6px; color:#5b7bb8; font-size:12px;">0%</div>
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
`
document.head.appendChild(enterOverlayStyleEl)

const enterOverlayEl = document.createElement('div')
enterOverlayEl.style.position = 'fixed'
enterOverlayEl.style.inset = '0'
enterOverlayEl.style.backgroundColor = '#0a0520'
enterOverlayEl.style.zIndex = '9998'
enterOverlayEl.style.display = 'none'
enterOverlayEl.style.flexDirection = 'row'
enterOverlayEl.style.fontFamily = FONT
enterOverlayEl.style.cursor = 'pointer'
enterOverlayEl.style.transition = 'opacity 0.5s ease'

enterOverlayEl.innerHTML = `
  <div style="flex:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:16px;">
    <div style="font-size:clamp(32px,5vw,64px); color:#f0abfc; font-weight:700; line-height:1.2;">FILIP<br/>MIHAJLOV</div>
    <div style="font-size:clamp(13px,1.4vw,18px); color:#818cf8; letter-spacing:3px;">ARCADE PORTFOLIO</div>
    <div style="margin-top:30px; font-size:clamp(15px,1.6vw,20px); color:#f59e0b; letter-spacing:1px; animation:enterPromptBlink 1.2s infinite;">
      &gt; CLICK TO ENTER &lt;
    </div>
  </div>
  <div style="flex:1; border-left:2px solid #4c2a8f; display:flex; flex-direction:column; justify-content:flex-start; align-items:center; gap:22px; padding:14% 6% 0;">
    <div style="width:100%; font-size:clamp(13px,1.4vw,17px); color:#818cf8; letter-spacing:2px; border-bottom:1px solid #4c2a8f; padding-bottom:16px;">CONTROLS</div>
    <div style="width:100%; display:flex; flex-direction:column; gap:14px; font-size:clamp(14px,1.6vw,20px); color:#a8c8ff;">
      <div style="display:flex; justify-content:space-between;"><span>START</span><span style="color:#f0abfc;">[Z]</span></div>
      <div style="display:flex; justify-content:space-between;"><span>HOME</span><span style="color:#f0abfc;">[X]</span></div>
      <div style="display:flex; justify-content:space-between;"><span>BUILT WITH</span><span style="color:#f0abfc;">[A]</span></div>
      <div style="display:flex; justify-content:space-between;"><span>CONTACT</span><span style="color:#f0abfc;">[S]</span></div>
    </div>
    <div style="position:relative; width:260px; height:300px; margin-top:auto; margin-bottom:auto;">
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

function updateControlsGuide() {
  const confirmLabels = {
    attract: 'START',
    projects: 'OPEN LINK',
    skills: '--',
    about: '--',
    contact: 'OPEN LINK',
  }

  const rows = [
    { key: 'Z', action: confirmLabels[state.currentSection] || '--' },
    { key: 'X', action: 'HOME' },
    { key: 'A', action: 'BUILT WITH' },
    { key: 'S', action: 'CONTACT' },
  ]

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
  ctx.fillRect(0, 0, 1024, 1024)

  ctx.strokeStyle = '#7c3aed'
  ctx.lineWidth = 8
  ctx.strokeRect(24, 24, 976, 976)

  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 45px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Filip Mihajlov', 512, 240)

  ctx.fillStyle = '#818cf8'
  ctx.font = `26px ${FONT}`
  ctx.fillText('SOFTWARE DEVELOPER', 512, 310)

  //divider
  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, 350)
  ctx.lineTo(904, 350)
  ctx.stroke()

  //blinking press start
  if (Math.floor(Date.now() / 700) % 2 === 0) {
    ctx.fillStyle = '#f0abfc'
    ctx.font = `55px ${FONT}`
    ctx.fillText('PRESS START', 512, 490)
  }

  //insert coin
  ctx.fillStyle = '#4c3880'
  ctx.font = ' bold 33px Arial'
  ctx.fillText('INSERT COIN TO CONTINUE', 512, 900)

  const dotColors = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b']
  dotColors.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(340 + i * 80, 750, 24, 24)
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
  ctx.fillRect(0, 0, 1024, 1024)

  ctx.strokeStyle = '#f43f5e'
  ctx.lineWidth = 8
  ctx.strokeRect(24, 24, 976, 976)

  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 45px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('BUILT WITH', 512, 130)

  ctx.fillStyle = '#818cf8'
  ctx.font = `20px ${FONT}`
  ctx.fillText('HOW THIS WORKS', 512, 170)

  //divider
  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, 195)
  ctx.lineTo(904, 195)
  ctx.stroke()

  ctx.fillStyle = '#f43f5e'
  ctx.font = `bold 22px ${FONT}`

  const stackLines = wrapText(builtWith.stack.join('   ·   '), 780)
  const stackLineHeight = 32

  stackLines.forEach((line, i) => {
    ctx.fillText(line, 512, 260 + i * stackLineHeight)
  })

  ctx.fillStyle = '#d4c8f0'
  ctx.font = `23px ${FONT}`

  const factStartY = 420
  const factGap = 130
  const factLineHeight = 26

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
  ctx.fillRect(0, 0, 1024, 1024)

  ctx.strokeStyle = '#ec4899'
  ctx.lineWidth = 8
  ctx.strokeRect(24, 24, 976, 976)

  const current = state.highlightIndex
  const total = projects.length
  const project = projects[current]

  ctx.fillStyle = '#4c3880'
  ctx.font = `20px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(`< PROJECT ${current + 1} / ${total} >`, 512, 100)

  ctx.strokeStyle = '#ec4899'
  ctx.lineWidth = 4
  ctx.strokeRect(140, 160, 744, 700)

  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 44px ${FONT}`
  ctx.fillText(project.name, 512, 340)

  ctx.fillStyle = '#818cf8'
  ctx.font = `24px ${FONT}`
  ctx.fillText(project.tech, 512, 400)

  ctx.fillStyle = '#d4c8f0'
  ctx.font = `23px ${FONT}`

  const descLines = wrapText(project.description, 620)
  const descLineHeight = 28

  descLines.forEach((line, i) => {
    ctx.fillText(line, 512, 500 + i * descLineHeight)
  })

  const dotSpacing = 30
  const dotsStartX = 512 - ((total - 1) * dotSpacing) / 2

  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i === current ? '#ec4899' : '#4c3880'
    ctx.beginPath()
    ctx.arc(dotsStartX + i * dotSpacing, 820, 8, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawSkillsScreen(){
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0,0,1024,1024)

  ctx.strokeStyle = '#10b981'
  ctx.lineWidth = 8
  ctx.strokeRect(24,24,976,976)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e67fdb'
  ctx.font = `bold 45px ${FONT}`
  ctx.fillText('SKILLS', 512,110)

  ctx.fillStyle = '#818cf8'
  ctx.font = `25px ${FONT}`
  ctx.fillText('SYSTEMS & LANGUAGES', 512,155)

  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120,175)
  ctx.lineTo(904,175)
  ctx.stroke()

  const rowHeight = 120
  const startY = 240
  const visibleRows = 6

  let scrollOffset = state.highlightIndex - Math.floor(visibleRows / 2)
  scrollOffset = Math.max(0, Math.min(scrollOffset, skills.length - visibleRows))
  if (skills.length <= visibleRows) scrollOffset = 0

  const visibleSkills = skills.slice(scrollOffset, scrollOffset + visibleRows)

  visibleSkills.forEach((skill,i) => {
    const rowY = startY + i * rowHeight
    const skillIndex = scrollOffset + i

    if (skillIndex === state.highlightIndex && Math.floor(Date.now() / 700) % 2 === 0) {
      ctx.strokeStyle = skill.color
      ctx.lineWidth = 3
      ctx.strokeRect(80, rowY - 34, 840, 66)
    }

    ctx.textAlign = 'left'
    ctx.fillStyle = skill.color
    ctx.font = `bold 26px ${FONT}`
    ctx.fillText(skill.name, 100 ,rowY)

    const pipSize= 8
    const pipGap = 5

    for(let p = 0;p<skill.max;p++){
      ctx.fillStyle = p < skill.level ? skill.color : '#2a1f45'
      ctx.fillRect(100 + p * (pipSize + pipGap),rowY + 16,pipSize,pipSize)
    }

    const barX=420
    const barWidth = 400
    const barHeight = 24
    const barY = rowY-20

    ctx.strokeStyle = '#4c3880'
    ctx.lineWidth = 2
     ctx.strokeRect(barX, barY, barWidth, barHeight)

    const fillWidth = (skill.level / skill.max) * barWidth
    ctx.fillStyle = skill.color
    ctx.fillRect(barX, barY, fillWidth, barHeight)

    ctx.textAlign = 'right'
    ctx.fillStyle = '#d4c8f0'
    ctx.font = `18px ${FONT}`
    ctx.fillText(`LV${skill.level}`, 900, rowY)
  })
}

function drawAboutScreen(){
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0,0,1024,1024)

  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 8
  ctx.strokeRect(24,24,976,976)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 45px ${FONT}`
  ctx.fillText('ABOUT', 512,130)

  ctx.fillStyle = '#818cf8'
  ctx.font = `20px ${FONT}`
  ctx.fillText('PLAYER CARD', 512,170)

  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120,195)
  ctx.lineTo(904,195)
  ctx.stroke()

  const portraitX = 100
  const portraitY = 220
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
  ctx.fillText(about.name, portraitX + portraitSize + 40, portraitY + 90)

  ctx.fillStyle = '#3b82f6'
  ctx.font = `20px ${FONT}`
  ctx.fillText(about.className, portraitX + portraitSize + 40, portraitY + 130)

  const col1X = 100
  const col2X = 560
  const rowGap = 110

  const fields = [
    [{ label: 'SEEKING', value: about.seeking }, { label: 'LEVEL', value: about.level }],
    [{ label: 'LOCATED', value: about.located }, null],
    [{ label: 'SPEC', value: about.spec }, null],
  ]

  fields.forEach((row, rowIndex) => {
    const rowY = 560 + rowIndex * rowGap

    row.forEach((field, colIndex) => {
      if (!field) return
      const x = colIndex === 0 ? col1X : col2X

      ctx.fillStyle = '#4c3880'
      ctx.font = `23px ${FONT}`
      ctx.fillText(field.label, x, rowY)

      ctx.fillStyle = '#d4c8f0'
      ctx.font = `bold 28px ${FONT}`
      ctx.fillText(field.value, x, rowY + 34)
    })
  })
}

function drawContactScreen(){
  ctx.fillStyle = '#0a0520'
  ctx.fillRect(0,0,1024,1024)

  ctx.strokeStyle = '#ec4899'
  ctx.lineWidth = 8
  ctx.strokeRect(24,24,976,976)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0abfc'
  ctx.font = `bold 45px ${FONT}`
  ctx.fillText('CONTACT', 512,130)

  ctx.fillStyle = '#818cf8'
  ctx.font = `20px ${FONT}`
  ctx.fillText('GET IN TOUCH', 512,170)

  ctx.strokeStyle = '#4c3880'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120,195)
  ctx.lineTo(904,195)
  ctx.stroke()

  const startY = 350
  const lineGap = 110

  contact.forEach((line, i) => {
    const y = startY + i * lineGap

    if (i === state.highlightIndex && Math.floor(Date.now() / 700) % 2 === 0) {
      const paddingX = 40
      const paddingY = 24

      ctx.font = `bold 30px ${FONT}`
      const textWidth = ctx.measureText(line.value).width
      const boxWidth = textWidth + paddingX * 2
      const boxHeight = 34 + paddingY * 2
      const boxX = 512 - boxWidth / 2
      const boxY = y - paddingY

      ctx.strokeStyle = '#ec4899'
      ctx.lineWidth = 1
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)
    }

    ctx.fillStyle = '#4c3880'
    ctx.font = `20px ${FONT}`
    ctx.fillText(line.label, 512, y)

    ctx.fillStyle = '#ec4899'
    ctx.font = `bold 30px ${FONT}`
    ctx.fillText(line.value, 512, y + 34)
  })
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
}

const screenTexture = new THREE.CanvasTexture(screenCanvas)
screenTexture.flipY = false

const gameOverVideo = document.createElement('video')
gameOverVideo.src = '/videos/Game_Over.mp4'
gameOverVideo.playsInline = true
gameOverVideo.preload = 'auto'
const GAME_OVER_VOLUME = 0.25

const videoCanvas = document.createElement('canvas')
videoCanvas.width = 1024
videoCanvas.height = 1024
const videoCtx = videoCanvas.getContext('2d')
const videoScreenTexture = new THREE.CanvasTexture(videoCanvas)
videoScreenTexture.flipY = false

let gameOverActive = false

function drawGameOverFrame() {
  videoCtx.fillStyle = '#0a0520'
  videoCtx.fillRect(0, 0, 1024, 1024)

  const inset = 8
  const size = 1024 - inset * 2
  const GAME_OVER_BRIGHTNESS = 0.55
  if (gameOverVideo.videoWidth > 0) {
    const vw = gameOverVideo.videoWidth
    const vh = gameOverVideo.videoHeight
    const scale = Math.min(size / vw, size / vh)
    const drawW = vw * scale
    const drawH = vh * scale
    const dx = inset + (size - drawW) / 2
    const dy = inset + (size - drawH) / 2

    videoCtx.save()
    videoCtx.beginPath()
    videoCtx.rect(inset, inset, size, size)
    videoCtx.clip()
    videoCtx.filter = `brightness(${GAME_OVER_BRIGHTNESS})`
    videoCtx.drawImage(gameOverVideo, dx, dy, drawW, drawH)
    videoCtx.filter = 'none'
    videoCtx.restore()
  }

  videoCtx.strokeStyle = '#f43f5e'
  videoCtx.lineWidth = 6
  videoCtx.strokeRect(inset, inset, size, size)

  videoScreenTexture.needsUpdate = true
}

function playGameOverClip() {
  if (!screenMesh) return
  gameOverActive = true
  screenMesh.material.map = videoScreenTexture
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
  screenMesh.material.map = screenTexture
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
          child.material = new THREE.MeshBasicMaterial({
            map: screenTexture
          })
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
    const percent = (progress.loaded / progress.total) * 100
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
      playGameOverClip()
    }
  }

  if (cameraIntroDone) {
    controls.update()
  }

  if (gameOverActive) {
    drawGameOverFrame()
  } else if (!cameraIntroDone) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 1024, 1024)
    screenTexture.needsUpdate = true
  } else {
    drawScreen(state.currentSection)
    screenTexture.needsUpdate = true
  }
  updateControlsGuide()

  composer.render()
}

animate()

window.addEventListener('resize', () =>{
  camera.aspect= window.innerWidth/ window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})

