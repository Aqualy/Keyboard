import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStage } from '../state/stage'
import { OrbitHint, PartLabel, StageTools, VolumeLabel } from './StageOverlay'

describe('StageTools', () => {
  beforeEach(() => {
    useStage.setState({ mode: 'configure', soundOn: true, resetRequest: 0 })
  })

  it('toggles the exploded view and renames itself', async () => {
    render(<StageTools />)
    await userEvent.click(screen.getByRole('button', { name: 'Explode keyboard' }))
    expect(useStage.getState().mode).toBe('exploded')
    await userEvent.click(screen.getByRole('button', { name: 'Assemble keyboard' }))
    expect(useStage.getState().mode).toBe('configure')
  })

  it('requests a camera reset', async () => {
    render(<StageTools />)
    await userEvent.click(screen.getByRole('button', { name: 'Reset view' }))
    expect(useStage.getState().resetRequest).toBe(1)
  })

  it('mutes and unmutes', async () => {
    render(<StageTools />)
    await userEvent.click(screen.getByRole('button', { name: 'Mute sound' }))
    expect(useStage.getState().soundOn).toBe(false)
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeInTheDocument()
  })

  it('keeps only the sound control during a typing test', () => {
    useStage.setState({ mode: 'test' })
    render(<StageTools />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Mute sound' })).toBeInTheDocument()
  })
})

describe('OrbitHint', () => {
  it('hides after the first orbit', () => {
    useStage.setState({ mode: 'configure', hasOrbited: true })
    const { container } = render(<OrbitHint />)
    expect(container.firstChild).toHaveAttribute('data-hidden', 'true')
  })

  it('hides during a typing test', () => {
    useStage.setState({ mode: 'test', hasOrbited: false })
    const { container } = render(<OrbitHint />)
    expect(container.firstChild).toHaveAttribute('data-hidden', 'true')
  })
})

describe('PartLabel', () => {
  it('renders nothing with no part under the pointer', () => {
    useStage.setState({ hoveredPart: null })
    const { container } = render(<PartLabel />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the part at the pointer', () => {
    useStage.setState({ hoveredPart: { label: 'PCB', x: 10, y: 20 } })
    render(<PartLabel />)
    expect(screen.getByRole('status')).toHaveTextContent('PCB')
  })
})

describe('VolumeLabel', () => {
  it('shows the volume only while the knob turns', () => {
    useStage.setState({ volume: 0.65, volumeLabel: null })
    const { rerender } = render(<VolumeLabel />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    useStage.setState({ volumeLabel: { x: 5, y: 5 } })
    rerender(<VolumeLabel />)
    expect(screen.getByRole('status')).toHaveTextContent('Volume 65%')
  })
})
