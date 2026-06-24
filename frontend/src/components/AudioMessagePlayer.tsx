import React, { useEffect, useRef, useState } from 'react'
import './AudioMessagePlayer.css'

type Props = {
  src: string
  className?: string
}

const BAR_COUNT = 40

function seededHeights(seed: string, count = BAR_COUNT) {
  const heights: number[] = []
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s << 5) - s + seed.charCodeAt(i)
  let state = Math.abs(s) || 1
  for (let i = 0; i < count; i++) {
    state = (state * 1664525 + 1013904223) >>> 0
    const h = 30 + (state % 70)
    heights.push(h)
  }
  return heights
}

export default function AudioMessagePlayer({ src, className = '' }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const heights = useRef<number[]>(seededHeights(src))

  useEffect(() => {
    const a = new Audio(src)
    audioRef.current = a

    const onLoaded = () => {}
    const onTime = () => setProgress((a.currentTime || 0) / (a.duration || 1))
    const onEnd = () => {
      setPlaying(false)
      setProgress(0)
    }

    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)

    return () => {
      a.pause()
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [src])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.play().catch(() => setPlaying(false))
    } else {
      a.pause()
    }
  }, [playing])

  const toggle = () => setPlaying((p) => !p)

  const filledCount = Math.round(progress * BAR_COUNT)

  return (
    <div className={`audio-player ${className}`} data-playing={playing}>
      <button className="play-btn" onClick={toggle} aria-pressed={playing} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="5" width="4" height="14" fill="currentColor" rx="1" />
            <rect x="14" y="5" width="4" height="14" fill="currentColor" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="waveform" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        {heights.current.map((h, i) => {
          const filled = i < filledCount && playing
          return (
            <div
              key={i}
              className={`wave-bar ${filled ? 'filled' : playing ? 'muted' : 'inactive'}`}
              style={{ height: `${h}%` }}
            />
          )
        })}
      </div>

      <audio src={src} hidden />
    </div>
  )
}
