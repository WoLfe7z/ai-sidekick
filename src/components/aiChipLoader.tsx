import { useEffect, useRef } from 'react'

export function AIChipLoader() {
  const chipRef = useRef<HTMLDivElement>(null)
  const orbit1Ref = useRef<HTMLDivElement>(null)
  const orbit2Ref = useRef<HTMLDivElement>(null)
  const orbit3Ref = useRef<HTMLDivElement>(null)
  const particle1Ref = useRef<HTMLDivElement>(null)
  const particle2Ref = useRef<HTMLDivElement>(null)
  const particle3Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let animationId: number

    // Orbit parameters
    const ORBIT_WIDTH = 340
    const ORBIT_HEIGHT = 180
    const CENTER_X = ORBIT_WIDTH / 2
    const CENTER_Y = ORBIT_HEIGHT / 2

    // Particle speeds
    const SPEED_1 = 0.02
    const SPEED_2 = 0.015
    const SPEED_3 = 0.012

    // Float animation - SLOWER
    let floatTime = 0
    const FLOAT_SPEED = 0.01  // Was 0.02 - now HALF speed
    const FLOAT_AMOUNT = 15

    let angle1 = 0
    let angle2 = Math.PI * 0.66
    let angle3 = Math.PI * 1.33

    const animate = () => {
      floatTime += FLOAT_SPEED

      // Calculate float offset (same for chip and all orbits)
      const floatOffset = Math.sin(floatTime) * FLOAT_AMOUNT

      // Apply float to chip
      if (chipRef.current) {
        chipRef.current.style.transform = `translateY(${floatOffset}px)`
      }

      // Apply same float to all orbits
      if (orbit1Ref.current) {
        orbit1Ref.current.style.transform = `translateY(${floatOffset}px)`
      }
      if (orbit2Ref.current) {
        orbit2Ref.current.style.transform = `translateY(${floatOffset}px)`
      }
      if (orbit3Ref.current) {
        orbit3Ref.current.style.transform = `translateY(${floatOffset}px)`
      }

      // Update particle angles
      angle1 += SPEED_1
      angle2 += SPEED_2
      angle3 += SPEED_3

      // Position particles on orbits
      if (particle1Ref.current) {
        const x = CENTER_X + (ORBIT_WIDTH / 2) * Math.cos(angle1)
        const y = CENTER_Y + (ORBIT_HEIGHT / 2) * Math.sin(angle1)
        
        // Size variation based on Y position (perspective depth)
        const distanceFromCenter = (y - CENTER_Y) / CENTER_Y
        const scale = 1 + (distanceFromCenter * 0.3)
        
        // Set position with left/top, scale with transform
        particle1Ref.current.style.left = `${x}px`
        particle1Ref.current.style.top = `${y}px`
        particle1Ref.current.style.transform = `rotateX(-10deg) translate(-50%, -50%) scale(${scale})`
        
        // Dynamic z-index for 3D depth
        const zIndex = y < CENTER_Y ? 5 : 15
        particle1Ref.current.style.zIndex = String(zIndex)
      }

      if (particle2Ref.current) {
        const x = CENTER_X + (ORBIT_WIDTH / 2) * Math.cos(angle2)
        const y = CENTER_Y + (ORBIT_HEIGHT / 2) * Math.sin(angle2)
        
        const distanceFromCenter = (y - CENTER_Y) / CENTER_Y
        const scale = 1 + (distanceFromCenter * 0.3)
        
        particle2Ref.current.style.left = `${x}px`
        particle2Ref.current.style.top = `${y}px`
        particle2Ref.current.style.transform = `rotateX(-10deg) translate(-50%, -50%) scale(${scale})`
        
        const zIndex = y < CENTER_Y ? 5 : 15
        particle2Ref.current.style.zIndex = String(zIndex)
      }

      if (particle3Ref.current) {
        const x = CENTER_X + (ORBIT_WIDTH / 2) * Math.cos(angle3)
        const y = CENTER_Y + (ORBIT_HEIGHT / 2) * Math.sin(angle3)
        
        const distanceFromCenter = (y - CENTER_Y) / CENTER_Y
        const scale = 1 + (distanceFromCenter * 0.3)
        
        particle3Ref.current.style.left = `${x}px`
        particle3Ref.current.style.top = `${y}px`
        particle3Ref.current.style.transform = `rotateX(-10deg) translate(-50%, -50%) scale(${scale})`
        
        const zIndex = y < CENTER_Y ? 5 : 15
        particle3Ref.current.style.zIndex = String(zIndex)
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [])

  return (
    <div className="ai-chip-container">
      {/* Central AI Chip */}
      <div ref={chipRef} className="ai-chip">
        <div className="chip-core"></div>
        {/* Ripple waves */}
        <div className="ripple ripple-1"></div>
        <div className="ripple ripple-2"></div>
      </div>
      
      {/* Orbit 1 */}
      <div ref={orbit1Ref} className="orbit orbit-1">
        <div className="orbit-path">
          <div ref={particle1Ref} className="particle particle-1" />
        </div>
      </div>

      {/* Orbit 2 */}
      <div ref={orbit2Ref} className="orbit orbit-2">
        <div className="orbit-path">
          <div ref={particle2Ref} className="particle particle-2" />
        </div>
      </div>

      {/* Orbit 3 */}
      <div ref={orbit3Ref} className="orbit orbit-3">
        <div className="orbit-path">
          <div ref={particle3Ref} className="particle particle-3" />
        </div>
      </div>
      
      {/* Text */}
      <div className="ai-chip-text">Select a conversation to begin</div>
    </div>
  )
}