import { useState, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'

const AKIRA = {
  bg: '#1f1f39',
  red: '#ff6e6e',
  green: '#6be28d',
  yellow: '#fbdda7',
  blue: '#b3e3f2',
}

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

function CameraZoom({ zoom }) {
  const { camera } = useThree()
  camera.position.z = zoom
  camera.updateProjectionMatrix()
  return null
}

function CylinderWireframe({ diameter, height, segments }) {
  const { vertices, edges } = useMemo(
    () => generateCylinder(diameter, height, segments),
    [diameter, height, segments]
  )

  const points = []
  for (const [i, j] of edges) {
    points.push(vertices[i], vertices[j])
  }

  return (
    <Line
      points={points}
      segments
      color={AKIRA.red}
      lineWidth={2}
    />
  )
}

export default function Scene() {
  const [diameter, setDiameter] = useState(2)
  const [height, setHeight] = useState(2)
  const [segments, setSegments] = useState(24)
  const [zoom, setZoom] = useState(5)

  return (
    <div className="canvas-container">
      <Canvas
        camera={{ position: [0, 0, zoom], fov: 50 }}
        style={{ background: AKIRA.bg }}
      >
        <CameraZoom zoom={zoom} />
        <CylinderWireframe diameter={diameter} height={height} segments={segments} />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      <div className="controls">
        <label>
          Diameter: {diameter.toFixed(1)}
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={diameter}
            onChange={(e) => setDiameter(parseFloat(e.target.value))}
          />
        </label>
        <label>
          Height: {height.toFixed(1)}
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(parseFloat(e.target.value))}
          />
        </label>
        <label>
          Segments: {segments}
          <input
            type="range"
            min="3"
            max="48"
            step="1"
            value={segments}
            onChange={(e) => setSegments(parseInt(e.target.value))}
          />
        </label>
        <label>
          Zoom: {zoom.toFixed(1)}
          <input
            type="range"
            min="2"
            max="10"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}
