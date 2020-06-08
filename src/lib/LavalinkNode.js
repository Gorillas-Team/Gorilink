const WebSocket = require('ws')

module.exports = class LavalinkNode {
  constructor(manager, options = {}) {
    this.manager = manager
    this.tag = options.tag || null
    Object.defineProperty(this, 'host', { value: options.host || '127.0.0.1', enumerable: false })
    Object.defineProperty(this, 'port', { value: options.port || 2333, enumerable: false })
    Object.defineProperty(this, 'password', { value: options.password || 'youshallnotpass', enumerable: false })
    this.ws = null
    this.reconnectInterval = options.reconnectInterval || 5000

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

    this.connected = false
  }

  connect() {
    if (this.ws) this.ws.close()

    const headers = {
      Authorization: this.password,
      'Num-Shards': String(this.manager.shards || 1),
      'User-Id': this.manager.user
    }

    this.ws = new WebSocket(`ws:${this.host}:${this.port}/`, { headers })

    this.ws.on('open', this.onOpen.bind(this))
    this.ws.on('error', this.onError.bind(this))
    this.ws.on('message', this.onMessage.bind(this))
    this.ws.on('close', this.onClose.bind(this))
  }

  onOpen() {
    if (this._reconnect) clearTimeout(this._reconnect)
    this.manager.emit('nodeConnect', this)
    this.connected = true
  }

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

  onClose(event) {
    this.manager.emit('nodeClose', { event, node: this })

    if (event.code != null || event.reason != 'destroy') return this.reconnect()
  }

  onError(event) {
    const err = event && event.error ? event.error : event

    if (!event) return

    this.manager.emit('nodeError', { node: this, err })

    return this.reconnect()
  }

  reconnect() {
    this._reconnect = setTimeout(() => {
      this.ready = false
      this.ws.removeAllListeners()
      this.ws = null

      this.manager.emit('nodeReconnect', this)
      this.connect()

    }, this.reconnectInterval)
  }

  destroy() {
    this.ws.close(1000, 'destroy')
    this.ws = null

    return true
  }

  async send(data) {
    const packet = JSON.stringify(data)

    if (!this.connected) return

    return await this.ws.send(packet, err => {
      if (err) throw err
    })
  }
}
