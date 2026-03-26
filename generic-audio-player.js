// bramble-music-player
// 通用音频播放器（测试版）
(() => {
  const ROOT_ID = 'wanjia-generic-audio-player'
  const STYLE_ID = 'wanjia-generic-audio-player-style'

  const parentWindow = window.parent && window.parent !== window ? window.parent : window
  const parentDoc = parentWindow.document

  if (!parentDoc || parentDoc.getElementById(ROOT_ID)) {
    return
  }

  const ensureStyle = () => {
    if (parentDoc.getElementById(STYLE_ID)) return
    const style = parentDoc.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 320px;
        z-index: 9999;
        background: rgba(15, 23, 42, 0.92);
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
        backdrop-filter: blur(8px);
      }
      #${ROOT_ID} * { box-sizing: border-box; }
      #${ROOT_ID} .th-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      }
      #${ROOT_ID} .th-title { font-size: 14px; font-weight: 700; }
      #${ROOT_ID} .th-close {
        border: none;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        font-size: 16px;
      }
      #${ROOT_ID} .th-body { padding: 12px; }
      #${ROOT_ID} .th-row { margin-bottom: 10px; }
      #${ROOT_ID} .th-muted { color: #94a3b8; font-size: 12px; }
      #${ROOT_ID} .th-song {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${ROOT_ID} .th-artist {
        font-size: 12px;
        color: #cbd5e1;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${ROOT_ID} .th-controls {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      #${ROOT_ID} button.th-btn {
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 8px;
        background: rgba(30, 41, 59, 0.8);
        color: #e5e7eb;
        padding: 7px 8px;
        cursor: pointer;
      }
      #${ROOT_ID} button.th-btn:hover { background: rgba(51, 65, 85, 0.9); }
      #${ROOT_ID} .th-range, #${ROOT_ID} .th-select {
        width: 100%;
      }
      #${ROOT_ID} .th-range { accent-color: #38bdf8; }
      #${ROOT_ID} .th-select {
        background: rgba(30, 41, 59, 0.8);
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 8px;
        padding: 6px;
      }
      #${ROOT_ID} .th-time {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #cbd5e1;
        margin-top: 4px;
      }
    `
    parentDoc.head.appendChild(style)
  }

  const formatSec = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00'
    const s = Math.floor(sec)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }

  const createUI = () => {
    const root = parentDoc.createElement('div')
    root.id = ROOT_ID
    root.innerHTML = `
      <div class="th-head">
        <div class="th-title">通用音频播放器</div>
        <button class="th-close" title="关闭">×</button>
      </div>
      <div class="th-body">
        <div class="th-row">
          <div class="th-song" data-el="song">未连接播放器</div>
          <div class="th-artist" data-el="artist">请确认角色卡已配置 [MusicConfig]</div>
        </div>

        <div class="th-row">
          <div class="th-controls">
            <button class="th-btn" data-act="prev">上一首</button>
            <button class="th-btn" data-act="toggle">播放</button>
            <button class="th-btn" data-act="next">下一首</button>
          </div>
        </div>

        <div class="th-row">
          <input class="th-range" data-el="progress" type="range" min="0" max="100" value="0" step="0.1" />
          <div class="th-time">
            <span data-el="ctime">00:00</span>
            <span data-el="dtime">00:00</span>
          </div>
        </div>

        <div class="th-row">
          <div class="th-muted" style="margin-bottom:4px;">歌单</div>
          <select class="th-select" data-el="playlist"></select>
        </div>

        <div class="th-row" style="margin-bottom:0;">
          <div class="th-muted" style="margin-bottom:4px;">音量</div>
          <input class="th-range" data-el="volume" type="range" min="0" max="100" value="50" step="1" />
        </div>
      </div>
    `
    parentDoc.body.appendChild(root)
    return root
  }

  const ensureApi = async () => {
    if (window.musicPlayerAPI) return window.musicPlayerAPI
    if (parentWindow.musicPlayerAPI) return parentWindow.musicPlayerAPI
    if (typeof window.waitGlobalInitialized === 'function') {
      const api = await window.waitGlobalInitialized('musicPlayerAPI')
      if (api) return api
    }
    return null
  }

  ensureStyle()
  const root = createUI()

  const elSong = root.querySelector('[data-el="song"]')
  const elArtist = root.querySelector('[data-el="artist"]')
  const elToggle = root.querySelector('[data-act="toggle"]')
  const elPrev = root.querySelector('[data-act="prev"]')
  const elNext = root.querySelector('[data-act="next"]')
  const elProgress = root.querySelector('[data-el="progress"]')
  const elPlaylist = root.querySelector('[data-el="playlist"]')
  const elVolume = root.querySelector('[data-el="volume"]')
  const elCTime = root.querySelector('[data-el="ctime"]')
  const elDTime = root.querySelector('[data-el="dtime"]')
  const elClose = root.querySelector('.th-close')

  let api = null
  let currentState = null
  let currentPlaylist = []
  let unbindState = null
  let unbindTime = null
  let dragging = false

  const renderState = (state) => {
    currentState = state || null
    const item = state && state.currentItem ? state.currentItem : null
    const song = item && item.title ? item.title : '未播放'
    const artist = item && item.artist ? item.artist : 'Unknown Artist'
    elSong.textContent = song
    elArtist.textContent = artist
    elToggle.textContent = state && state.isPlaying ? '暂停' : '播放'

    const playlist = Array.isArray(state && state.playlist) ? state.playlist : []
    currentPlaylist = playlist

    if (!dragging) {
      elPlaylist.innerHTML = ''
      playlist.forEach((track, idx) => {
        const opt = parentDoc.createElement('option')
        opt.value = String(idx)
        opt.textContent = track && track.title ? track.title : `Track ${idx + 1}`
        elPlaylist.appendChild(opt)
      })

      if (item) {
        const idx = playlist.findIndex((t) => t && t.title === item.title && t.artist === item.artist)
        if (idx >= 0) elPlaylist.value = String(idx)
      }
    }

    if (typeof state?.masterVolume === 'number' && !dragging) {
      elVolume.value = String(Math.round(Math.max(0, Math.min(1, state.masterVolume)) * 100))
    }
  }

  const renderTime = ({ currentTime, duration }) => {
    elCTime.textContent = formatSec(currentTime || 0)
    elDTime.textContent = formatSec(duration || 0)
    if (!dragging && duration && duration > 0) {
      elProgress.value = String(((currentTime || 0) / duration) * 100)
    }
  }

  const cleanup = () => {
    try { if (typeof unbindState === 'function') unbindState() } catch (_) {}
    try { if (typeof unbindTime === 'function') unbindTime() } catch (_) {}
    unbindState = null
    unbindTime = null
    if (root && root.parentNode) root.parentNode.removeChild(root)
  }

  elClose.addEventListener('click', cleanup)
  window.addEventListener('beforeunload', cleanup)

  elToggle.addEventListener('click', async () => {
    if (!api) return
    try {
      await api.togglePlayPause()
    } catch (err) {
      console.error('[GenericPlayer] togglePlayPause failed:', err)
    }
  })

  elPrev.addEventListener('click', async () => {
    if (!api) return
    try {
      await api.playPrev()
    } catch (err) {
      console.error('[GenericPlayer] playPrev failed:', err)
    }
  })

  elNext.addEventListener('click', async () => {
    if (!api) return
    try {
      await api.playNext()
    } catch (err) {
      console.error('[GenericPlayer] playNext failed:', err)
    }
  })

  elPlaylist.addEventListener('change', async () => {
    if (!api) return
    const idx = Number(elPlaylist.value)
    if (!Number.isInteger(idx) || idx < 0 || idx >= currentPlaylist.length) return
    try {
      await api.playIndex(idx)
    } catch (err) {
      console.error('[GenericPlayer] playIndex failed:', err)
    }
  })

  elVolume.addEventListener('input', () => {
    if (!api) return
    const v = Math.max(0, Math.min(100, Number(elVolume.value) || 0)) / 100
    try {
      if (typeof api.setLiveVolume === 'function') {
        api.setLiveVolume(v)
      } else if (typeof api.persistVolumeAndBroadcast === 'function') {
        api.persistVolumeAndBroadcast(v)
      }
    } catch (err) {
      console.error('[GenericPlayer] set volume failed:', err)
    }
  })

  elProgress.addEventListener('mousedown', () => { dragging = true })
  elProgress.addEventListener('touchstart', () => { dragging = true }, { passive: true })

  const commitSeek = () => {
    if (!api) return
    const p = Math.max(0, Math.min(100, Number(elProgress.value) || 0)) / 100
    try {
      if (typeof api.seekTo === 'function') api.seekTo(p)
    } catch (err) {
      console.error('[GenericPlayer] seek failed:', err)
    } finally {
      dragging = false
    }
  }

  elProgress.addEventListener('change', commitSeek)
  elProgress.addEventListener('mouseup', commitSeek)
  elProgress.addEventListener('touchend', commitSeek)

  ;(async () => {
    api = await ensureApi()

    if (!api) {
      elSong.textContent = '未发现 musicPlayerAPI'
      elArtist.textContent = '请确认脚本名含“音乐播放器”且世界书有 [MusicConfig]'
      return
    }

    try {
      if (typeof api.requestInitialization === 'function') {
        await api.requestInitialization()
      }
      if (typeof api.getCurrentState === 'function') {
        renderState(api.getCurrentState())
      }
      if (typeof api.onFullStateUpdate === 'function') {
        unbindState = api.onFullStateUpdate(renderState)
      }
      if (typeof api.onTimeUpdate === 'function') {
        unbindTime = api.onTimeUpdate(renderTime)
      }
      elSong.textContent = '播放器已连接'
      elArtist.textContent = '可直接点击播放测试'
    } catch (err) {
      console.error('[GenericPlayer] init failed:', err)
      elSong.textContent = '播放器初始化失败'
      elArtist.textContent = String(err)
    }
  })()
})()
