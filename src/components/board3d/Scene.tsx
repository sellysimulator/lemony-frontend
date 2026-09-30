import { Suspense, useMemo, useRef, type ReactElement, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayback } from '../../store/playback'
import { actorsAt, dayFraction, type ActorState } from '../../game/timeline'
import type { BoardProps } from '../day/types'
import type { PersonType, Weather } from '../../types/game'
import { CircleCheck, CircleX, Citrus, TriangleAlert } from 'lucide-react'
import { REASON_TEXT } from '../../utils/format'
import { cloneModel, MODEL_URL, preloadModels, useModel } from './models'
import { actorPlacement, atmosphere, STREET_HALF, STREET_Z } from './sceneModel'

// Start fetching every model as soon as the 3D chunk loads, so a customer
// type's first appearance does not wait on the network.
preloadModels()

/** Per-model yaw so every character faces +z at rotation 0. */
const MODEL_YAW: Record<PersonType, number> = { Child: 0, Teenager: 0, Adult: 0, Senior: 0 }

function Stand(props: { price: number }): ReactElement {
  const stand = useModel('stand')
  const obj = useMemo(() => cloneModel(stand), [stand])
  return (
    <group>
      <primitive object={obj} />
      <Html position={[0, 3.1, 0]} center distanceFactor={12} zIndexRange={[5, 0]}>
        <div className="rounded-md border-2 border-yellow-600 bg-yellow-200 px-2 py-0.5 text-sm font-extrabold whitespace-nowrap text-yellow-900 shadow">
          <span className="flex items-center gap-1">
            <Citrus aria-hidden className="size-4" strokeWidth={2.5} /> ${props.price.toFixed(2)}
          </span>
        </div>
      </Html>
    </group>
  )
}

function Customer(props: { actor: ActorState }): ReactElement {
  const { actor } = props
  const model = useModel(actor.type)
  const lemonade = useModel('lemonade')
  const body = useMemo(() => cloneModel(model), [model])
  const cup = useMemo(() => cloneModel(lemonade), [lemonade])
  const p = actorPlacement(actor)
  const bubble =
    actor.phase === 'stand'
      ? actor.outcome === 'bought'
        ? { text: 'Yum!', Icon: CircleCheck, cls: 'border-green-600 text-green-700' }
        : actor.outcome === 'sold_out'
          ? { text: 'Sold out!', Icon: TriangleAlert, cls: 'border-orange-600 text-orange-700' }
          : { text: REASON_TEXT[actor.reason ?? ''] ?? 'No thanks', Icon: CircleX, cls: 'border-red-600 text-red-700' }
      : null
  return (
    <group position={[p.x, p.bob, p.z]} rotation={[0, p.rotY + MODEL_YAW[actor.type], 0]}>
      <primitive object={body} />
      {actor.carrying ? <primitive object={cup} position={[0.3, 0.55, 0.15]} /> : null}
      {bubble ? (
        <Html position={[0, 2.1, 0]} center distanceFactor={10} zIndexRange={[4, 0]}>
          <div className={`flex items-center gap-1 rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold whitespace-nowrap shadow ${bubble.cls}`}>
            <bubble.Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
            {bubble.text}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

/**
 * Suspends until EVERY model is loaded, so the scene appears once, complete.
 * Without this, a customer type's first appearance suspended the shared
 * boundary and blanked the whole street for a moment.
 */
function AllModels(props: { children: ReactNode }): ReactElement {
  useGLTF(Object.values(MODEL_URL))
  return <>{props.children}</>
}

function Loading(): ReactElement {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold whitespace-nowrap text-stone-700 shadow">
        Loading the street… {Math.round(progress)}%
      </div>
    </Html>
  )
}

function Crowd(props: { events: BoardProps['events'] }): ReactElement {
  const clock = usePlayback((s) => s.clock)
  const actors = actorsAt(props.events, clock)
  return (
    <>
      {actors.map((a) => (
        <Customer key={a.id} actor={a} />
      ))}
    </>
  )
}

/** Deterministic PRNG (mulberry32) so render stays pure. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Precipitation(props: { weather: Weather }): ReactElement | null {
  const count = props.weather === 'snowy' ? 700 : 900
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const rand = seeded(count)
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rand() - 0.5) * 40
      arr[i * 3 + 1] = rand() * 14
      arr[i * 3 + 2] = (rand() - 0.5) * 30
    }
    return arr
  }, [count])
  const speed = props.weather === 'snowy' ? 1.2 : 9
  useFrame((_, dt) => {
    const pts = ref.current
    if (!pts) return
    const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) - speed * dt
      if (y < 0) y += 14
      attr.setY(i, y)
    }
    attr.needsUpdate = true
  })
  if (props.weather !== 'rainy' && props.weather !== 'snowy') return null
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={props.weather === 'snowy' ? '#ffffff' : '#bcd4f0'} size={props.weather === 'snowy' ? 0.12 : 0.06} transparent opacity={0.85} />
    </points>
  )
}

function Lighting(props: { weather: Weather }): ReactElement {
  const clock = usePlayback((s) => s.clock)
  const atm = atmosphere(props.weather, dayFraction(clock))
  return (
    <>
      <color attach="background" args={[atm.sky]} />
      <fog attach="fog" args={[atm.sky, 30, 70]} />
      <hemisphereLight args={['#ffffff', '#4d7c0f', atm.ambient]} />
      <directionalLight position={atm.sunPosition} intensity={atm.sunIntensity} />
    </>
  )
}

function Ground(): ReactElement {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#84cc16" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, STREET_Z + 0.7]}>
        <planeGeometry args={[STREET_HALF * 2 + 20, 3.2]} />
        <meshStandardMaterial color="#a8a29e" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 3.8]}>
        <planeGeometry args={[3.5, 3.4]} />
        <meshStandardMaterial color="#d6d3d1" />
      </mesh>
    </group>
  )
}

export default function Scene(props: BoardProps): ReactElement {
  return (
    <Canvas camera={{ position: [0, 4.5, 12], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
      <Lighting weather={props.weather} />
      <Ground />
      <Suspense fallback={<Loading />}>
        <AllModels>
          <Stand price={props.price} />
          <Crowd events={props.events} />
        </AllModels>
      </Suspense>
      <Precipitation weather={props.weather} />
      <OrbitControls target={[0, 1, 3]} enablePan={false} maxPolarAngle={1.45} minDistance={6} maxDistance={32} />
    </Canvas>
  )
}
