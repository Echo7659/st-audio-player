// bramble-music-player
// 通用音频播放器（支持：单 URL、歌单、按进度自动切歌）
(() => {
  const ROOT_ID = 'st-audio-player-root'
  const STYLE_ID = 'st-audio-player-style'

  const parentWindow = window.parent && window.parent !== window ? window.parent : window
  const parentDoc = parentWindow && parentWindow.document ? parentWindow.document : null
  if (!parentDoc) return
  if (parentDoc.getElementById(ROOT_ID)) return

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
  const toNumber = (v, d = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }
  const toBoolean = (v, d = false) => (typeof v === 'boolean' ? v : d)
  const pick = (obj, path) => {
    if (!obj || typeof obj !== 'object') return undefined
    if (!path || typeof path !== 'string') return undefined
    return path.split('.').reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) return acc[key]
      return undefined
    }, obj)
  }
  const formatTime = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00'
    const s = Math.floor(sec)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }

  const getScriptVars = () => {
    try {
      if (typeof window.getVariables === 'function') {
        const vars = window.getVariables()
        if (vars && typeof vars === 'object') return vars
      }
    } catch (_) {}
    return {}
  }

  const getAllVars = () => {
    try {
      if (typeof window.getAllVariables === 'function') {
        const vars = window.getAllVariables()
        if (vars && typeof vars === 'object') return vars
      }
    } catch (_) {}
    return getScriptVars()
  }

  const normalizeTrack = (raw, idx) => {
    if (!raw || typeof raw !== 'object') return null
    const url = String(raw.url || '').trim()
    if (!url) return null
    return {
      url,
      title: String(raw.title || raw['歌名'] || `Track ${idx + 1}`),
      artist: String(raw.artist || raw['歌手'] || 'Unknown Artist'),
      cover: String(raw.cover || raw['封面'] || ''),
    }
  }

  const parseWorldbookMusicConfig = () => {
    try {
      const runtime = window.__TH_MUSIC_FALLBACK__
      if (!runtime || typeof runtime.normalizeWorldbookEntries !== 'function') return []
      const entries = runtime.normalizeWorldbookEntries(runtime.characterBookEntries || [])
      const entry = entries.find((it) => it && typeof it.name === 'string' && it.name.includes('[MusicConfig]'))
      if (!entry || !entry.content || !window.YAML || typeof window.YAML.parse !== 'function') return []

      const parsed = window.YAML.parse(entry.content)
      const playlists = Array.isArray(parsed && parsed.playlists) ? parsed.playlists : []
      const defaultId = String((parsed && parsed.default_playlist_id) || (playlists[0] && playlists[0].id) || '')
      const target = playlists.find((p) => String(p && p.id) === defaultId) || playlists[0]
      if (!target || !Array.isArray(target.tracks)) return []

      return target.tracks
        .map((track, idx) => normalizeTrack(track, idx))
        .filter(Boolean)
    } catch (err) {
      console.warn('[STAudioPlayer] parse worldbook music config failed:', err)
      return []
    }
  }

  const buildConfig = () => {
    const vars = getScriptVars()

    const volumeRaw = toNumber(vars.volume, 0.5)
    const volume = volumeRaw > 1 ? clamp(volumeRaw / 100, 0, 1) : clamp(volumeRaw, 0, 1)

    const fromPlaylist = Array.isArray(vars.bgm_playlist)
      ? vars.bgm_playlist.map((t, i) => normalizeTrack(t, i)).filter(Boolean)
      : []

    const fromSingle = typeof vars.bgm_url === 'string' && vars.bgm_url.trim()
      ? [normalizeTrack({
          url: vars.bgm_url,
          title: vars.bgm_title || '默认BGM',
          artist: vars.bgm_artist || 'Custom',
          cover: vars.bgm_cover || '',
        }, 0)]
      : []

    const playlist = fromPlaylist.length > 0
      ? fromPlaylist
      : (fromSingle[0] ? fromSingle : parseWorldbookMusicConfig())

    const rules = Array.isArray(vars.progress_rules)
      ? vars.progress_rules
          .map((r) => ({
            min: toNumber(r && r.min, 0),
            max: r && r.max != null ? toNumber(r.max, Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY,
            track: Math.max(0, Math.floor(toNumber(r && r.track, 0))),
          }))
          .sort((a, b) => a.min - b.min)
      : []

    return {
      playlist,
      autoplay: toBoolean(vars.autoplay, true),
      loop: toBoolean(vars.loop, true),
      volume,
      progressVar: String(vars.progress_var || 'story_progress'),
      progressPollMs: clamp(Math.floor(toNumber(vars.progress_poll_ms, 1500)), 500, 10000),
      progressRules: rules,
      autoSwitch: toBoolean(vars.auto_switch_by_progress, rules.length > 0),
      switchKeepPlaying: toBoolean(vars.switch_keep_playing, true),
    }
  }

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
    #${ROOT_ID} .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    }
    #${ROOT_ID} .title { font-size: 14px; font-weight: 700; }
    #${ROOT_ID} .close {
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      font-size: 16px;
    }
    #${ROOT_ID} .body { padding: 12px; }
    #${ROOT_ID} .row { margin-bottom: 10px; }
    #${ROOT_ID} .song {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${ROOT_ID} .artist {
      font-size: 12px;
      color: #cbd5e1;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${ROOT_ID} .debug {
      margin-top: 4px;
      font-size: 11px;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${ROOT_ID} .controls {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    #${ROOT_ID} button.btn {
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 8px;
      background: rgba(30, 41, 59, 0.8);
      color: #e5e7eb;
      padding: 7px 8px;
      cursor: pointer;
    }
    #${ROOT_ID} button.btn:hover { background: rgba(51, 65, 85, 0.9); }
    #${ROOT_ID} .range, #${ROOT_ID} .select {
      width: 100%;
    }
    #${ROOT_ID} .range { accent-color: #38bdf8; }
    #${ROOT_ID} .select {
      background: rgba(30, 41, 59, 0.8);
      color: #e5e7eb;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 8px;
      padding: 6px;
    }
    #${ROOT_ID} .time {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 4px;
    }
    #${ROOT_ID} .muted { color: #94a3b8; font-size: 12px; }
  `
  parentDoc.head.appendChild(style)

  const root = parentDoc.createElement('div')
  root.id = ROOT_ID
  root.innerHTML = `
    <div class="head">
      <div class="title">通用音频播放器</div>
      <button class="close" title="关闭">×</button>
    </div>
    <div class="body">
      <div class="row">
        <div class="song" data-el="song">未加载音频</div>
        <div class="artist" data-el="artist">请在 scripts.data 中填写 bgm_url 或 bgm_playlist</div>
        <div class="debug" data-el="debug"></div>
      </div>

      <div class="row">
        <div class="controls">
          <button class="btn" data-act="prev">上一首</button>
          <button class="btn" data-act="toggle">播放</button>
          <button class="btn" data-act="next">下一首</button>
        </div>
      </div>

      <div class="row">
        <input class="range" data-el="progress" type="range" min="0" max="100" value="0" step="0.1" />
        <div class="time">
          <span data-el="ctime">00:00</span>
          <span data-el="dtime">00:00</span>
        </div>
      </div>

      <div class="row">
        <div class="muted" style="margin-bottom:4px;">歌单</div>
        <select class="select" data-el="playlist"></select>
      </div>

      <div class="row" style="margin-bottom:0;">
        <div class="muted" style="margin-bottom:4px;">音量</div>
        <input class="range" data-el="volume" type="range" min="0" max="100" value="50" step="1" />
      </div>
    </div>
  `
  parentDoc.body.appendChild(root)

  const els = {
    close: root.querySelector('.close'),
    song: root.querySelector('[data-el="song"]'),
    artist: root.querySelector('[data-el="artist"]'),
    debug: root.querySelector('[data-el="debug"]'),
    prev: root.querySelector('[data-act="prev"]'),
    toggle: root.querySelector('[data-act="toggle"]'),
    next: root.querySelector('[data-act="next"]'),
    progress: root.querySelector('[data-el="progress"]'),
    ctime: root.querySelector('[data-el="ctime"]'),
    dtime: root.querySelector('[data-el="dtime"]'),
    playlist: root.querySelector('[data-el="playlist"]'),
    volume: root.querySelector('[data-el="volume"]'),
  }

  const audio = new Audio()
  audio.preload = 'auto'
  audio.crossOrigin = 'anonymous'

  let config = buildConfig()
  let currentIndex = 0
  let dragging = false
  let isPlaying = false
  let progressTimer = null

  const renderPlaylistOptions = () => {
    els.playlist.innerHTML = ''
    config.playlist.forEach((track, idx) => {
      const opt = parentDoc.createElement('option')
      opt.value = String(idx)
      opt.textContent = track.title || `Track ${idx + 1}`
      els.playlist.appendChild(opt)
    })
    els.playlist.value = String(currentIndex)
  }

  const renderMeta = (hint) => {
    const track = config.playlist[currentIndex]
    if (!track) {
      els.song.textContent = '未配置可播放音频'
      els.artist.textContent = '请填写 bgm_url 或 bgm_playlist'
      els.debug.textContent = hint || ''
      return
    }
    els.song.textContent = track.title || `Track ${currentIndex + 1}`
    els.artist.textContent = track.artist || 'Unknown Artist'
    els.debug.textContent = hint || ''
    els.playlist.value = String(currentIndex)
  }

  const switchTrack = async (index, opts = {}) => {
    const shouldPlay = opts.play === true
    const track = config.playlist[index]
    if (!track || !track.url) return

    currentIndex = index
    audio.src = track.url
    audio.load()
    renderMeta(opts.hint)

    if (shouldPlay) {
      try {
        await audio.play()
      } catch (err) {
        console.warn('[STAudioPlayer] autoplay blocked:', err)
      }
    }
  }

  const getTrackIndexByProgress = (progress) => {
    if (!config.progressRules.length) return -1
    let picked = -1
    for (const rule of config.progressRules) {
      if (progress >= rule.min && progress <= rule.max) {
        picked = rule.track
      }
    }
    return picked
  }

  const syncByProgress = async () => {
    if (!config.autoSwitch || !config.progressRules.length || !config.playlist.length) return

    const vars = getAllVars()
    const raw = pick(vars, config.progressVar)
    const progress = toNumber(raw, NaN)
    if (!Number.isFinite(progress)) {
      renderMeta(`进度变量 ${config.progressVar} = ${String(raw)}`)
      return
    }

    const nextIndex = getTrackIndexByProgress(progress)
    if (nextIndex < 0 || nextIndex >= config.playlist.length) {
      renderMeta(`进度 ${config.progressVar}=${progress}`)
      return
    }

    renderMeta(`进度 ${config.progressVar}=${progress} -> Track ${nextIndex + 1}`)

    if (nextIndex !== currentIndex) {
      await switchTrack(nextIndex, {
        play: config.switchKeepPlaying ? isPlaying : false,
        hint: `进度 ${config.progressVar}=${progress} -> Track ${nextIndex + 1}`,
      })
    }
  }

  const refreshConfig = () => {
    const next = buildConfig()
    const oldLen = config.playlist.length
    config = next

    audio.volume = config.volume
    els.volume.value = String(Math.round(config.volume * 100))

    if (config.playlist.length !== oldLen) {
      currentIndex = clamp(currentIndex, 0, Math.max(0, config.playlist.length - 1))
      renderPlaylistOptions()
      renderMeta('配置已更新')
    }

    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    if (config.autoSwitch && config.progressRules.length > 0) {
      progressTimer = setInterval(() => {
        syncByProgress().catch((err) => {
          console.warn('[STAudioPlayer] progress switch failed:', err)
        })
      }, config.progressPollMs)
    }
  }

  const teardown = () => {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    audio.pause()
    audio.src = ''
    if (root.parentNode) root.parentNode.removeChild(root)
    if (style.parentNode) style.parentNode.removeChild(style)
  }

  els.close.addEventListener('click', teardown)

  els.toggle.addEventListener('click', async () => {
    if (!config.playlist.length) return

    if (!audio.src) {
      await switchTrack(currentIndex, { play: true, hint: els.debug.textContent || '' })
      return
    }

    if (isPlaying) {
      audio.pause()
      return
    }

    try {
      await audio.play()
    } catch (err) {
      console.warn('[STAudioPlayer] play failed:', err)
    }
  })

  els.prev.addEventListener('click', async () => {
    if (!config.playlist.length) return
    const next = (currentIndex - 1 + config.playlist.length) % config.playlist.length
    await switchTrack(next, { play: isPlaying || config.autoplay, hint: els.debug.textContent || '' })
  })

  els.next.addEventListener('click', async () => {
    if (!config.playlist.length) return
    const next = (currentIndex + 1) % config.playlist.length
    await switchTrack(next, { play: isPlaying || config.autoplay, hint: els.debug.textContent || '' })
  })

  els.playlist.addEventListener('change', async () => {
    const idx = Math.floor(toNumber(els.playlist.value, 0))
    if (idx < 0 || idx >= config.playlist.length) return
    await switchTrack(idx, { play: isPlaying || config.autoplay, hint: els.debug.textContent || '' })
  })

  els.volume.addEventListener('input', () => {
    const v = clamp(toNumber(els.volume.value, 50) / 100, 0, 1)
    audio.volume = v
  })

  els.progress.addEventListener('mousedown', () => { dragging = true })
  els.progress.addEventListener('touchstart', () => { dragging = true }, { passive: true })

  const seek = () => {
    const duration = audio.duration
    if (!Number.isFinite(duration) || duration <= 0) {
      dragging = false
      return
    }
    const p = clamp(toNumber(els.progress.value, 0) / 100, 0, 1)
    audio.currentTime = duration * p
    dragging = false
  }
  els.progress.addEventListener('mouseup', seek)
  els.progress.addEventListener('touchend', seek)
  els.progress.addEventListener('change', seek)

  audio.addEventListener('play', () => {
    isPlaying = true
    els.toggle.textContent = '暂停'
  })

  audio.addEventListener('pause', () => {
    isPlaying = false
    els.toggle.textContent = '播放'
  })

  audio.addEventListener('loadedmetadata', () => {
    els.dtime.textContent = formatTime(audio.duration)
  })

  audio.addEventListener('timeupdate', () => {
    els.ctime.textContent = formatTime(audio.currentTime)
    if (!dragging && Number.isFinite(audio.duration) && audio.duration > 0) {
      els.progress.value = String((audio.currentTime / audio.duration) * 100)
    }
  })

  audio.addEventListener('ended', async () => {
    if (!config.playlist.length) return
    if (!config.loop && currentIndex >= config.playlist.length - 1) {
      return
    }
    const next = (currentIndex + 1) % config.playlist.length
    await switchTrack(next, { play: true, hint: els.debug.textContent || '' })
  })

  // 初始化
  refreshConfig()
  renderPlaylistOptions()
  renderMeta('已加载配置')

  if (config.playlist.length > 0 && config.autoplay) {
    switchTrack(currentIndex, { play: true, hint: '自动播放' }).catch(() => {})
  }

  // 允许外部更新 scripts.data 后动态生效
  setInterval(() => {
    try {
      refreshConfig()
    } catch (_) {}
  }, 4000)

  // 首次执行一次进度切歌
  syncByProgress().catch(() => {})
})()
