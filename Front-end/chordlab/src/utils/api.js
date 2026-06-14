/**
 * Analyze a WAV audio file for chord information.
 *
 * In development, if the backend is unavailable, a mock response is returned
 * so you can work on the UI without a running server.
 *
 * Expected backend response shape:
 * {
 *   key: string,          // e.g. "C major"
 *   timeline: Array<{
 *     chord: string,      // e.g. "Am"
 *     start: number,      // seconds
 *     dur: number         // duration in seconds
 *   }>
 * }
 *
 * @param {File} file - WAV audio file
 * @returns {Promise<{ key: string, timeline: Array }>}
 */
export async function analyzeAudio(file) {
  const formData = new FormData()
  formData.append('audio', file)

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`)
    }

    return await response.json()
  } catch (err) {
    console.warn('[ChordLab] API unavailable, using mock data:', err.message)
    return getMockResponse()
  }
}

/**
 * Mock response for development / testing.
 * Replace with real API calls once the backend is ready.
 */
function getMockResponse() {
  return {
    key: 'C major',
    tuning: {                   
      a4_hz: 441.23,
      tuning_offset_cents: 4.8,
      status: 'sharp',
      status_text: '偏高 4.8 cents',
    },
    timeline: [
      { chord: 'C', start: 0.0, dur: 2.1 },
      { chord: 'Am', start: 2.1, dur: 2.0 },
      { chord: 'F', start: 4.1, dur: 2.2 },
      { chord: 'G', start: 6.3, dur: 2.0 },
      { chord: 'C', start: 8.3, dur: 1.8 },
      { chord: 'Em', start: 10.1, dur: 1.9 },
      { chord: 'Fmaj7', start: 12.0, dur: 2.1 },
      { chord: 'G7', start: 14.1, dur: 2.0 },
      { chord: 'C', start: 16.1, dur: 2.0 },
      { chord: 'Dm', start: 18.1, dur: 2.1 },
      { chord: 'G', start: 20.2, dur: 1.9 },
      { chord: 'C', start: 22.1, dur: 1.9 },
      { chord: 'Am', start: 24.0, dur: 2.0 },
      { chord: 'F', start: 26.0, dur: 2.0 },
      { chord: 'C/E', start: 28.0, dur: 1.8 },
      { chord: 'G', start: 29.8, dur: 2.2 },
    ],
  }
}
