const { EventEmitter } = require('events')
const Queue = require('./structures/Queue')

module.exports = class GorilinkPlayer extends EventEmitter {
  constructor(node, options, manager) {
    super()

    this.manager = manager

    this.node = node
    this.guild = options.guild
    this.voiceChannel = options.voiceChannel
    this.textChannel = options.textChannel

    this.state = { volume: 100, equalizer: [] }

    this.playing = false
    this.timestamp = null
    this.paused = false
    this.track = {}
    this.voiceUpdateState = null
    this.loopedSingle = false
    this.loopedAll = false
    this.position = 0

    this.queue = new Queue()

    this.on('event', data => {
      (this.getEvent(data).bind(this))()
    }).on('playerUpdate', packet => {
      this.state = { volume: this.state.volume, equalizer: this.state.equalizer, ...packet.state }
    })
  }

  play(track, options = {}) {
    const sound = this.queue.empty ? track : this.queue.first()

    const packet = this.send('play', { ...options, track: sound.track })

    this.playing = true
    this.track = sound
    this.timestamp = Date.now()

    return packet
  }

  stop() {
    const packet = this.send('stop')

    this.playing = false
    this.timestamp = null

    return packet
  }

  pause(pause) {
    const packet = this.send('pause', { pause })
    this.paused = pause
    return packet
  }

  volume(vol) {
    const packet = this.send('volume', { volume: vol })
    this.state.volume = vol
    return packet
  }

  seek(pos) {
    return this.send('seek', { position: pos })
  }

  loopSingle(bool){
    if(this.loopedAll) this.loopedAll = false
    return this.loopedSingle = bool
  }

  loopAll(bool) {
    if(this.loopedSingle) this.loopedSingle = false
    return this.loopedAll = bool
  }

  setEQ(bands) {
    const packet = this.send('equalizer', { bands })
    this.state.equalizer = bands
    return packet
  }

  connect(data) {
    this.voiceUpdateState = data
    return this.send('voiceUpdate', data)
  }

  destroy() {
    return this.manager.leave(this.guild.id || this.guild)
  }

  getEvent(data) {
    const events = {
      'TrackStartEvent': function () {
        this.manager.emit('trackStart', { player: this, track: this.track })
      },
      'TrackEndEvent': function () {
        if (this.track && this.loopedSingle) {
          this.manager.emit('trackEnd', { player: this, track: this.track })
          return this.play()
        } else if (this.track && this.loopedAll) {
          this.manager.emit('trackEnd', { player: this, track: this.track })
          this.queue.add(this.queue.shift())
          this.play()
        } else if (this.queue.length <= 1) {
          this.queue.shift()
          this.playing = false
          if (['REPLACED', 'FINISHED', 'STOPPED'].includes(data.reason)) {
            this.manager.emit('queueEnd', { player: this })
          }
        } else if (this.queue.length > 0) {
          this.queue.shift()
          this.manager.emit('trackEnd', { player: this, track: this.track })
          return this.play()
        }
      },
      'TrackStuckEvent': function () {
        this.queue.shift()
        this.manager.emit('trackStuck', { player: this, track: this.track, data })
      },
      'TrackExceptionEvent': function () {
        this.queue.shift()
        this.manager.emit('trackError', { player: this, tracK: this.track, data })
      },
      'WebSocketClosedEvent': function () {
        if ([4015, 4009].includes(data.code)) {
          this.manager.sendWS({
            op: 4,
            d: {
              guild_id: data.guildId,
              channel_id: this.voiceChannel.id || this.voiceChannel,
              self_mute: this.options.selfMute || false,
              self_deaf: this.options.selfDeaf || false,
            },
          })
        }
        this.manager.emit('socketClosed', { player: this, data })
      },
      'default': function () { throw new Error(`Unknown event '${data}'.`) }
    }

    return events[data.type] || events['default']
  }

  send(op, data) {
    if (!this.node.connected) throw new Error('No avaliable websocket connection for this node.')
    return this.node.send({ ...data, op, guildId: this.guild })
  }
}