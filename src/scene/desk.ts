import gsap from 'gsap'
import {
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  Shape,
  TubeGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clamp, float, mx_noise_float, positionGeometry, smoothstep } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { Layout } from '../data/layout'
import { motion } from '../motion'
import { uniforms } from './materials'

/** The USB-C port, in the plate frame, as cut by the Blender script (2.55 cm from the left). */
export const portPosition = (layout: Layout) =>
  new Vector3(-layout.case.width / 2 + 2.55, -1.25, -(layout.case.depth / 2 - 0.17))

const WIRE_RADIUS = 0.15
const COIL_RADIUS = 0.5
const COIL_TURNS = 11
const PLUG_LENGTH = 1.6
/** How far the cable slides back, unplugged, while the board is spread apart. */
const UNPLUG_DISTANCE = 3
const MAT_THICKNESS = 0.3
/** Margin of desk mat around the case. More at the back, where the cable runs. */
const MAT_MARGIN = { side: 3.5, front: 3, back: 10 }

function cableCurve(start: Vector3) {
  const { x, z } = start
  const rest = WIRE_RADIUS
  const points = [
    start.clone(),
    new Vector3(x, start.y - 0.05, z - 1.2),
    new Vector3(x, (start.y + rest) / 2, z - 2.6),
    new Vector3(x, COIL_RADIUS + rest, z - 3.8),
  ]
  // The coil lies on the desk, its turns wound around the run of the cable.
  const coilStart = z - 4.2
  const coilLength = 5.5
  const steps = COIL_TURNS * 16
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const angle = t * COIL_TURNS * Math.PI * 2
    points.push(
      new Vector3(
        x + Math.sin(angle) * COIL_RADIUS,
        COIL_RADIUS + rest + Math.cos(angle) * COIL_RADIUS,
        coilStart - t * coilLength,
      ),
    )
  }
  const afterCoil = coilStart - coilLength
  points.push(new Vector3(x, rest + 0.35, afterCoil - 0.6), new Vector3(x, 0.55, afterCoil - 1.1))
  return { curve: new CatmullRomCurve3(points), connectorZ: afterCoil - 1.1 }
}

/**
 * The desk around the board: a coiled cable from the USB-C port and a felt desk mat. Built in
 * the world frame, so the cable lies flat on the desk whatever the board is doing.
 */
export class Desk {
  readonly group = new Group()
  readonly cable = new Group()
  readonly mat: Mesh

  constructor(layout: Layout, port: Vector3) {
    this.group.name = 'desk'

    const cableMaterial = new MeshStandardNodeMaterial({ roughness: 0.5, metalness: 0 })
    cableMaterial.colorNode = uniforms.cable
    const metal = new MeshStandardNodeMaterial({ roughness: 0.28, metalness: 1 })
    metal.colorNode = uniforms.connector

    // The plug: a small housing with its metal tongue inside the port.
    const plugCentre = port.clone().add(new Vector3(0, 0, -PLUG_LENGTH / 2 - 0.05))
    const plug = new Mesh(new RoundedBoxGeometry(1.0, 0.6, PLUG_LENGTH, 3, 0.25), cableMaterial)
    plug.position.copy(plugCentre)
    const tongue = new Mesh(new RoundedBoxGeometry(0.82, 0.26, 0.5, 2, 0.1), metal)
    tongue.position.copy(port).add(new Vector3(0, 0, 0.1))

    const { curve, connectorZ } = cableCurve(port.clone().add(new Vector3(0, 0, -PLUG_LENGTH)))
    const coiled = new Mesh(new TubeGeometry(curve, 1400, WIRE_RADIUS, 10), cableMaterial)

    // The aviator connector, where a coiled cable splits from its lead.
    const aviator = new Group()
    const body = new Mesh(new CylinderGeometry(0.42, 0.42, 1.8, 28), metal)
    const collar = new Mesh(new CylinderGeometry(0.5, 0.5, 0.45, 28), metal)
    collar.position.y = 0.55
    const boot = new Mesh(new CylinderGeometry(0.3, 0.38, 1.1, 20), cableMaterial)
    boot.position.y = -1.4
    aviator.add(body, collar, boot)
    aviator.rotation.x = Math.PI / 2
    aviator.position.set(port.x, 0.55, connectorZ - 0.9)

    // The lead runs off behind the board and fades out before it reaches the horizon.
    const leadStart = connectorZ - 2.4
    const leadMaterial = new MeshStandardNodeMaterial({
      roughness: 0.5,
      metalness: 0,
      transparent: true,
    })
    leadMaterial.colorNode = uniforms.cable
    leadMaterial.opacityNode = smoothstep(
      float(leadStart - 16),
      float(leadStart - 4),
      positionGeometry.z,
    )
    const lead = new Mesh(
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(port.x, 0.5, leadStart + 0.3),
          new Vector3(port.x, WIRE_RADIUS + 0.05, leadStart - 1.5),
          new Vector3(port.x + 0.8, WIRE_RADIUS, leadStart - 8),
          new Vector3(port.x - 0.4, WIRE_RADIUS, leadStart - 18),
        ]),
        120,
        WIRE_RADIUS * 0.9,
        8,
      ),
      leadMaterial,
    )

    this.cable.add(plug, tongue, coiled, aviator, lead)
    this.cable.visible = false

    this.mat = this.buildMat(layout)
    this.mat.visible = false
    this.group.add(this.cable, this.mat)
  }

  private buildMat(layout: Layout) {
    const { width, depth } = layout.case
    const halfW = width / 2 + MAT_MARGIN.side
    const front = depth / 2 + MAT_MARGIN.front
    const back = depth / 2 + MAT_MARGIN.back
    const r = 1.6
    const shape = new Shape()
    shape.moveTo(-halfW + r, -front)
    shape.lineTo(halfW - r, -front)
    shape.quadraticCurveTo(halfW, -front, halfW, -front + r)
    shape.lineTo(halfW, back - r)
    shape.quadraticCurveTo(halfW, back, halfW - r, back)
    shape.lineTo(-halfW + r, back)
    shape.quadraticCurveTo(-halfW, back, -halfW, back - r)
    shape.lineTo(-halfW, -front + r)
    shape.quadraticCurveTo(-halfW, -front, -halfW + r, -front)
    const geometry = new ExtrudeGeometry(shape, {
      depth: MAT_THICKNESS - 0.1,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
      curveSegments: 10,
    })
    // Shape y is toward the back, which is three.js -Z, and the top sits just under the feet.
    geometry.rotateX(-Math.PI / 2)
    // The bevel adds 0.05 above the extrusion, so this leaves the top just under the feet.
    geometry.translate(0, -(MAT_THICKNESS - 0.05) - 0.01, 0)

    const material = new MeshStandardNodeMaterial({ metalness: 0 })
    // Felt: a soft weave in the colour and almost no shine.
    const weave = mx_noise_float(positionGeometry.mul(14)).mul(0.05)
    material.colorNode = uniforms.mat.mul(clamp(weave.add(0.97), 0, 1))
    material.roughness = 0.96
    const mat = new Mesh(geometry, material)
    mat.name = 'deskMat'
    mat.renderOrder = -1
    return mat
  }

  setCable(visible: boolean) {
    this.cable.visible = visible
  }

  setMat(visible: boolean) {
    this.mat.visible = visible
  }

  /** The cable is pulled out while the board comes apart, and plugged back in after. */
  unplug(spread: boolean) {
    gsap.to(this.cable.position, {
      z: spread ? -UNPLUG_DISTANCE : 0,
      duration: motion(spread ? 0.6 : 0.8),
      delay: spread ? 0 : motion(0.6),
      ease: 'power2.inOut',
      overwrite: true,
    })
  }
}
