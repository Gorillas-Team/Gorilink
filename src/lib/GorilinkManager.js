const { EventEmitter } = require('events')
const LavalinkNode = require('./LavalinkNode')
const GorilinkPlayer = require('./GorilinkPlayer')
const Collection = require('@discordjs/collection')

const fetch = require('node-fetch')

module.exports = class GorilinkManager extends EventEmitter {
  constructor(client, nodes, options = {}) {
    super()

    if (!client) throw new Error('Invalid client provide')

    this.client = client

    this.nodes = new Collection()
    this.players = new Collection()
    this.voiceStates = new Collection()
    this.voiceServers = new Collection()

    this.user = options.user || client.user.id
    this.shards = options.shards || 0

    this.Player = options.Player || GorilinkPlayer

    for (const node of nodes) this.createNode(node)

    this.client.on('raw', packet => {
      if (packet.t == 'VOICE_SERVER_UPDATE') this.voiceServersUpdate(packet.d)
      if (packet.t == 'VOICE_STATE_UPDATE') this.voiceStateUpdate(packet.d)
    })
  }

  createNode(options) {
    const node = new LavalinkNode(this, options)
    this.nodes.set(options.tag || options.host, node)

    node.connect()

    return node
  }

  join(data = {}, options = {}) {
    const player = this.players.get(data.guild)
    if (player) return player
    this.sendWS({
      op: 4,
      d: {
        guild_id: data.guild,
        channel_id: data.voiceChannel.id || data.voiceChannel,
        self_mute: options.selfMute || false,
        self_deaf: options.selfDeaf || false
      }
    })
    return this.spawnPlayer(data)
  }

  leave(guild) {
    this.sendWS({
      op: 4,
      d: {
        guild_id: guild,
        channel_id: null,
        self_mute: false,
        self_deaf: false
      }
    })

    const player = this.players.get(guild)
    if (!player) throw false

    player.removeAllListeners()
    player.send('destroy')

    return this.players.delete(guild)
  }

  voiceServersUpdate(data) {
    this.voiceServers.set(data.guild_id, data)
    return this._attemptConnection(data.guild_id)
  }

  voiceStateUpdate(data) {
    if (data.user_id != this.user) return

    if (data.channel_id) {
      this.voiceStates.set(data.guild_id, data)
      return this._attemptConnection(data.guild_id)
    }

    this.voiceServers.delete(data.guild_id)
    this.voiceStates.delete(data.guild_id)
  }

  _attemptConnection(guildId) {
    const server = this.voiceServers.get(guildId)
    const state = this.voiceStates.get(guildId)

    if (!server) return false

    const player = this.players.get(guildId)
    if (!player) return false

    player.connect({ sessionId: state ? state.session_id : player.voiceUpdateState.sessionId, event: server })
    return true
  }

  get idealNodes() {
    return [...this.nodes.values()]
      .filter(node => node.connected)
      .sort((a, b) => {
        const aLoad = a.stats.cpu ? a.stats.cpu.systemLoad / a.stats.cpu.cores * 100 : 0
        const bLoad = b.stats.cpu ? b.stats.cpu.systemLoad / b.stats.cpu.core * 100 : 0
        return aLoad - bLoad
      })
  }

  spawnPlayer(data) {
    const has = this.nodes.get(data.guild)
    if (has) return has

    const node = this.nodes.get(this.idealNodes[0].tag || this.idealNodes[0].host)
    if (!node) throw Error('No nodes avalible')

    const player = new this.Player(node, data, this)
    this.players.set(data.guild, player)

    return player
  }

  async fetchTracks(query, source) {
    const node = this.idealNodes[0]

    if (!/^https?:\/\//.test(query)) {
      query = `${source || 'yt'}search:${query}`
    }

    const params = new URLSearchParams({ identifier: query })

    return fetch(`http://${node.host}:${node.port}/loadtracks?${params}`, {
      headers: {
        Authorization: node.password
      }
    }).then(res => res.json())
      .catch(error => { throw error })
  }

  sendWS(data) {
    const guild = this.client.guilds.cache.get(data.d.guild_id)
    if (!guild) return

    return guild.shard.send(data)
  }
}
