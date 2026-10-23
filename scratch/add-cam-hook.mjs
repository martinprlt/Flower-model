import { readFileSync, writeFileSync } from 'node:fs'

const norm = (s) => s.replace(/\r\n/g, '\n')

// 1. Update CameraRig.tsx to expose __ROSE_CAMERA__
let camRig = norm(readFileSync('src/components/Scene/CameraRig.tsx', 'utf8'))
const targetSpot = '    controls.update()\n  }, [bounds, camera, controls, size.width, size.height]'
const newSpot = `    controls.update()

    ;(window as unknown as Record<string, unknown>).__ROSE_CAMERA__ = {
      setAngles: (azDeg: number, elDeg: number) => {
        touched.current = true
        omega.current = 0
        const az = (azDeg * Math.PI) / 180
        const el = (elDeg * Math.PI) / 180
        const d = f.distance
        camera.position.set(
          f.target[0] + d * Math.cos(el) * Math.sin(az),
          targetY + d * Math.sin(el),
          f.target[2] + d * Math.cos(el) * Math.cos(az)
        )
        camera.lookAt(f.target[0], targetY, f.target[2])
        controls.target.set(f.target[0], targetY, f.target[2])
        controls.update()
      },
    }
  }, [bounds, camera, controls, size.width, size.height]`

if (camRig.includes(targetSpot)) {
  camRig = camRig.replace(targetSpot, newSpot)
  writeFileSync('src/components/Scene/CameraRig.tsx', camRig, 'utf8')
  console.log('CameraRig.tsx updated with __ROSE_CAMERA__!')
}

// 2. Update App.tsx for skip support
let app = norm(readFileSync('src/App.tsx', 'utf8'))
const oldAppInit = `      getRose(quality.tier)
      timeline.now = performance.now()
      timeline.phase = 'INTRO'
      timeline.enteredAt = timeline.now
      setReady(true)
      setPhase('INTRO')`

const newAppInit = `      getRose(quality.tier)
      timeline.now = performance.now()
      const url = new URLSearchParams(window.location.search)
      const skip = url.get('skip') === 'true'
      if (skip) {
        timeline.phase = 'INTERACTIVE'
        timeline.enteredAt = timeline.now - schedule.grow - 10000
        setReady(true)
        setPhase('INTERACTIVE')
        setShowDedication(true)
      } else {
        timeline.phase = 'INTRO'
        timeline.enteredAt = timeline.now
        setReady(true)
        setPhase('INTRO')
      }`

if (app.includes(oldAppInit)) {
  app = app.replace(oldAppInit, newAppInit)
  writeFileSync('src/App.tsx', app, 'utf8')
  console.log('App.tsx updated with skip support!')
}
