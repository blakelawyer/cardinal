import { Routes, Route } from 'react-router-dom'
import Scene from './components/Scene.jsx'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Scene />} />
    </Routes>
  )
}

export default App
