import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

const AKIRA = {
  bg: '#1f1f39',
  red: '#ff6e6e',
  green: '#6be28d',
  yellow: '#fbdda7',
  blue: '#b3e3f2',
  brown: '#c49a6c',
}

const GREEN_RGB = [0x6b/255, 0xe2/255, 0x8d/255]
const YELLOW_RGB = [0xfb/255, 0xdd/255, 0xa7/255]

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function withSeed(seed, fn) {
  const orig = Math.random
  Math.random = mulberry32(seed)
  try { return fn() } finally { Math.random = orig }
}

// Scratch matrices for transform functions
const _m4_a = new THREE.Matrix4()
const _m4_b = new THREE.Matrix4()
const _m4_c = new THREE.Matrix4()
const _m4_d = new THREE.Matrix4()

function generateCylinder(diameter, height, segments) {
  const radius = diameter / 2
  const halfH = height / 2
  const vertices = []
  const edges = []

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    vertices.push([x, halfH, z])
  }
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    vertices.push([x, -halfH, z])
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    edges.push([i, next])
    edges.push([segments + i, segments + next])
    edges.push([i, segments + i])
  }

  return { vertices, edges }
}

// 3D leaf mode (disabled): pass a `curve` param and set `is3D = true` to get
// 3 layers (flat + two curved copies bent in opposite Z via sin(PI*t)*curve)
// with connecting lines between vein tips across layers.
function generateLeaf(size, width, numVeins) {
  const positions = []
  const numPoints = 8

  function leafWidth(t) {
    return Math.sin(Math.PI * Math.pow(t, 0.8)) * width
  }

  // Outline - right side then left side
  for (let i = 0; i < numPoints; i++) {
    const t1 = i / numPoints
    const t2 = (i + 1) / numPoints
    const y1 = t1 * size, y2 = t2 * size
    const w1 = leafWidth(t1), w2 = leafWidth(t2)
    positions.push(w1, y1, 0, w2, y2, 0)
    positions.push(-w1, y1, 0, -w2, y2, 0)
  }

  // Midrib - base to tip
  for (let i = 0; i < numPoints; i++) {
    const y1 = (i / numPoints) * size
    const y2 = ((i + 1) / numPoints) * size
    positions.push(0, y1, 0, 0, y2, 0)
  }

  // Lateral veins - diagonal from midrib to outline
  for (let i = 1; i <= numVeins; i++) {
    const baseT = i / (numVeins + 1)
    const baseY = baseT * size
    const tipT = baseT + 0.12
    const tipY = tipT * size
    const w = leafWidth(tipT)
    positions.push(0, baseY, 0, w, tipY, 0)
    positions.push(0, baseY, 0, -w, tipY, 0)
  }

  return positions
}

function useHold(callback, interval = 80) {
  const timer = useRef(null)
  const start = useCallback(() => {
    callback()
    timer.current = setInterval(callback, interval)
  }, [callback, interval])
  const stop = useCallback(() => {
    clearInterval(timer.current)
    timer.current = null
  }, [])
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop }
}

function HoldButton({ onAction, children }) {
  const hold = useHold(onAction)
  return <button {...hold}>{children}</button>
}

function RangeControl({ label, rangeKey, ranges, setRanges, locked, setLocked, step, hardMin, hardMax, format, currentValue }) {
  const [min, max] = ranges[rangeKey]
  const isLocked = locked[rangeKey] || false
  const fmt = format || (v => v)
  const update = (idx, delta) => {
    if (isLocked) return
    setRanges(r => {
      const pair = [...r[rangeKey]]
      pair[idx] = +(pair[idx] + delta).toFixed(10)
      if (hardMin != null) pair[idx] = Math.max(hardMin, pair[idx])
      if (hardMax != null) pair[idx] = Math.min(hardMax, pair[idx])
      if (pair[0] > pair[1]) { if (idx === 0) pair[1] = pair[0]; else pair[0] = pair[1] }
      return { ...r, [rangeKey]: pair }
    })
  }
  const cvDisplay = currentValue != null ? ` (${fmt(currentValue)})` : ''
  return (
    <div className="control">
      <span className="control-label">{label}: {fmt(min)} — {fmt(max)}{cvDisplay}</span>
      <div className="control-buttons">
        <HoldButton onAction={() => update(0, -step)}>−</HoldButton>
        <HoldButton onAction={() => update(0, step)}>+</HoldButton>
        <span className="range-sep" />
        <HoldButton onAction={() => update(1, -step)}>−</HoldButton>
        <HoldButton onAction={() => update(1, step)}>+</HoldButton>
        <button className={`lock-btn${isLocked ? ' locked' : ''}`} onClick={() => setLocked(l => ({ ...l, [rangeKey]: !l[rangeKey] }))}>
          {isLocked ? '\u{1F512}' : '\u{1F513}'}
        </button>
      </div>
    </div>
  )
}

function computeOrbitRadius(height, fov) {
  return (height / 2) / Math.tan(fov * Math.PI / 360) * 1.2
}

function CameraController({ controlsRef, flying, setFlying, orbiting, orbitAngleRef, orbitSpeed, orbitRadius, orbitElevation, speed = 50 }) {
  const keys = useRef({})
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const locked = useRef(false)
  const moveVec = useRef(new THREE.Vector3())
  const { camera, gl } = useThree()

  useEffect(() => {
    const down = (e) => { keys.current[e.code] = true }
    const up = (e) => { keys.current[e.code] = false }

    const onMouseMove = (e) => {
      if (!locked.current) return
      euler.current.setFromQuaternion(camera.quaternion)
      euler.current.y -= e.movementX * 0.002
      euler.current.x -= e.movementY * 0.002
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x))
      camera.quaternion.setFromEuler(euler.current)
    }

    const onLockChange = () => {
      locked.current = document.pointerLockElement === gl.domElement
      setFlying(locked.current)
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLockChange)

    controlsRef.current = {
      lock: () => gl.domElement.requestPointerLock(),
    }

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [camera, gl, controlsRef, setFlying])

  useFrame((_, delta) => {
    if (flying) {
      const k = keys.current
      const move = moveVec.current.set(0, 0, 0)
      if (k['KeyW']) move.z -= 1
      if (k['KeyS']) move.z += 1
      if (k['KeyA']) move.x -= 1
      if (k['KeyD']) move.x += 1
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * delta)
        camera.translateX(move.x)
        camera.translateZ(move.z)
      }
    } else if (orbiting) {
      orbitAngleRef.current += orbitSpeed * delta
      const hRadius = orbitRadius * Math.cos(orbitElevation)
      camera.position.set(
        hRadius * Math.cos(orbitAngleRef.current),
        orbitRadius * Math.sin(orbitElevation),
        hRadius * Math.sin(orbitAngleRef.current)
      )
      camera.lookAt(0, 0, 0)
    }

    const dist = camera.position.length()
    camera.far = Math.max(2000, dist * 10)
    camera.updateProjectionMatrix()
  })

  return null
}

function trunkSurfaceRadius(circumRadius, segments, angle) {
  const sectorAngle = (2 * Math.PI) / segments
  const localAngle = ((angle % sectorAngle) + sectorAngle) % sectorAngle
  const fromMid = localAngle - sectorAngle / 2
  const apothem = circumRadius * Math.cos(Math.PI / segments)
  return apothem / Math.cos(fromMid)
}

function getFace(rotation, segments) {
  const sector = (2 * Math.PI) / segments
  return Math.floor((((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / sector)
}

function chooseFace(branches, segments) {
  const counts = Array(segments).fill(0)
  for (const b of branches) counts[getFace(b.rotation, segments)]++
  const minCount = Math.min(...counts)
  const candidates = counts.reduce((acc, c, i) => c === minCount ? [...acc, i] : acc, [])
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function chooseY(branches, face, segments, height, boundsMinY, boundsMaxY) {
  const sameFace = branches.filter(b => getFace(b.rotation, segments) === face)
  const ys = sameFace.map(b => b.y)
  const minY = boundsMinY !== undefined ? boundsMinY : -0.1 * height
  const maxY = boundsMaxY !== undefined ? boundsMaxY : height / 2

  if (ys.length === 0) return minY + Math.random() * (maxY - minY)

  const sorted = [minY, ...ys.slice().sort((a, b) => a - b), maxY]
  let bestMid = (minY + maxY) / 2
  let bestGap = 0
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1] - sorted[i]
    if (gap > bestGap) {
      bestGap = gap
      bestMid = (sorted[i] + sorted[i + 1]) / 2
    }
  }
  const jitter = (Math.random() - 0.5) * bestGap * 0.2
  return Math.max(minY, Math.min(maxY, bestMid + jitter))
}

function chooseRotationInFace(face, segments) {
  const sector = (2 * Math.PI) / segments
  const buffer = sector * 0.15
  return face * sector + buffer + Math.random() * (sector - 2 * buffer)
}

function chooseSubbranchRotation(existingSubs) {
  if (existingSubs.length === 0) return Math.random() * Math.PI * 2

  const sorted = existingSubs.map(s => ((s.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b)
  let bestMid = 0
  let bestGap = 0
  for (let i = 0; i < sorted.length; i++) {
    const next = i < sorted.length - 1 ? sorted[i + 1] : sorted[0] + 2 * Math.PI
    const gap = next - sorted[i]
    if (gap > bestGap) {
      bestGap = gap
      bestMid = sorted[i] + gap / 2
    }
  }
  const jitter = (Math.random() - 0.5) * bestGap * 0.3
  return ((bestMid + jitter) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
}

function segmentSegmentDist(p0x,p0y,p0z, p1x,p1y,p1z, q0x,q0y,q0z, q1x,q1y,q1z) {
  const dx = p1x-p0x, dy = p1y-p0y, dz = p1z-p0z
  const ex = q1x-q0x, ey = q1y-q0y, ez = q1z-q0z
  const rx = p0x-q0x, ry = p0y-q0y, rz = p0z-q0z
  const a = dx*dx + dy*dy + dz*dz
  const b = dx*ex + dy*ey + dz*ez
  const c = ex*ex + ey*ey + ez*ez
  const f = dx*rx + dy*ry + dz*rz
  const g = ex*rx + ey*ry + ez*rz
  const denom = a * c - b * b
  let s, t
  if (denom < 1e-8) {
    s = 0
    t = c > 1e-8 ? g / c : 0
  } else {
    s = (b * g - c * f) / denom
    t = (a * g - b * f) / denom
  }
  s = Math.max(0, Math.min(1, s))
  t = c > 1e-8 ? (b * s + g) / c : 0
  if (t < 0) {
    t = 0
    s = a > 1e-8 ? Math.max(0, Math.min(1, -f / a)) : 0
  } else if (t > 1) {
    t = 1
    s = a > 1e-8 ? Math.max(0, Math.min(1, (b - f) / a)) : 0
  }
  const c1x = p0x + dx*s, c1y = p0y + dy*s, c1z = p0z + dz*s
  const c2x = q0x + ex*t, c2y = q0y + ey*t, c2z = q0z + ez*t
  const wx = c1x-c2x, wy = c1y-c2y, wz = c1z-c2z
  return Math.sqrt(wx*wx + wy*wy + wz*wz)
}

const MAX_POSITIONS = 600_000
const MAX_LEAVES = 4_000

function buildTreePositions(treeState, params) {
  const { branches, subTrunks } = treeState
  const { diameter, height, segments, splitFraction, leafLength, leafWidth, leafVeins } = params
  const trunkRadius = diameter / 2
  const trunkSegments = segments
  const splitY = -height / 2 + splitFraction * height
  const mainTrunkHeight = splitFraction * height
  const subTrunkLength = (1 - splitFraction) * height

  const positions = []
  const leafPositions = []
  const leafRanges = []
  let leafCapHit = false
  let leafCount = 0
  const v = new THREE.Vector3()
  const _tm = new THREE.Matrix4()
  const baseLeaf = generateLeaf(leafLength, leafWidth, leafVeins)
  // Scratch matrices to avoid per-branch/per-leaf .clone() allocations
  const _branchM = new THREE.Matrix4()
  const _clusterM = new THREE.Matrix4()
  const _leafM = new THREE.Matrix4()
  const _subBaseM = new THREE.Matrix4()
  const _subCenterM = new THREE.Matrix4()
  const _stCenterM = new THREE.Matrix4()

  const v2 = new THREE.Vector3()
  const trunkRadiusSq = trunkRadius * trunkRadius
  const insideTrunk = (p) => p.y <= splitY && (p.x * p.x + p.z * p.z) <= trunkRadiusSq

  const addCylinder = (diam, h, segs, matrix, cull) => {
    const { vertices, edges } = generateCylinder(diam, h, segs)
    for (const [i, j] of edges) {
      v.set(...vertices[i]).applyMatrix4(matrix)
      v2.set(...vertices[j]).applyMatrix4(matrix)
      if (cull && cull(v) && cull(v2)) continue
      positions.push(v.x, v.y, v.z)
      positions.push(v2.x, v2.y, v2.z)
    }
  }

  const addLeafShape = (matrix) => {
    const start = leafPositions.length
    for (let i = 0; i < baseLeaf.length; i += 3) {
      v.set(baseLeaf[i], baseLeaf[i + 1], baseLeaf[i + 2]).applyMatrix4(matrix)
      leafPositions.push(v.x, v.y, v.z)
    }
    leafRanges.push({ start, count: baseLeaf.length })
  }

  const renderBranches = (branchList, parentBaseMat, parentTrunkRadius) => {
    const effectiveRadius = parentTrunkRadius != null ? parentTrunkRadius : trunkRadius
    for (const branch of branchList) {
      const branchBase = branchXform(branch, effectiveRadius, trunkSegments, parentBaseMat)

      _branchM.copy(branchBase)
        .multiply(_tm.makeTranslation(0, branch.length / 2, 0))

      addCylinder(branch.diameter, branch.length, trunkSegments, _branchM)

      if (!leafCapHit && branch.leafClusters) {
        const tipFirst = branch.leafClusters.slice().sort((a, b) => (b.tip ? 1 : 0) - (a.tip ? 1 : 0))
        for (const cluster of tipFirst) {
          _clusterM.copy(branchBase).multiply(_tm.makeTranslation(0, cluster.y, 0))
          for (const leaf of cluster.leaves) {
            if (leafCount >= MAX_LEAVES || positions.length >= MAX_POSITIONS) { leafCapHit = true; break }
            _leafM.copy(_clusterM)
              .multiply(_tm.makeRotationY(leaf.angle))
              .multiply(_tm.makeRotationZ(leaf.zRot != null ? leaf.zRot : -Math.PI / 2))
            addLeafShape(_leafM)
            leafCount++
          }
          if (leafCapHit) break
        }
      }

      for (const sub of branch.subbranches) {
        const parentR = trunkSurfaceRadius(branch.diameter / 2, trunkSegments, sub.rotation)

        _subBaseM.copy(branchBase)
          .multiply(_tm.makeTranslation(0, sub.y, 0))
          .multiply(_tm.makeRotationY(sub.rotation))
          .multiply(_tm.makeTranslation(parentR, 0, 0))
          .multiply(_tm.makeRotationZ(-(Math.PI / 2 - sub.angle)))

        _subCenterM.copy(_subBaseM)
          .multiply(_tm.makeTranslation(0, sub.length / 2, 0))

        addCylinder(sub.diameter, sub.length, trunkSegments, _subCenterM)

        if (!leafCapHit && sub.leafClusters) {
          const subTipFirst = sub.leafClusters.slice().sort((a, b) => (b.tip ? 1 : 0) - (a.tip ? 1 : 0))
          for (const cluster of subTipFirst) {
            _clusterM.copy(_subBaseM).multiply(_tm.makeTranslation(0, cluster.y, 0))
            for (const leaf of cluster.leaves) {
              if (leafCount >= MAX_LEAVES || positions.length >= MAX_POSITIONS) { leafCapHit = true; break }
              _leafM.copy(_clusterM)
                .multiply(_tm.makeRotationY(leaf.angle))
                .multiply(_tm.makeRotationZ(leaf.zRot != null ? leaf.zRot : -Math.PI / 2))
              addLeafShape(_leafM)
              leafCount++
            }
            if (leafCapHit) break
          }
        }
      }
    }
  }

  // Lower trunk (from bottom to split point)
  const lowerTrunkCenter = (-height / 2 + splitY) / 2
  addCylinder(diameter, mainTrunkHeight, trunkSegments, _tm.makeTranslation(0, lowerTrunkCenter, 0))

  // Sub-trunks
  for (const st of subTrunks) {
    const stBase = subTrunkBaseMatrix(st, splitY)
    _stCenterM.copy(stBase).multiply(_tm.makeTranslation(0, subTrunkLength / 2, 0))
    addCylinder(st.diameter || diameter, subTrunkLength, trunkSegments, _stCenterM, insideTrunk)
    renderBranches(st.branches, stBase, (st.diameter || diameter) / 2)
  }

  // Main trunk branches
  renderBranches(branches, null)

  return { positions, leafPositions, leafRanges }
}

function branchXform(branch, trunkRadius, trunkSegments, parentBaseMat) {
  const surfaceR = trunkSurfaceRadius(trunkRadius, trunkSegments, branch.rotation)
  _m4_a.makeRotationY(branch.rotation)
  _m4_b.makeTranslation(surfaceR, branch.y, 0)
  _m4_c.makeRotationZ(-(Math.PI / 2 - branch.angle))
  _m4_a.multiply(_m4_b).multiply(_m4_c)
  if (parentBaseMat) return parentBaseMat.clone().multiply(_m4_a)
  return _m4_a.clone()
}

function subTrunkBaseMatrix(subTrunk, splitY) {
  _m4_a.makeTranslation(0, splitY, 0)
  _m4_b.makeRotationY(subTrunk.rotation)
  _m4_c.makeRotationZ(-subTrunk.angle)
  return _m4_a.multiply(_m4_b).multiply(_m4_c).clone()
}

function subXform(parentMat, sub, parentDiameter, segments) {
  const parentR = trunkSurfaceRadius(parentDiameter / 2, segments, sub.rotation)
  _m4_a.makeTranslation(0, sub.y, 0)
  _m4_b.makeRotationY(sub.rotation)
  _m4_c.makeTranslation(parentR, 0, 0)
  _m4_d.makeRotationZ(-(Math.PI / 2 - sub.angle))
  return parentMat.clone().multiply(_m4_a).multiply(_m4_b).multiply(_m4_c).multiply(_m4_d)
}

function getAllSegments(branches, trunkRadius, trunkSegments, subTrunksArr, splitY, subTrunkLength) {
  const segs = []
  for (const b of branches) {
    const mat = branchXform(b, trunkRadius, trunkSegments)
    const e = mat.elements, len = b.length
    segs.push({ bx:e[12], by:e[13], bz:e[14],
                tx:e[4]*len+e[12], ty:e[5]*len+e[13], tz:e[6]*len+e[14],
                radius: b.diameter / 2, branchId: b.id })
    for (const sub of b.subbranches) {
      const sMat = subXform(mat, sub, b.diameter, trunkSegments)
      const se = sMat.elements, slen = sub.length
      segs.push({ bx:se[12], by:se[13], bz:se[14],
                  tx:se[4]*slen+se[12], ty:se[5]*slen+se[13], tz:se[6]*slen+se[14],
                  radius: sub.diameter / 2, branchId: b.id })
    }
  }
  if (subTrunksArr) {
    for (const st of subTrunksArr) {
      const stBase = subTrunkBaseMatrix(st, splitY)
      const stRadius = st.diameter ? st.diameter / 2 : trunkRadius
      const ste = stBase.elements
      segs.push({ bx:ste[12], by:ste[13], bz:ste[14],
                  tx:ste[4]*subTrunkLength+ste[12], ty:ste[5]*subTrunkLength+ste[13], tz:ste[6]*subTrunkLength+ste[14],
                  radius: stRadius, branchId: st.id })
      for (const b of st.branches) {
        const mat = branchXform(b, stRadius, trunkSegments, stBase)
        const e = mat.elements, len = b.length
        segs.push({ bx:e[12], by:e[13], bz:e[14],
                    tx:e[4]*len+e[12], ty:e[5]*len+e[13], tz:e[6]*len+e[14],
                    radius: b.diameter / 2, branchId: b.id })
        for (const sub of b.subbranches) {
          const sMat = subXform(mat, sub, b.diameter, trunkSegments)
          const se = sMat.elements, slen = sub.length
          segs.push({ bx:se[12], by:se[13], bz:se[14],
                      tx:se[4]*slen+se[12], ty:se[5]*slen+se[13], tz:se[6]*slen+se[14],
                      radius: sub.diameter / 2, branchId: b.id })
        }
      }
    }
  }
  return segs
}

function hitsOther(bx, by, bz, tx, ty, tz, radius, skipIds, allSegs) {
  return allSegs.some(s => {
    if (skipIds.has(s.branchId)) return false
    return segmentSegmentDist(bx,by,bz, tx,ty,tz, s.bx,s.by,s.bz, s.tx,s.ty,s.tz) < (radius + s.radius)
  })
}

function makeTipCluster(y, clusterSize) {
  const baseAngle = Math.random() * Math.PI * 2
  const ring = Array.from({ length: clusterSize }, (_, i) => ({
    angle: baseAngle + (i / clusterSize) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
  }))
  const center = { angle: Math.random() * Math.PI * 2, zRot: 0 }
  return { y, tip: true, leaves: [...ring, center] }
}

function countTreeLeaves(branches, subTrunks) {
  let count = 0
  const countBranch = (b) => {
    if (b.leafClusters) count += b.leafClusters.reduce((s, c) => s + c.leaves.length, 0)
    if (b.subbranches) for (const sub of b.subbranches) {
      if (sub.leafClusters) count += sub.leafClusters.reduce((s, c) => s + c.leaves.length, 0)
    }
  }
  for (const b of branches) countBranch(b)
  for (const st of subTrunks) {
    for (const b of st.branches) countBranch(b)
  }
  return count
}

function growBranch(b, maxLength, trunkRadius, trunkSegments, allSegs, parentBaseMat, parentTrunkId, params, leafBudget) {
  const { growStep, subbranchDist, subbranchChance, leafDist, leafChance, leavesEnabled, segments, clusterSize, generateLeafCluster, branchDecay } = params
  const skipIds = parentTrunkId ? new Set([b.id, parentTrunkId]) : new Set([b.id])
  let anyGrew = false
  const canAddLeaves = leavesEnabled && leafBudget.remaining > 0

  const tryAddCluster = (y) => {
    if (leafBudget.remaining <= 0) return null
    let leaves = generateLeafCluster(clusterSize)
    if (leaves.length > leafBudget.remaining) leaves = leaves.slice(0, leafBudget.remaining)
    leafBudget.remaining -= leaves.length
    return { y, leaves }
  }

  const addTipCluster = (y) => {
    const baseAngle = Math.random() * Math.PI * 2
    const ring = Array.from({ length: clusterSize }, (_, i) => ({
      angle: baseAngle + (i / clusterSize) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
    }))
    const center = { angle: Math.random() * Math.PI * 2, zRot: 0 }
    const leaves = [...ring, center]
    leafBudget.remaining -= Math.min(leaves.length, Math.max(0, leafBudget.remaining))
    return { y, leaves, tip: true }
  }

  const maxSubLength = b.subbranches.reduce((max, s) => Math.max(max, s.length), 0)
  const newLength = Math.min(maxLength - maxSubLength, +(b.length + growStep).toFixed(1))
  const oldCheckpoints = Math.floor(b.length / subbranchDist)
  const newCheckpoints = Math.floor(newLength / subbranchDist)

  const lengthCapped = newLength <= b.length
  const noNewCheckpoints = newCheckpoints <= oldCheckpoints
  if (lengthCapped && noNewCheckpoints) {
    const subsCapped = b.subbranches.every(s => {
      const newSubLen = Math.min(maxLength - newLength, +(s.length + growStep).toFixed(1))
      return newSubLen <= s.length
    })
    if (subsCapped) {
      if (!leavesEnabled) return { branch: b, grew: false }
      const hasTipCluster = (b.leafClusters || []).some(c => c.tip)
      const subsNeedTipCluster = b.subbranches.some(s => !(s.leafClusters || []).some(c => c.tip))
      if (hasTipCluster && !subsNeedTipCluster) return { branch: b, grew: false }

      let updatedClusters = b.leafClusters || []
      if (!hasTipCluster) {
        updatedClusters = [...updatedClusters, addTipCluster(b.length)]
        anyGrew = true
      }
      let updatedSubs = b.subbranches
      if (subsNeedTipCluster) {
        updatedSubs = b.subbranches.map(s => {
          if ((s.leafClusters || []).some(c => c.tip)) return s
          anyGrew = true
          return { ...s, leafClusters: [...(s.leafClusters || []), addTipCluster(s.length)] }
        })
      }
      return { branch: { ...b, leafClusters: updatedClusters, subbranches: updatedSubs }, grew: anyGrew }
    }
  }

  const bMat = branchXform(b, trunkRadius, trunkSegments, parentBaseMat)
  let grownLength = newLength
  if (grownLength > b.length) {
    const be = bMat.elements
    const pbx = be[12], pby = be[13], pbz = be[14]
    const ptx = be[4]*grownLength+be[12], pty = be[5]*grownLength+be[13], ptz = be[6]*grownLength+be[14]
    if (hitsOther(pbx,pby,pbz, ptx,pty,ptz, b.diameter / 2, skipIds, allSegs)) {
      grownLength = b.length
    }
  }
  const effectiveCheckpoints = Math.floor(grownLength / subbranchDist)
  if (grownLength > b.length) anyGrew = true

  let branchLeafClusters = b.leafClusters || []
  if (canAddLeaves) {
    const oldLeafCp = Math.floor(b.length / leafDist)
    const newLeafCp = Math.floor(grownLength / leafDist)
    for (let cp = oldLeafCp + 1; cp <= newLeafCp; cp++) {
      if (leafBudget.remaining <= 0) break
      if (Math.random() < leafChance / 100) {
        const cluster = tryAddCluster(cp * leafDist)
        if (cluster) { branchLeafClusters = [...branchLeafClusters, cluster]; anyGrew = true }
      }
    }
  }

  const grownSubs = b.subbranches.map(sub => {
    const fitCap = Math.sin(sub.angle) > 0.1
      ? (grownLength - sub.y) / Math.sin(sub.angle) : Infinity
    let newSubLen = Math.min(maxLength - grownLength, fitCap, +(sub.length + growStep).toFixed(1))
    if (newSubLen > sub.length) {
      const sMat = subXform(bMat, sub, b.diameter, trunkSegments)
      const se = sMat.elements
      const sbx = se[12], sby = se[13], sbz = se[14]
      const stx = se[4]*newSubLen+se[12], sty = se[5]*newSubLen+se[13], stz = se[6]*newSubLen+se[14]
      if (hitsOther(sbx,sby,sbz, stx,sty,stz, sub.diameter / 2, skipIds, allSegs)) {
        newSubLen = sub.length
      }
    }
    if (newSubLen > sub.length) anyGrew = true

    const origSubClusters = sub.leafClusters || []
    let subLeafClusters = origSubClusters
    if (canAddLeaves) {
      const oldSubLeafCp = Math.floor(sub.length / leafDist)
      const newSubLeafCp = Math.floor(newSubLen / leafDist)
      for (let cp = oldSubLeafCp + 1; cp <= newSubLeafCp; cp++) {
        if (leafBudget.remaining <= 0) break
        if (Math.random() < leafChance / 100) {
          const cluster = tryAddCluster(cp * leafDist)
          if (cluster) { subLeafClusters = [...subLeafClusters, cluster]; anyGrew = true }
        }
      }
      if (newSubLen <= sub.length && !subLeafClusters.some(c => c.tip)) {
        subLeafClusters = [...subLeafClusters, addTipCluster(newSubLen)]
        anyGrew = true
      }
    }

    if (newSubLen <= sub.length && subLeafClusters === origSubClusters) return sub
    if (subLeafClusters !== origSubClusters) return { ...sub, length: newSubLen, leafClusters: subLeafClusters }
    return { ...sub, length: newSubLen }
  })
  const newSubs = [...grownSubs]
  for (let cp = oldCheckpoints + 1; cp <= effectiveCheckpoints; cp++) {
    if (Math.random() < subbranchChance / 100) {
      const subDiam = +(b.diameter * branchDecay).toFixed(1)
      if (subDiam > 0) {
        const subAngle = +(0.3 + Math.random() * 1.0).toFixed(2)
        const rawY = cp * subbranchDist
        const clampedY = Math.max(subDiam / 2, Math.min(rawY, grownLength - subDiam / 2))
        const fitCap = Math.sin(subAngle) > 0.1
          ? (grownLength - clampedY) / Math.sin(subAngle) : Infinity
        const maxInitLength = Math.min(maxLength - grownLength, fitCap)
        const initLength = +Math.min(maxInitLength, grownLength * (0.01 + Math.random() * 0.04)).toFixed(1)
        newSubs.push({
          id: Date.now() + Math.random(),
          y: clampedY,
          rotation: chooseSubbranchRotation(newSubs),
          length: initLength,
          diameter: subDiam,
          angle: subAngle,
          leafClusters: leavesEnabled ? [addTipCluster(initLength)] : undefined,
        })
        anyGrew = true
      }
    }
  }

  if (leavesEnabled && grownLength <= b.length && !branchLeafClusters.some(c => c.tip)) {
    const allSubsDone = newSubs.every(s => {
      const fitCap = Math.sin(s.angle) > 0.1
        ? (grownLength - s.y) / Math.sin(s.angle) : Infinity
      const cap = Math.min(maxLength - grownLength, fitCap, +(s.length + growStep).toFixed(1))
      return cap <= s.length
    })
    if (allSubsDone) {
      branchLeafClusters = [...branchLeafClusters, addTipCluster(grownLength)]
      anyGrew = true
    }
  }

  return { branch: { ...b, length: grownLength, leafClusters: branchLeafClusters, subbranches: newSubs }, grew: anyGrew }
}

function ensureTipClusters(branches, subTrunks, clusterSize) {
  const ensureTip = (clusters, length) => {
    const tipIdx = clusters.findIndex(c => c.tip)
    if (tipIdx === -1) return [...clusters, makeTipCluster(length, clusterSize)]
    if (clusters[tipIdx].y !== length) return clusters.map((c, i) => i === tipIdx ? { ...c, y: length } : c)
    return null // no change needed
  }
  const ensureBranchTip = (b) => {
    let clusters = b.leafClusters || []
    let changed = false
    const updated = ensureTip(clusters, b.length)
    if (updated) { clusters = updated; changed = true }
    let subs = b.subbranches
    let subsChanged = false
    subs = subs.map(s => {
      const sc = s.leafClusters || []
      const updatedSc = ensureTip(sc, s.length)
      if (!updatedSc) return s
      subsChanged = true
      return { ...s, leafClusters: updatedSc }
    })
    if (changed || subsChanged) {
      return { ...b, leafClusters: clusters, subbranches: subsChanged ? subs : b.subbranches }
    }
    return b
  }

  const newBranches = branches.map(ensureBranchTip)
  const newSubTrunks = subTrunks.map(st => ({
    ...st,
    branches: st.branches.map(ensureBranchTip),
  }))
  return { branches: newBranches, subTrunks: newSubTrunks }
}

function computeGrow(branches, subTrunksArr, params) {
  const { height, diameter, segments, splitY, subTrunkLength, maxBranchLength } = params
  const trunkRadius = diameter / 2
  const trunkSegments = segments
  const allSegs = getAllSegments(branches, trunkRadius, trunkSegments, subTrunksArr, splitY, subTrunkLength)
  let anyGrew = false
  const mainMaxLength = maxBranchLength
  const stMaxLength = maxBranchLength
  const leafBudget = { remaining: MAX_LEAVES - countTreeLeaves(branches, subTrunksArr) }

  const nextBranches = branches.map(b => {
    const result = growBranch(b, mainMaxLength, trunkRadius, trunkSegments, allSegs, null, null, params, leafBudget)
    if (result.grew) anyGrew = true
    return result.branch
  })

  const nextSubTrunks = subTrunksArr.map(st => {
    const stBase = subTrunkBaseMatrix(st, splitY)
    const stRadius = st.diameter ? st.diameter / 2 : trunkRadius
    const grownBranches = st.branches.map(b => {
      const result = growBranch(b, stMaxLength, stRadius, trunkSegments, allSegs, stBase, st.id, params, leafBudget)
      if (result.grew) anyGrew = true
      return result.branch
    })
    return { ...st, branches: grownBranches }
  })

  let tippedBranches = nextBranches, tippedSubTrunks = nextSubTrunks
  if (params.leavesEnabled) {
    const tipped = ensureTipClusters(nextBranches, nextSubTrunks, params.clusterSize)
    tippedBranches = tipped.branches
    tippedSubTrunks = tipped.subTrunks
  }
  const pruned = pruneNonTipLeaves(tippedBranches, tippedSubTrunks)
  return { branches: pruned.branches, subTrunks: pruned.subTrunks, grew: anyGrew }
}

function pruneNonTipLeaves(branches, subTrunks) {
  let total = countTreeLeaves(branches, subTrunks)
  if (total <= MAX_LEAVES) return { branches, subTrunks }

  let excess = total - MAX_LEAVES

  const pruneBranch = (b) => {
    if (excess <= 0) return b
    const clusters = b.leafClusters || []
    let newClusters = null

    for (let i = 0; i < clusters.length && excess > 0; i++) {
      if (clusters[i].tip) continue
      if (!newClusters) newClusters = [...clusters]
      const c = newClusters[i]
      if (c.leaves.length <= excess) {
        excess -= c.leaves.length
        newClusters[i] = null
      } else {
        newClusters[i] = { ...c, leaves: c.leaves.slice(excess) }
        excess = 0
      }
    }
    if (newClusters) newClusters = newClusters.filter(c => c !== null)

    let newSubs = null
    for (let si = 0; si < b.subbranches.length && excess > 0; si++) {
      const sub = b.subbranches[si]
      const sClusters = sub.leafClusters || []
      let newSClusters = null
      for (let i = 0; i < sClusters.length && excess > 0; i++) {
        if (sClusters[i].tip) continue
        if (!newSClusters) newSClusters = [...sClusters]
        const c = newSClusters[i]
        if (c.leaves.length <= excess) {
          excess -= c.leaves.length
          newSClusters[i] = null
        } else {
          newSClusters[i] = { ...c, leaves: c.leaves.slice(excess) }
          excess = 0
        }
      }
      if (newSClusters) {
        if (!newSubs) newSubs = [...b.subbranches]
        newSubs[si] = { ...sub, leafClusters: newSClusters.filter(c => c !== null) }
      }
    }

    if (newClusters || newSubs) {
      return { ...b, leafClusters: newClusters || clusters, subbranches: newSubs || b.subbranches }
    }
    return b
  }

  const prunedBranches = branches.map(pruneBranch)
  const prunedSubTrunks = subTrunks.map(st => {
    if (excess <= 0) return st
    const prunedStBranches = st.branches.map(pruneBranch)
    return { ...st, branches: prunedStBranches }
  })

  return { branches: prunedBranches, subTrunks: prunedSubTrunks }
}

function createInitialTree(ranges, growStep, leavesEnabled, generateLeafCluster, idOffset = 0) {
  const rand = (min, max) => min + Math.random() * (max - min)
  const r = ranges

  const params = {
    height: Math.round(rand(...r.height)),
    diameter: Math.round(rand(...r.diameter)),
    segments: Math.round(rand(...r.segments)),
    numBranches: Math.round(rand(...r.numBranches)),
    subbranchDist: +rand(...r.subbranchDist).toFixed(1),
    subbranchChance: Math.round(rand(...r.subbranchChance)),
    branchDecay: +rand(...r.branchDecay).toFixed(2),
    maxBranchPct: Math.round(rand(...r.maxBranchPct)),
    leafDist: +rand(...r.leafDist).toFixed(1),
    leafChance: Math.round(rand(...r.leafChance)),
    splitFraction: +rand(...r.splitFraction).toFixed(2),
    subTrunkCount: Math.round(rand(...r.subTrunkCount)),
    leafLength: +rand(...r.leafLength).toFixed(1),
    leafWidth: +rand(...r.leafWidth).toFixed(1),
    leafVeins: Math.round(rand(...r.leafVeins)),
    clusterSize: Math.round(rand(...r.clusterSize)),
  }

  const splitY = -params.height / 2 + params.splitFraction * params.height
  const mainTrunkHeight = params.splitFraction * params.height
  const subTrunkLength = (1 - params.splitFraction) * params.height
  const maxBranchLength = params.height * params.maxBranchPct / 100

  const baseId = Date.now() + idOffset

  // Create sub-trunks
  const newSubTrunks = []
  const baseRotStep = (2 * Math.PI) / params.subTrunkCount
  for (let i = 0; i < params.subTrunkCount; i++) {
    const jitter = (Math.random() - 0.5) * baseRotStep * 0.3
    const stDiam = +(params.diameter * (0.7 + Math.random() * 0.2)).toFixed(1)
    newSubTrunks.push({
      id: baseId + 1000 + i,
      rotation: i * baseRotStep + jitter,
      angle: +(0.1 + Math.random() * 0.45).toFixed(2),
      diameter: stDiam,
      branches: [],
    })
  }

  // Distribute branches round-robin across sub-trunks
  for (let i = 0; i < params.numBranches; i++) {
    const stIdx = i % params.subTrunkCount
    const stBranches = newSubTrunks[stIdx].branches
    const face = chooseFace(stBranches, params.segments)
    const y = chooseY(stBranches, face, params.segments, subTrunkLength, 0, subTrunkLength * 0.95)
    stBranches.push({
      id: baseId + i,
      y,
      rotation: chooseRotationInFace(face, params.segments),
      length: +Math.min(subTrunkLength, params.height * (0.005 + Math.random() * 0.025)).toFixed(1),
      diameter: +(params.diameter / [3, 4, 5][Math.floor(Math.random() * 3)]).toFixed(1),
      angle: +(0.3 + Math.random() * 1.0).toFixed(2),
      subbranches: [],
    })
  }

  const treeState = { branches: [], subTrunks: newSubTrunks }

  const growParams = {
    height: params.height,
    growStep,
    subbranchDist: params.subbranchDist,
    subbranchChance: params.subbranchChance,
    leafDist: params.leafDist,
    leafChance: params.leafChance,
    leavesEnabled,
    diameter: params.diameter,
    segments: params.segments,
    clusterSize: params.clusterSize,
    generateLeafCluster,
    splitFraction: params.splitFraction,
    splitY,
    mainTrunkHeight,
    subTrunkLength,
    branchDecay: params.branchDecay,
    maxBranchLength,
  }

  return { params, treeState, growParams }
}

const DEFAULT_RANGES = {
  leafLength: [1, 50], leafWidth: [0.5, 15], leafVeins: [3, 3],
  diameter: [5, 60], height: [50, 800], segments: [3, 3],
  splitFraction: [0.2, 0.6], subTrunkCount: [2, 5],
  numBranches: [1, 30], maxBranchPct: [5, 100],
  subbranchDist: [0.5, 20], subbranchChance: [0, 100], branchDecay: [0.1, 0.95],
  leafDist: [0.5, 30], leafChance: [0, 100], clusterSize: [1, 6],
}

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw != null) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return fallback
}

function loadRanges() {
  const stored = loadStored('cardinal-ranges', null)
  if (stored) return { ...DEFAULT_RANGES, ...stored, segments: [3, 3], leafVeins: [3, 3] }
  return DEFAULT_RANGES
}

export default function Scene() {
  const [tree, setTree] = useState(null)
  const [seed, setSeed] = useState(null)
  const [seedInput, setSeedInput] = useState('')
  const prngRef = useRef(null)
  const controlsRef = useRef()
  const leafRangesRef = useRef([])
  const originalLeafPositionsRef = useRef(null)
  const fallenLeavesRef = useRef(new Set())
  const [age, setAge] = useState(0)
  const [flying, setFlying] = useState(false)
  const [leafMode, setLeafMode] = useState(false)
  const [orbiting, setOrbiting] = useState(true)
  const [orbitRadius, setOrbitRadius] = useState(() => computeOrbitRadius(300, 50))
  const orbitAngleRef = useRef(Math.PI / 4)
  const [orbitSpeed, setOrbitSpeed] = useState(0.1)
  const [orbitElevation, setOrbitElevation] = useState(0.3)

  const handleSetFlying = useCallback((val) => {
    setFlying(val)
    if (val) setOrbiting(false)
  }, [])

  const observe = () => {
    setOrbiting(true)
    setOrbitRadius(computeOrbitRadius(tree?.params.height || 300, 50))
    orbitAngleRef.current = Math.PI / 4
  }

  function generateLeafCluster(maxCount) {
    const count = 1 + Math.floor(Math.random() * maxCount)
    const baseAngle = Math.random() * Math.PI * 2
    return Array.from({ length: count }, (_, i) => ({
      angle: baseAngle + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
    }))
  }

  const SECTION_KEYS = {
    trunk: ['diameter', 'height', 'segments', 'splitFraction', 'subTrunkCount'],
    branches: ['numBranches', 'maxBranchPct', 'subbranchDist', 'subbranchChance', 'branchDecay'],
    leafShape: ['leafLength', 'leafWidth', 'leafVeins'],
    foliage: ['leafDist', 'leafChance', 'clusterSize'],
  }

  const [growStep, setGrowStep] = useState(() => loadStored('cardinal-growStep', 0.1))
  const [leavesEnabled, setLeavesEnabled] = useState(() => loadStored('cardinal-leavesEnabled', true))
  const [growFps, setGrowFps] = useState(() => loadStored('cardinal-growFps', 200))
  const [animateGrowth, setAnimateGrowth] = useState(() => loadStored('cardinal-animateGrowth', false))
  const [autoGrowing, setAutoGrowing] = useState(false)
  const [fallSpeed, setFallSpeed] = useState(() => loadStored('cardinal-fallSpeed', 1.0))
  const [lps, setLps] = useState(() => loadStored('cardinal-lps', 52))
  const leafFallProgressRef = useRef(new Map())
  const [fallActive, setFallActive] = useState(false)
  const fallQueueRef = useRef([])
  const colorArrayRef = useRef(null)
  const [ranges, setRanges] = useState(loadRanges)
  const [locked, setLocked] = useState(() => loadStored('cardinal-locked', { segments: true, leafVeins: true }))
  const growDoneRef = useRef(false)

  useEffect(() => { localStorage.setItem('cardinal-ranges', JSON.stringify(ranges)) }, [ranges])
  useEffect(() => { localStorage.setItem('cardinal-locked', JSON.stringify(locked)) }, [locked])
  useEffect(() => { localStorage.setItem('cardinal-leavesEnabled', JSON.stringify(leavesEnabled)) }, [leavesEnabled])
  useEffect(() => { localStorage.setItem('cardinal-animateGrowth', JSON.stringify(animateGrowth)) }, [animateGrowth])
  useEffect(() => { localStorage.setItem('cardinal-growFps', JSON.stringify(growFps)) }, [growFps])
  useEffect(() => { localStorage.setItem('cardinal-growStep', JSON.stringify(growStep)) }, [growStep])
  useEffect(() => { localStorage.setItem('cardinal-fallSpeed', JSON.stringify(fallSpeed)) }, [fallSpeed])
  useEffect(() => { localStorage.setItem('cardinal-lps', JSON.stringify(lps)) }, [lps])

  const toggleSectionLock = (sectionKey) => {
    const keys = SECTION_KEYS[sectionKey]
    const allLocked = keys.every(k => locked[k])
    setLocked(prev => {
      const next = { ...prev }
      for (const k of keys) next[k] = !allLocked
      return next
    })
  }

  const isSectionLocked = (sectionKey) => SECTION_KEYS[sectionKey].every(k => locked[k])

  const plantTree = () => {
    fallenLeavesRef.current = new Set()
    leafFallProgressRef.current = new Map()
    fallQueueRef.current = []
    setFallActive(false)
    colorArrayRef.current = null
    const usedSeed = seedInput.trim() ? parseInt(seedInput.trim(), 10) : Math.floor(Math.random() * 2**32)
    setSeedInput('')

    if (animateGrowth) {
      const prng = mulberry32(usedSeed)
      const orig = Math.random
      Math.random = prng
      const newTree = createInitialTree(ranges, growStep, leavesEnabled, generateLeafCluster, 0)
      Math.random = orig
      prngRef.current = prng
      setTree(newTree)
      growDoneRef.current = false
      setAutoGrowing(true)
    } else {
      const finalTree = withSeed(usedSeed, () => {
        const newTree = createInitialTree(ranges, growStep, leavesEnabled, generateLeafCluster, 0)
        let state = newTree.treeState
        const gp = newTree.growParams
        while (true) {
          const result = computeGrow(state.branches, state.subTrunks, gp)
          state = { branches: result.branches, subTrunks: result.subTrunks }
          if (!result.grew) break
        }
        return { ...newTree, treeState: state }
      })
      setTree(finalTree)
      growDoneRef.current = true
    }
    setSeed(usedSeed)
  }

  useEffect(() => {
    if (!autoGrowing) return
    let rafId, lastTime = 0
    const tick = (time) => {
      rafId = requestAnimationFrame(tick)
      if (growDoneRef.current) {
        setAutoGrowing(false)
        cancelAnimationFrame(rafId)
        return
      }
      const elapsed = time - lastTime
      const ticksThisFrame = Math.min(20, Math.floor(elapsed * growFps / 1000))
      if (ticksThisFrame < 1) return
      lastTime = time
      setTree(prev => {
        if (!prev) return prev
        let state = prev.treeState
        const gp = prev.growParams
        const orig = Math.random
        if (prngRef.current) Math.random = prngRef.current
        try {
          for (let i = 0; i < ticksThisFrame; i++) {
            const result = computeGrow(state.branches, state.subTrunks, gp)
            state = { branches: result.branches, subTrunks: result.subTrunks }
            if (!result.grew) { growDoneRef.current = true; break }
          }
        } finally {
          Math.random = orig
        }
        return { ...prev, treeState: state }
      })
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [autoGrowing, growFps])

  const { treeGeometry, treeLeafGeometry } = useMemo(() => {
    if (!tree) return { treeGeometry: null, treeLeafGeometry: null }
    const { positions, leafPositions, leafRanges } = buildTreePositions(tree.treeState, tree.params)
    // Precompute minY per leaf for fall animation
    for (const range of leafRanges) {
      const startVert = range.start / 3
      const numVerts = range.count / 3
      let minY = Infinity
      for (let i = startVert; i < startVert + numVerts; i++) {
        if (leafPositions[i * 3 + 1] < minY) minY = leafPositions[i * 3 + 1]
      }
      range.minY = minY
    }
    leafRangesRef.current = leafRanges
    originalLeafPositionsRef.current = new Float32Array(leafPositions)
    const treeGeo = new THREE.BufferGeometry()
    treeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const leafGeo = new THREE.BufferGeometry()
    leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafPositions, 3))
    // Create color attribute once, initialized to all-green
    const vertexCount = leafPositions.length / 3
    const colorArray = new Float32Array(vertexCount * 3)
    for (let i = 0; i < vertexCount; i++) {
      colorArray[i * 3] = GREEN_RGB[0]
      colorArray[i * 3 + 1] = GREEN_RGB[1]
      colorArray[i * 3 + 2] = GREEN_RGB[2]
    }
    leafGeo.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3))
    colorArrayRef.current = colorArray
    return { treeGeometry: treeGeo, treeLeafGeometry: leafGeo }
  }, [tree?.treeState, tree?.params])

  useEffect(() => {
    return () => {
      if (treeGeometry) treeGeometry.dispose()
      if (treeLeafGeometry) treeLeafGeometry.dispose()
    }
  }, [treeGeometry, treeLeafGeometry])

  // Combined fall animation loop — drains queue, updates colors + positions each frame
  useEffect(() => {
    if (!fallActive || !treeLeafGeometry || !originalLeafPositionsRef.current) return
    const origPos = originalLeafPositionsRef.current
    const ranges = leafRangesRef.current
    const groundY = -(tree?.params.height || 300) / 2
    const posAttr = treeLeafGeometry.getAttribute('position')
    const colorAttr = treeLeafGeometry.getAttribute('color')
    if (!posAttr) return
    const colorArr = colorArrayRef.current
    const progress = leafFallProgressRef.current
    const fallen = fallenLeavesRef.current
    let lastTime = 0
    let accum = 0
    let rafId
    const tick = (time) => {
      rafId = requestAnimationFrame(tick)
      if (lastTime === 0) { lastTime = time; return }
      const elapsed = time - lastTime
      const dt = elapsed / 1000
      lastTime = time
      let colorsChanged = false
      // 1. Drain queue at LPS rate
      accum += elapsed * lps / 1000
      const drainCount = Math.min(Math.floor(accum), fallQueueRef.current.length)
      if (drainCount > 0) {
        accum -= drainCount
        const picked = fallQueueRef.current.splice(0, drainCount)
        for (const idx of picked) {
          fallen.add(idx)
          progress.set(idx, 0)
          // 2. Set color to yellow in-place
          if (colorArr && idx < ranges.length) {
            const { start, count: cnt } = ranges[idx]
            const startVert = start / 3
            const numVerts = cnt / 3
            for (let i = startVert; i < startVert + numVerts; i++) {
              colorArr[i * 3] = YELLOW_RGB[0]
              colorArr[i * 3 + 1] = YELLOW_RGB[1]
              colorArr[i * 3 + 2] = YELLOW_RGB[2]
            }
            colorsChanged = true
          }
        }
      }
      // 3. Advance progress for in-flight leaves, update positions
      const toRemove = []
      for (const [idx, p] of progress) {
        if (idx >= ranges.length) continue
        const newP = Math.min(1, p + fallSpeed * dt)
        progress.set(idx, newP)
        const { start, count: cnt, minY } = ranges[idx]
        const startVert = start / 3
        const numVerts = cnt / 3
        const currentShift = (groundY - minY) * newP
        for (let i = startVert; i < startVert + numVerts; i++) {
          posAttr.array[i * 3 + 1] = origPos[i * 3 + 1] + currentShift
        }
        // 4. Mark completed leaves for removal from progress Map
        if (newP >= 1) toRemove.push(idx)
      }
      for (const idx of toRemove) progress.delete(idx)
      // 5. Mark buffers for GPU upload
      if (progress.size > 0 || toRemove.length > 0) posAttr.needsUpdate = true
      if (colorsChanged && colorAttr) colorAttr.needsUpdate = true
      // 6. Stop when queue drained and all leaves landed
      if (fallQueueRef.current.length === 0 && progress.size === 0) {
        setFallActive(false)
        cancelAnimationFrame(rafId)
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [fallActive, fallSpeed, lps, treeLeafGeometry, tree?.params.height])

  const leafGeometry = useMemo(() => {
    const r = ranges
    const ll = (r.leafLength[0] + r.leafLength[1]) / 2
    const lw = (r.leafWidth[0] + r.leafWidth[1]) / 2
    const lv = Math.round((r.leafVeins[0] + r.leafVeins[1]) / 2)
    const positions = generateLeaf(ll, lw, lv)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [ranges.leafLength, ranges.leafWidth, ranges.leafVeins])

  useEffect(() => {
    return () => { if (leafGeometry) leafGeometry.dispose() }
  }, [leafGeometry])

  const leafCount = useMemo(() => {
    if (!tree) return 0
    let count = 0
    const countBranch = (b) => {
      if (b.leafClusters) count += b.leafClusters.reduce((s, c) => s + c.leaves.length, 0)
      if (b.subbranches) for (const sub of b.subbranches) {
        if (sub.leafClusters) count += sub.leafClusters.reduce((s, c) => s + c.leaves.length, 0)
      }
    }
    for (const b of tree.treeState.branches) countBranch(b)
    for (const st of tree.treeState.subTrunks) {
      for (const b of st.branches) countBranch(b)
    }
    return count
  }, [tree?.treeState])

  const floorPts = useMemo(() => {
    const h = tree?.params.height || 300
    return [[-141, -h / 2, -141], [141, -h / 2, -141], [141, -h / 2, 141], [-141, -h / 2, 141], [-141, -h / 2, -141]]
  }, [tree?.params.height])

  return (
    <div className="canvas-container">
      <Canvas
        camera={{ position: [orbitRadius * 0.707, 0, orbitRadius * 0.707], fov: 50, far: 100000 }}
        style={{ background: AKIRA.bg }}
      >
        <CameraController
          controlsRef={controlsRef}
          flying={flying}
          setFlying={handleSetFlying}
          orbiting={orbiting}
          orbitAngleRef={orbitAngleRef}
          orbitSpeed={orbitSpeed}
          orbitRadius={orbitRadius}
          orbitElevation={orbitElevation}
        />
        {leafMode ? (
          <lineSegments geometry={leafGeometry}>
            <lineBasicMaterial color={AKIRA.green} />
          </lineSegments>
        ) : (
          <>
            <Line points={floorPts} color={AKIRA.blue} lineWidth={2} />
            {treeGeometry && (
              <lineSegments geometry={treeGeometry}>
                <lineBasicMaterial color={AKIRA.red} />
              </lineSegments>
            )}
            {treeLeafGeometry && (
              <lineSegments geometry={treeLeafGeometry}>
                <lineBasicMaterial vertexColors />
              </lineSegments>
            )}
          </>
        )}
      </Canvas>
      <div className="controls">
        {tree && <div className="leaf-count">Leaves: {leafCount}</div>}
        {seed != null && <div className="leaf-count" style={{ cursor: 'pointer', userSelect: 'all', fontSize: '0.7rem' }} onClick={() => navigator.clipboard?.writeText(String(seed))}>Seed: {seed}</div>}
        <div className="control" style={{ gap: '0.3rem' }}>
          <input
            type="text"
            placeholder="Paste seed..."
            value={seedInput}
            onChange={e => setSeedInput(e.target.value)}
            style={{ width: '8rem', padding: '0.2rem 0.4rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', color: 'inherit' }}
          />
        </div>
        {(() => { const tp = tree?.params; return <>
        <div className="section-label">
          Trunk
          <button className={`section-lock-btn${isSectionLocked('trunk') ? ' locked' : ''}`} onClick={() => toggleSectionLock('trunk')}>
            {isSectionLocked('trunk') ? '\u{1F512}' : '\u{1F513}'}
          </button>
        </div>
        <RangeControl label="Diameter" rangeKey="diameter" step={1} hardMin={1} format={v => Math.round(v)} currentValue={tp?.diameter} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Height" rangeKey="height" step={5} hardMin={5} format={v => Math.round(v)} currentValue={tp?.height} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Segments" rangeKey="segments" step={1} hardMin={3} format={v => Math.round(v)} currentValue={tp?.segments} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Split" rangeKey="splitFraction" step={0.01} hardMin={0.2} hardMax={0.6} format={v => Math.round(v * 100) + '%'} currentValue={tp?.splitFraction} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Sub-Trunks" rangeKey="subTrunkCount" step={1} hardMin={2} hardMax={5} format={v => Math.round(v)} currentValue={tp?.subTrunkCount} {...{ranges, setRanges, locked, setLocked}} />

        <div className="section-label">
          Branches
          <button className={`section-lock-btn${isSectionLocked('branches') ? ' locked' : ''}`} onClick={() => toggleSectionLock('branches')}>
            {isSectionLocked('branches') ? '\u{1F512}' : '\u{1F513}'}
          </button>
        </div>
        <RangeControl label="Count" rangeKey="numBranches" step={1} hardMin={1} format={v => Math.round(v)} currentValue={tp?.numBranches} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Max Length" rangeKey="maxBranchPct" step={5} hardMin={5} hardMax={100} format={v => Math.round(v) + '%'} currentValue={tp?.maxBranchPct} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Sub Dist" rangeKey="subbranchDist" step={0.5} hardMin={0.5} format={v => v.toFixed(1)} currentValue={tp?.subbranchDist} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Sub Chance" rangeKey="subbranchChance" step={5} hardMin={0} hardMax={100} format={v => Math.round(v) + '%'} currentValue={tp?.subbranchChance} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Decay" rangeKey="branchDecay" step={0.05} hardMin={0.1} hardMax={0.95} format={v => v.toFixed(2)} currentValue={tp?.branchDecay} {...{ranges, setRanges, locked, setLocked}} />

        <div className="section-label">
          Leaf Shape
          <button className={`section-lock-btn${isSectionLocked('leafShape') ? ' locked' : ''}`} onClick={() => toggleSectionLock('leafShape')}>
            {isSectionLocked('leafShape') ? '\u{1F512}' : '\u{1F513}'}
          </button>
        </div>
        <RangeControl label="Height" rangeKey="leafLength" step={1} hardMin={1} format={v => v.toFixed(1)} currentValue={tp?.leafLength} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Width" rangeKey="leafWidth" step={0.5} hardMin={0.5} format={v => v.toFixed(1)} currentValue={tp?.leafWidth} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Veins" rangeKey="leafVeins" step={1} hardMin={3} hardMax={5} format={v => Math.round(v)} currentValue={tp?.leafVeins} {...{ranges, setRanges, locked, setLocked}} />

        <div className="section-label">
          Foliage
          <button className={`section-lock-btn${isSectionLocked('foliage') ? ' locked' : ''}`} onClick={() => toggleSectionLock('foliage')}>
            {isSectionLocked('foliage') ? '\u{1F512}' : '\u{1F513}'}
          </button>
        </div>
        <button className={`lock-btn${leavesEnabled ? ' locked' : ''}`} onClick={() => setLeavesEnabled(l => !l)}>
          {leavesEnabled ? 'Leaves On' : 'Leaves Off'}
        </button>
        <RangeControl label="Leaf Dist" rangeKey="leafDist" step={0.5} hardMin={0.5} format={v => v.toFixed(1)} currentValue={tp?.leafDist} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Leaf Chance" rangeKey="leafChance" step={5} hardMin={0} hardMax={100} format={v => Math.round(v) + '%'} currentValue={tp?.leafChance} {...{ranges, setRanges, locked, setLocked}} />
        <RangeControl label="Cluster Size" rangeKey="clusterSize" step={1} hardMin={1} format={v => Math.round(v)} currentValue={tp?.clusterSize} {...{ranges, setRanges, locked, setLocked}} />
        <button className={`lock-btn${animateGrowth ? ' locked' : ''}`} onClick={() => setAnimateGrowth(a => !a)}>
          {animateGrowth ? 'Animate Growth' : 'Instant Growth'}
        </button>
        {animateGrowth && (
          <div className="control">
            <span className="control-label">Grow FPS: {growFps}</span>
            <div className="control-buttons">
              <HoldButton onAction={() => setGrowFps(f => Math.max(1, f - 1))}>−</HoldButton>
              <HoldButton onAction={() => setGrowFps(f => f + 1)}>+</HoldButton>
            </div>
          </div>
        )}
        <div className="control">
          <span className="control-label">Fall Speed: {fallSpeed.toFixed(1)}</span>
          <div className="control-buttons">
            <HoldButton onAction={() => setFallSpeed(s => Math.max(0.1, +(s - 0.1).toFixed(1)))}>−</HoldButton>
            <HoldButton onAction={() => setFallSpeed(s => +(s + 0.1).toFixed(1))}>+</HoldButton>
          </div>
        </div>

        </>; })()}
        <div className="section-label">Camera</div>
        <div className="control">
          <span className="control-label">Orbit Speed: {orbitSpeed.toFixed(1)}</span>
          <div className="control-buttons">
            <HoldButton onAction={() => setOrbitSpeed(s => Math.max(0, +(s - 0.1).toFixed(1)))}>−</HoldButton>
            <HoldButton onAction={() => setOrbitSpeed(s => +(s + 0.1).toFixed(1))}>+</HoldButton>
          </div>
        </div>
        <div className="control">
          <span className="control-label">Orbit Dist: {orbitRadius.toFixed(0)}</span>
          <div className="control-buttons">
            <HoldButton onAction={() => setOrbitRadius(r => Math.max(10, r - 10))}>−</HoldButton>
            <HoldButton onAction={() => setOrbitRadius(r => r + 10)}>+</HoldButton>
          </div>
        </div>
        <div className="control">
          <span className="control-label">Orbit Elev: {Math.round(orbitElevation * 180 / Math.PI)}°</span>
          <div className="control-buttons">
            <HoldButton onAction={() => setOrbitElevation(e => Math.max(-Math.PI / 2 + 0.05, +(e - 0.05).toFixed(2)))}>−</HoldButton>
            <HoldButton onAction={() => setOrbitElevation(e => Math.min(Math.PI / 2 - 0.05, +(e + 0.05).toFixed(2)))}>+</HoldButton>
          </div>
        </div>
      </div>
      {autoGrowing
        ? <button className="plant-tree-btn stop" onClick={() => setAutoGrowing(false)}>Stop</button>
        : <button className="plant-tree-btn" onClick={plantTree}>Plant Tree</button>
      }
      {tree && !autoGrowing && (
        <div style={{ position: 'fixed', top: '4rem', right: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 1, alignItems: 'flex-end' }}>
          <div className="control" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <span className="control-label">Age: {age}</span>
            <div className="control-buttons">
              <HoldButton onAction={() => setAge(a => Math.max(0, a - 1))}>−</HoldButton>
              <HoldButton onAction={() => setAge(a => Math.min(76, a + 1))}>+</HoldButton>
            </div>
          </div>
          <div className="control" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <span className="control-label">LPS: {lps}</span>
            <div className="control-buttons">
              <HoldButton onAction={() => setLps(l => Math.max(1, l - 1))}>−</HoldButton>
              <HoldButton onAction={() => setLps(l => l + 1)}>+</HoldButton>
            </div>
          </div>
          {leafRangesRef.current.length > 0 && (
            <button className="plant-tree-btn" style={{ position: 'static' }} onClick={() => {
              const total = leafRangesRef.current.length
              const elapsedWeeks = age * 52
              const targetFallen = Math.min(total, Math.round(elapsedWeeks * total / 4000))
              const fallen = fallenLeavesRef.current
              const toAdd = targetFallen - fallen.size - fallQueueRef.current.length
              if (toAdd <= 0) return
              const alreadyQueued = new Set(fallQueueRef.current)
              const available = []
              for (let i = 0; i < total; i++) {
                if (!fallen.has(i) && !alreadyQueued.has(i)) available.push(i)
              }
              for (let i = available.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [available[i], available[j]] = [available[j], available[i]]
              }
              fallQueueRef.current.push(...available.slice(0, toAdd))
              setFallActive(true)
            }}>Fall</button>
          )}
        </div>
      )}
      {!flying && (
        <div className="bottom-right">
          <button className="fly-btn" onClick={() => setLeafMode(l => !l)}>
            {leafMode ? 'Tree Mode' : 'Leaf Mode'}
          </button>
          <div className="mode-buttons">
            <button className="fly-btn" onClick={observe}>Observe</button>
            <button className="fly-btn" onClick={() => controlsRef.current?.lock()}>Fly</button>
          </div>
        </div>
      )}
    </div>
  )
}
