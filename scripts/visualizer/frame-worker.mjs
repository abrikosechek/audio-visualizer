// Node worker_thread: draws video frames in parallel for render.mjs.
// init: { opts } → creates a drawer.  frame: { f, levels, buf } → draws into buf and transfers it back.

import { parentPort, workerData } from 'node:worker_threads'
import { createDrawer } from './draw.mjs'

const drawer = createDrawer(workerData)

parentPort.on('message', ({ f, levels, buf }) => {
  drawer.draw(new Uint8Array(buf), levels, f)
  parentPort.postMessage({ f, buf }, [buf])
})
