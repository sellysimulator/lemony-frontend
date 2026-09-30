import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { PersonType } from '../../types/game'

/**
 * The GLB assets (CC-BY-4.0, credited on /credits). None has animation clips,
 * so walking is a procedural bob. `child.glb` is skinned, so copies are made
 * with SkeletonUtils.clone — `Object3D.clone()` would share one skeleton.
 */
export const MODEL_URL = {
  stand: '/3dmodels/stand.glb',
  lemonade: '/3dmodels/lemonade.glb',
  Child: '/3dmodels/child.glb',
  Teenager: '/3dmodels/teenager.glb',
  Adult: '/3dmodels/adult.glb',
  Senior: '/3dmodels/senior.glb',
} as const

/** World heights in metres. */
export const TARGET_HEIGHT: Record<PersonType | 'stand' | 'lemonade', number> = {
  Child: 1.1,
  Teenager: 1.55,
  Adult: 1.8,
  Senior: 1.6,
  stand: 2.6,
  lemonade: 0.25,
}

/**
 * Scale a loaded scene to `height`, stand it on y = 0 and centre it on x/z.
 * Sketchfab exports arrive in arbitrary units and offsets; this is done once
 * per model and every instance clones the normalised result.
 */
export function normalize(scene: THREE.Object3D, height: number): THREE.Group {
  const inner = skeletonClone(scene)
  inner.updateMatrixWorld(true)
  // Drop baked ground planes (adult.glb ships a 3 m black `floor` disc): a
  // mesh with no height would render as a shadow blot and wreck the bounds.
  const flat: THREE.Object3D[] = []
  inner.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y < 1e-3) flat.push(o)
  })
  for (const o of flat) o.removeFromParent()
  inner.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(inner)
  const size = box.getSize(new THREE.Vector3())
  const scale = size.y > 0 ? height / size.y : 1
  inner.scale.multiplyScalar(scale)
  inner.updateMatrixWorld(true)
  const scaled = new THREE.Box3().setFromObject(inner)
  const center = scaled.getCenter(new THREE.Vector3())
  inner.position.set(-center.x, -scaled.min.y, -center.z)
  const group = new THREE.Group()
  group.add(inner)
  return group
}

export function useModel(key: keyof typeof MODEL_URL): THREE.Group {
  const { scene } = useGLTF(MODEL_URL[key])
  return useMemo(() => normalize(scene, TARGET_HEIGHT[key]), [scene, key])
}

export function cloneModel(model: THREE.Object3D): THREE.Object3D {
  return skeletonClone(model)
}

export function preloadModels(): void {
  for (const url of Object.values(MODEL_URL)) useGLTF.preload(url)
}
