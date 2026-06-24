import React from 'react'
import AudioMessagePlayer from './AudioMessagePlayer'

export default function AudioMessagePlayerExample() {
  return (
    <div style={{ padding: 20, background: 'var(--bg)', minHeight: 120 }}>
      <h4 style={{ margin: '0 0 12px 0' }}>Audio message demo</h4>
      <AudioMessagePlayer src="/sample-audio/voice-sample.mp3" />
    </div>
  )
}
