import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Preloader from './Preloader'

// Logo is an SVG component — stub it out so tests don't need the asset pipeline
vi.mock('./Logo', () => ({ default: () => <svg data-testid="logo" /> }))

describe('Preloader', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the counter with loaded / total', () => {
    render(<Preloader loaded={3} total={12} onDone={vi.fn()} />)
    expect(screen.getByText('3 / 12')).toBeInTheDocument()
  })

  it('updates counter as loaded increases', () => {
    const { rerender } = render(<Preloader loaded={0} total={12} onDone={vi.fn()} />)
    expect(screen.getByText('0 / 12')).toBeInTheDocument()
    rerender(<Preloader loaded={7} total={12} onDone={vi.fn()} />)
    expect(screen.getByText('7 / 12')).toBeInTheDocument()
  })

  it('does not render counter when total is 0', () => {
    render(<Preloader loaded={0} total={0} onDone={vi.fn()} />)
    expect(screen.queryByText(/\//)).not.toBeInTheDocument()
  })

  it('calls onDone after FADE_DURATION when loaded >= total', () => {
    const onDone = vi.fn()
    render(<Preloader loaded={12} total={12} onDone={onDone} />)
    expect(onDone).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(550) })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('does not call onDone before FADE_DURATION elapses', () => {
    const onDone = vi.fn()
    render(<Preloader loaded={12} total={12} onDone={onDone} />)
    act(() => { vi.advanceTimersByTime(400) })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('calls onDone after 8s timeout even if assets never finish', () => {
    const onDone = vi.fn()
    render(<Preloader loaded={0} total={12} onDone={onDone} />)
    act(() => { vi.advanceTimersByTime(8000 + 550) })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('does not call onDone twice when both counter and 8s timeout fire', () => {
    const onDone = vi.fn()
    render(<Preloader loaded={12} total={12} onDone={onDone} />)
    // Counter triggers first
    act(() => { vi.advanceTimersByTime(8000 + 550) })
    // 8s timeout also fires — doneRef guard should prevent second call
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('adds preloader--fade class when loaded reaches total', () => {
    const { container, rerender } = render(<Preloader loaded={11} total={12} onDone={vi.fn()} />)
    const el = container.firstChild
    expect(el).not.toHaveClass('preloader--fade')
    rerender(<Preloader loaded={12} total={12} onDone={vi.fn()} />)
    expect(el).toHaveClass('preloader--fade')
  })
})
