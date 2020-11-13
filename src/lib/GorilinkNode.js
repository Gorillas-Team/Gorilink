const WebSocket = require('ws')

/**
 * Represents a Lavalink node instance
 */
class GorilinkNode {

  /**
   * The constructor of the LavalinkNode
   * @param {GorilinkManager} manager manager of lavalink node
   * @param {Object} options options of the lavalink node
   */
  constructor(manager, options = {}) {
    /**
     * GorilinkManager instance
     * @type {GorilinkManager}
     */
    this.manager = manager

    /**
     * Name of node
     * @type {String}
     */
    this.tag = options.tag || null

    /**
     * Node host
     * @type {String}
     */
    Object.defineProperty(this, 'host', { value: options.host || '127.0.0.1' })

    /**
     * Node port
     * @type {Number}
     */
    Object.defineProperty(this, 'port', { value: options.port || 2333 })

    /**
     * Node password
     * @type {String}
     */
    Object.defineProperty(this, 'password', { value: options.password || 'youshallnotpass' })

    /**
     * Client WebSocket connection
     * @type {WebSocket}
     */
    this.ws = null

    /**
     * Reconnection attempt time with the node
     * @type {Number}
     */
    this.reconnectInterval = options.reconnectInterval || 5000

    /**
     * The resume key of the session
     * @type {String}
     */
    this.resumeKey = options.resumeKey || null

    /**
     * Number of seconds after disconnecting before the session is closed anyways.
     * @type {Number}
     */
    Object.defineProperty(this, '_resumeTimeout', { value: options.resumeTimeout || 60, writable: true })

    /**
     * Queue of packets not send when the node is discornnected
     * @type {Array}
     */
    Object.defineProperty(this, '_queue', { value: [], writable: true })

    /**
     * Stats of lavalink node
     * @type {Object}
     */
    this.stats = {
      players: 0,
      playingPlayers: 0,
      uptime: 0,
      memory: {
        free: 0,
        used: 0,
        allocated: 0,
        reservable: 0
      },
      cpu: {
        cores: 0,
        systemLoad: 0,
        lavalinkLoad: 0
      }
    }

    /**
     * State of connection with node
     * @type {Boolean}
     */
    this.connected = false
  }

  /**
   * Connects the node to Lavalink
   */
  connect() {
    if (this.ws) this.ws.close()

    const headers = {
      Authorization: this.password,
      'Num-Shards': String(this.manager.shards || 1),
      'User-Id': this.manager.user
    }

    if (this.resumeKey) headers['Resume-Key'] = this.resumeKey

    this.ws = new WebSocket(`ws:${this.host}:${this.port}/`, { headers })

    this.ws.on('open', this.onOpen.bind(this))
    this.ws.on('error', this.onError.bind(this))
    this.ws.on('message', this.onMessage.bind(this))
    this.ws.on('close', this.onClose.bind(this))
  }

  /**
   * A private function for handling the open event from WebSocket
   */
  onOpen() {
    if (this._reconnect) {
      clearTimeout(this._reconnect)
      delete this._reconnect
    }

    this._queueFlush()

    if (this.resumeKey) this.configureResuming(this.resumeKey)

    /**
     * Lavalink node connect event
     * @event GorilinkManager#nodeConnect
     * @type {GorilinkNode}
     */
    this.manager.emit('nodeConnect', this)
    this.connected = true
  }

  /**
   * Private function for handling the message event from WebSocket
   * @param data The data that come from lavalink
   */
  onMessage(data) {
    if (data instanceof Array) data = Buffer.concat(data)
    else if (data instanceof ArrayBuffer) data = Buffer.from(data)

    const packet = JSON.parse(data)

    if (packet.op && packet.op == 'stats') {
      this.stats = { ...packet }
      delete this.stats.op
    }

    const player = this.manager.players.get(packet.guildId)
    if (packet.guildId && player) player.emit(packet.op, packet)

    packet.node = this

    this.manager.emit('raw', packet)
  }

  /**
   * Private function for handling the close event from WebSocket
   * @param event WebSocket event data
   */
  onClose(event) {
    /**
     * Lavalink node close event
     * @event GorilinkManager#nodeClose
     * @property {Object} event - WebSocket event
     * @property {GorilinkNode} node - Closed lavalink node
     */
    this.manager.emit('nodeClose', event, this)

    if (event != 1000) return this.reconnect()
  }

  /**
   * Private function for handling the error event from WebSocket
   * @param event WebSocket event data
   */
  onError(event) {
    const err = event && event.error ? event.error : event

    if (!event) return

    /**
     * Lavalink node error event
     * @event GorilinkManager#nodeError
     * @property {GorilinkNode} node - Node on which the error occurred
     * @property {Object} err - Error stack
     */
    this.manager.emit('nodeError', this, err)

    return this.reconnect()
  }

  /**
   * Handles reconnecting if something happens and the node discounnects
   */
  reconnect() {
    this._reconnect = setTimeout(() => {
      this.connected = false
      this.ws.removeAllListeners()
      this.ws = null

      /**
       * Emitted when trying to reconnect with the lavalink node
       * @event GorilinkManager#nodeReconnect
       * @type {GorilinkNode}
       */
      this.manager.emit('nodeReconnect', this)
      this.connect()

    }, this.reconnectInterval)
  }

  /**
   * Destroy lavalink WebSocket connection
   * @returns {Boolean}
   */
  destroy() {
    this.ws.close(1000, 'destroy')
    this.ws = null
    this.manager.nodes.delete(this.tag || this.host)

    return true
  }

  /**
   * Configures the resuming key for the LavalinkNode
   * @param {*} key key the actual key to send to lavalink to resume with
   * @param {*} timeout timeout how long before the key invalidates and lavalinknode will stop expecting you to resume
   */
  configureResuming(key, timeout = this._resumeTimeout) {
    this.send({ op: 'configureResuming', key, timeout })
  }

  /**
   * Flushs the send queue
   */
  async _queueFlush() {
    if (this._queue.length == 0) return

    await this._queue.map(this._send.bind(this))

    this._queue = []
  }

  /**
   * Sends data to the Lavalink or push it in a queue if the node is not connected
   * @param {Object} data Data wanted to send to lavalink
   */
  send(data) {
    const packet = JSON.stringify(data)

    if (!this.connected) return this._queue.push(packet)

    return this._send(packet)
  }

  /**
   * Sends data to the Lavalink Websocket
   * @param data data to send
   */
  _send(data) {
    this.ws.send(data, err => {
      if (err) throw err
    })
  }
}

module.exports = GorilinkNode
