import * as THREE from 'three'
import { ROAD_WIDTH, seeded, SIDEWALK_WIDTH } from './sceneModel'

/** One texture tile covers this many metres of street; it repeats along x. */
export const ROAD_TILE_LENGTH = 6.4
const PX_PER_M = 80

/**
 * Drawn once on a canvas: concrete sidewalks with slab joints and a curb on
 * each side, speckled asphalt with worn patches, white edge lines and a dashed
 * yellow centre line (two 2 m dashes per tile, so the pattern repeats cleanly).
 */
export function createRoadTexture(): THREE.CanvasTexture {
  const w = ROAD_TILE_LENGTH * PX_PER_M
  const walk = SIDEWALK_WIDTH * PX_PER_M
  const road = ROAD_WIDTH * PX_PER_M
  const h = road + walk * 2
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const rand = seeded(7)

  // Sidewalks: concrete slabs, 1 m joints.
  ctx.fillStyle = '#d6d0c8'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#b4ada4'
  for (let x = 0; x < w; x += PX_PER_M) {
    ctx.fillRect(x, 0, 2, walk)
    ctx.fillRect(x, h - walk, 2, walk)
  }

  // Asphalt with speckle and a few worn patches.
  ctx.fillStyle = '#4a4845'
  ctx.fillRect(0, walk, w, road)
  for (let i = 0; i < 9000; i++) {
    const shade = 50 + Math.floor(rand() * 60)
    ctx.fillStyle = `rgb(${shade},${shade - 2},${shade - 4})`
    ctx.fillRect(rand() * w, walk + rand() * road, 1 + rand() * 2, 1 + rand() * 2)
  }
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(20,20,20,0.18)' : 'rgba(110,108,104,0.18)'
    ctx.beginPath()
    ctx.ellipse(rand() * w, walk + road * (0.15 + rand() * 0.7), 20 + rand() * 40, 8 + rand() * 18, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // Curbs where the asphalt meets the sidewalk.
  ctx.fillStyle = '#9c948a'
  ctx.fillRect(0, walk - 10, w, 10)
  ctx.fillRect(0, h - walk, w, 10)

  // White edge lines 0.25 m in from the curb, dashed yellow centre line.
  ctx.fillStyle = '#f5f5f4'
  ctx.fillRect(0, walk + 20, w, 8)
  ctx.fillRect(0, h - walk - 28, w, 8)
  ctx.fillStyle = '#facc15'
  const dash = 2 * PX_PER_M
  for (let x = 0; x < w; x += w / 2) ctx.fillRect(x, h / 2 - 5, dash, 10)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}
