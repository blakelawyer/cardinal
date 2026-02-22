# Tree Simulation Performance Optimizations

All changes target `src/components/Scene.jsx`.

---

## Optimization 1: Stop `setCameraInfo` from re-rendering the scene (CRITICAL)

**Problem:** `setCameraInfo()` (line 136) is called inside `useFrame` at ~60fps. It's a state setter on the `Scene` component, so it triggers a full React reconciliation of the entire tree — every branch, every subbranch, every wireframe, every control panel element — 60 times per second.

**Fix:** Use a ref instead of state for camera info, and render it via a separate component that reads the ref.

- **Option A (simplest):** Move camera info into its own component that uses `useFrame` to update a local ref and re-render only itself via a local `useState` with a throttle (e.g., 10fps).
- **Option B:** Store camera info in a ref (`cameraInfoRef`) and have the display component poll it or subscribe via `useFrame`.

**Changes:**
- Remove `cameraInfo` state from `Scene`
- Remove `setCameraInfo` prop from `CameraController`
- Create a `CameraInfoDisplay` component that lives inside `<Canvas>` and uses `useFrame` + local state to update itself at a throttled rate
- Or use an HTML overlay with `useFrame` to write directly to DOM refs (zero React re-renders)

**Impact:** Eliminates ~60 full re-renders/sec of the entire component tree. This alone will likely 5-10x the frame budget.

---

## Optimization 2: Memoize `CylinderWireframe` points array (HIGH)

**Problem:** Lines 155-158 — the `points` array is rebuilt every render, outside the `useMemo`. Even though `generateCylinder` is memoized, the edge-to-points mapping runs on every render for every cylinder.

**Fix:** Move the points construction into the `useMemo` or a second `useMemo`:

```jsx
const points = useMemo(() => {
  const pts = []
  for (const [i, j] of edges) {
    pts.push(vertices[i], vertices[j])
  }
  return pts
}, [vertices, edges])
```

Also wrap `CylinderWireframe` in `React.memo()` so it skips re-render when props haven't changed.

**Impact:** After fix #1 reduces re-renders, this ensures that when re-renders do happen (e.g., during growth), only changed cylinders rebuild their points.

---

## Optimization 3: Reuse objects in `useFrame` hot path (MEDIUM)

**Problem:** Lines 110 and 135 allocate `new THREE.Vector3()` and `new THREE.Euler()` every frame. These create garbage collection pressure.

**Fix:** Move these to persistent refs:

```jsx
const moveVec = useRef(new THREE.Vector3())
const tempEuler = useRef(new THREE.Euler())
```

Then reuse them in `useFrame`:

```jsx
const move = moveVec.current.set(0, 0, 0)
// ... modify move ...

const e = tempEuler.current.setFromQuaternion(camera.quaternion, 'YXZ')
```

**Impact:** Eliminates ~120 object allocations/sec (2 per frame at 60fps). Reduces GC pauses.

---

## Optimization 4: Make `computeGrow` skip unchanged branches (MEDIUM)

**Problem:** Lines 239-265 — every grow tick creates new spread copies of ALL branches and ALL subbranches, even those that haven't changed (e.g., branches that have reached their max length and aren't spawning new subbranches).

**Fix:** Add early returns for branches that can't grow:

```jsx
const next = branches.map(b => {
  const maxSubLength = b.subbranches.reduce((max, s) => Math.max(max, s.length), 0)
  const newLength = Math.min(height - maxSubLength, +(b.length + growStep).toFixed(1))
  const newCheckpoints = Math.floor(newLength / subbranchDist)
  const oldCheckpoints = Math.floor(b.length / subbranchDist)

  // Skip if nothing changed
  const lengthCapped = newLength <= b.length
  const subsCapped = b.subbranches.every(s => {
    const newSubLen = Math.min(height - newLength, +(s.length + growStep).toFixed(1))
    return newSubLen <= s.length
  })
  const noNewCheckpoints = newCheckpoints <= oldCheckpoints

  if (lengthCapped && subsCapped && noNewCheckpoints) return b // reuse same object

  // ... existing growth logic ...
})
```

**Impact:** Once branches reach max size, they're returned by reference instead of copied. Reduces allocations proportional to the number of "done" branches.

---

## Optimization 5: Flatten subbranch group nesting (LOW-MEDIUM)

**Problem:** Lines 399-406 — each subbranch creates 4 nested `<group>` elements. Each group is a Three.js `Object3D` requiring matrix computation and scene graph traversal.

**Fix:** Pre-compute the combined position and rotation for each subbranch and use a single `<group>`:

```jsx
const matrix = new THREE.Matrix4()
  .makeRotationY(sub.rotation)
  .multiply(new THREE.Matrix4().makeTranslation(parentR, 0, 0))
  .multiply(new THREE.Matrix4().makeRotationZ(-(Math.PI / 2 - sub.angle)))
  .multiply(new THREE.Matrix4().makeTranslation(0, sub.length / 2, 0))

<group matrix={matrix} matrixAutoUpdate={false}>
  <CylinderWireframe ... />
</group>
```

**Impact:** Reduces Object3D count by ~3x per subbranch. With 100 subbranches, that's 300 fewer matrix multiplications per frame.

---

## Optimization 6: Batch all wireframes into a single LineSegments geometry (LONG-TERM)

**Problem:** Each `CylinderWireframe` is a separate `<Line>` component, each creating its own draw call. With 20 branches and 5 subbranches each, that's 120+ draw calls.

**Fix:** Replace individual `<Line>` components with a single `THREE.LineSegments` that contains all wireframe geometry pre-transformed into world space:

1. Compute all cylinder vertices in world space (applying the parent transforms)
2. Merge into a single `Float32Array` position buffer
3. Render as one `<lineSegments>` with a single `BufferGeometry`

```jsx
const mergedGeometry = useMemo(() => {
  const positions = []
  // Add trunk vertices...
  // For each branch, transform cylinder vertices by branch transform, add...
  // For each subbranch, transform and add...
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geo
}, [branches, diameter, height])

<lineSegments geometry={mergedGeometry}>
  <lineBasicMaterial color={AKIRA.red} />
</lineSegments>
```

**Impact:** Reduces draw calls from O(N) to O(1). Most impactful at scale (100+ branches). Trade-off: loses per-branch color flexibility unless using vertex colors.

---

## Implementation Order

| Priority | Optimization | Effort | Impact |
|----------|-------------|--------|--------|
| 1 | Camera re-render (#1) | Small | Highest |
| 2 | Points memoization (#2) | Small | High |
| 3 | Reuse objects (#3) | Small | Medium |
| 4 | Skip unchanged branches (#4) | Medium | Medium |
| 5 | Flatten groups (#5) | Medium | Low-Medium |
| 6 | Batch geometry (#6) | Large | Highest long-term |

## Verification

- Run the app with `npm run dev`
- Plant a tree and let it auto-grow to full size
- Open Chrome DevTools Performance tab, record a ~5 second profile
- Compare before/after: frame times, scripting time, rendering time
- Verify the tree still looks identical and all controls still work
- Test with high branch counts (plant multiple trees in succession)
