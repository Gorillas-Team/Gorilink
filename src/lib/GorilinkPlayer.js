const { EventEmitter } = require('events')
const Queue = require('./structures/Queue')

/**
 * Represents a guild Player instance
 * @extends EventEmitter
 */
class GorilinkPlayer extends EventEmitter {
  /**
   * The constructor of GorilinkPlayer
   * @param {GorilinkNode} node Your node instance
   * @param {Object} options Player options
   * @param {GorilinkManager} manager Your GorilinkManager instance
   */
  constructor(node, options, manager) {
    super()

    /**
     * {@link GorilinkManager} instance
     */
    this.manager = manager

    /**
     * {@link GorilinkNode} instance
     */
    this.node = node

    /**
     * Player guild id
     * @type {String | Guild}
     */
    this.guild = options.guild.id || options.guild

    /**
     * Player voiceChannel id
     * @type {String | VoiceChannel}
     */
    this.voiceChannel = options.voiceChannel.id || options.voiceChannel

    /**
     * Player textChannel
     * @type {?TextChannel}
     */
    this.textChannel = options.textChannel || null

    /**
     * Player states
     * @type {Object}
     */
    this.state = { volume: 100, equalizer: [] }

    /**
     * Player playing status
     * @type {Boolean}
     */
    this.playing = false

    /**
     * Created on method play is called
     * @type {Number}
     */
    this.timestamp = null

    /**
     * Player paused status
     * @type {Boolean}
     */
    this.paused = false

    /**
     * Player current track
     * @type {Object}
     */
    this.track = {}

    /**
     * Player voice state
     * @type {Object}
     */
    this.voiceUpdateState = null

    /**
     * Player looped status
     * @type {Number}
     */
    this.looped = 0

    /**
     * Player current track position
     * @type {Number}
     */
    this.position = 0

    /**
     * Create a Queue instance
     * @type {Queue}
     */
    this.queue = new Queue()

    this.on('event', data => {
      (this.getEvent(data).bind(this))()
    }).on('playerUpdate', packet => {
      this.state = { volume: this.state.volume, equalizer: this.state.equalizer, ...packet.state }
    })
  }

  /**
   * Plays a specific song based on Lavalink base64 string
   * @param {String} track Track base64 will be played
   * @param {Object} options Play options
   */
  play(track, options = {}) {
    const sound = this.queue.empty ? track : this.queue.first()

    const packet = this.send('play', { ...options, track: sound.track })

    this.playing = true
    this.track = sound
    this.timestamp = Date.now()

    return packet
  }

  /**
   * Send stop operation to Lavalink Node
   */
  stop() {
    const packet = this.send('stop')

    this.playing = false
    this.timestamp = null

    return packet
  }

  /**
   * Send pause operation to Lavalink Node
   * @param {Boolean} pause Pause state
   */
  pause(pause) {
    const packet = this.send('pause', { pause })
    this.paused = pause
    return packet
  }

  /**
   * Send volume operation to Lavalink Node
   * @param {Number} vol Volume to be set
   */
  volume(vol) {
    const packet = this.send('volume', { volume: vol })
    this.state.volume = vol
    return packet
  }

  /**
   * Send seek operation to Lavalink Node
   * @param {Number} pos Position to be set
   */
  seek(pos) {
    return this.send('seek', { position: pos })
  }

  /**
   * Set a loop to player
   * * `0` off
   * * `1` loop single
   * * `2` loop all
   * @param {Number} op Number of operation
   */
  loop(op) {
    if (op >= 2 && op <= 0 && !isNaN(op)) throw Error('Invalid op.')
    return this.looped = op
  }

  /**
   * Send equalizer operation to Lavalink Node
   * @param {Array} bands Equalizer bands
   */
  setEQ(bands) {
    const packet = this.send('equalizer', { bands })
    this.state.equalizer = bands
    return packet
  }

  /**
   * Connects in voiceChannel
   * @param {Object} data Discord packet
   */
  connect(data) {
    this.voiceUpdateState = data
    return this.send('voiceUpdate', data)
  }

  /**
   * Destroys the guild player
   */
  destroy() {
    return this.manager.leave(this.guild.id || this.guild)
  }

  /**
   * Handle events cames from Lavalink WebSocket connection
   * @param {Object} data Lavalink packet
   */
  getEvent(data) {
    const events = {
      'TrackStartEvent': function () {
        /**
         * Emitted when the player track starts
         * @event GorilinkManager#trackStart
         * @property {GorilinkPlayer} player - Player started to play
         * @property {Object} track - Track data
         */
        this.manager.emit('trackStart', this, this.track)
      },
      'TrackEndEvent': function () {
        /**
         * Emitted when the player track ends
         * @event GorilinkManager#trackEnd
         * @property {GorilinkManager} player - Player ended the track
         * @property {Object} track - Track data
         */
        if (this.track && this.looped == 1) {
          this.manager.emit('trackEnd', this, this.track)
          return this.play()
        } else if (this.track && this.looped == 2) {
          this.manager.emit('trackEnd', this, this.track)
          this.queue.add(this.queue.shift())
          return this.play()
        } else if (this.queue.length <= 1) {
          this.queue.shift()
          this.playing = false
          if (['REPLACED', 'FINISHED', 'STOPPED'].includes(data.reason)) {
            /**
             * Emitted when the player queue ends
             * @event GorilinkManager#queueEnd
             * @property {GorilinkManager} player - Player where the queue ended
             */
            this.manager.emit('queueEnd', this)
          }
        } else if (this.queue.length > 0) {
          this.queue.shift()
          this.manager.emit('trackEnd', this, this.track)
          return this.play()
        }
      },
      'TrackStuckEvent': function () {
        this.queue.shift()
        /**
         * Emitted when events TrackStuckEvent comes from Lavalink node
         * @event GorilinkManager#trackStuck
         * @property {GorilinkPlayer} player - Player who emitted the event
         * @property {Object} track - Track data
         * @property {Object} data - Lavalink node packet data
         */
        this.manager.emit('trackStuck', this, this.track, data)
      },
      'TrackExceptionEvent': function () {
        this.queue.shift()
        /**
         * Emitted when events on a track received an error
         * @event GorilinkManager#trackError
         * @property {GorilinkPlayer} player - Player who error as ocurred
         * @property {Object} track - Track data
         * @property {Object} data - Lavalink node packet data
         */
        this.manager.emit('trackError', this, this.track, data)
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

        /**
         * Emitted when events TrackStuckEvent comes from Lavalink node
         * @event GorilinkManager#socketClosed
         * @property {GorilinkPlayer} player - Player in which the connection to the Discord was closed
         * @property {Object} data - Lavalink node packet data
         */
        this.manager.emit('socketClosed', this, data)
      },
      'default': function () { throw new Error(`Unknown event '${data}'.`) }
    }

    return events[data.type] || events['default']
  }

  /**
   * Send packets to Lavalink Node
   * @param {String} op Operation string
   * @param {Object} data Packet data
   */
  send(op, data) {
    if (!this.node.connected) throw new Error('No avaliable websocket connection for this node.')
    return this.node.send({ ...data, op, guildId: this.guild })
  }
}

module.exports = GorilinkPlayer
