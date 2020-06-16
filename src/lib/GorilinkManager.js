const { EventEmitter } = require('events')
const LavalinkNode = require('./LavalinkNode')
const GorilinkPlayer = require('./GorilinkPlayer')
const Collection = require('@discordjs/collection')

const fetch = require('node-fetch')
/**
 * Main library class in which all events and operations for nodes and players are managed
 * @extends EventEmitter
 */
module.exports = class GorilinkManager extends EventEmitter {
  /**
   * The constructor of the Manager
   * @param {Client} client Discord client
   * @param {Array} nodes A Array of options that the {@link GorilinkManager} will connect
   * @param {Object} options The options for the Manager
   */
  constructor(client, nodes, options = {}) {
    super()

    if (!client) throw new Error('Invalid client provide')

    /**
     * Discord Client
     * @type {Client}
     */
    this.client = client

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of Lavalink Nodes {@link LavalinkNode}
     */
    this.nodes = new Collection()

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of GorilinkPlayer {@link GorilinkPlayer}
     */
    this.players = new Collection()

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of Voice States
     */
    this.voiceStates = new Collection()

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of Voice Servers
     */
    this.voiceServers = new Collection()

    /**
     * Discord Client user id
     */
    this.user = options.user || client.user.id

    /**
     * Total of Discord Client  shards
     */
    this.shards = options.shards || 0

    /**
     * A instance of Gorilink player used to create new players
     */
    this.Player = options.Player || GorilinkPlayer

    for (const node of nodes) this.createNode(node)

    this.client.on('raw', packet => {
      if (packet.t == 'VOICE_SERVER_UPDATE') this.voiceServersUpdate(packet.d)
      if (packet.t == 'VOICE_STATE_UPDATE') this.voiceStateUpdate(packet.d)
    })
  }

  /**
   * Creates a node instance
   * @param {Object} options Options of the lavalink node
   * @returns {LavalinkNode} Lavalink node
   */
  createNode(options) {
    const node = new LavalinkNode(this, options)
    this.nodes.set(options.tag || options.host, node)

    node.connect()

    return node
  }

  /**
   * Joins on guild channel
   * @param {Object} data Guild and voice channel data
   * @param {Object} options Self mute and self deaf options
   * @returns {GorilinkPlayer} Guild player
   */
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

  /**
   * Leave from voice channel of the guild
   * @param {String} guild Guild id you want to leave
   * @returns {GorilinkPlayer} Deleted player
   */
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

  /**
   * For handling voiceServerUpdate
   * @param {Object} data The data directly from discord
   */
  voiceServersUpdate(data) {
    this.voiceServers.set(data.guild_id, data)
    return this._attemptConnection(data.guild_id)
  }

  /**
   * For handling voiceStateUpdate
   * @param {Object} data The data directly from discord
   */
  voiceStateUpdate(data) {
    if (data.user_id != this.user) return

    if (data.channel_id) {
      this.voiceStates.set(data.guild_id, data)
      return this._attemptConnection(data.guild_id)
    }

    this.voiceServers.delete(data.guild_id)
    this.voiceStates.delete(data.guild_id)
  }

  /**
   * Handles the data of voiceServerUpdate & voiceStateUpdate to see if a connection
   * is possible with the data we have and if it is then make the connection to lavalink
   * @param {String} guildId The guild id that we're trying to attempt to connect to
   */
  _attemptConnection(guildId) {
    const server = this.voiceServers.get(guildId)
    const state = this.voiceStates.get(guildId)

    if (!server) return false

    const player = this.players.get(guildId)
    if (!player) return false

    player.connect({ sessionId: state ? state.session_id : player.voiceUpdateState.sessionId, event: server })
    return true
  }

  /**
   * Get the ideal node for that connection based on the stats of all connected nodes
   */
  get idealNodes() {
    return [...this.nodes.values()]
      .filter(node => node.connected)
      .sort((a, b) => {
        const aLoad = a.stats.cpu ? a.stats.cpu.systemLoad / a.stats.cpu.cores * 100 : 0
        const bLoad = b.stats.cpu ? b.stats.cpu.systemLoad / b.stats.cpu.core * 100 : 0
        return aLoad - bLoad
      })
  }

  /**
   * Creates a instance of {@link GorilinkPlayer}
   * @param {Object} data Guild data
   */
  spawnPlayer(data) {
    const has = this.nodes.get(data.guild)
    if (has) return has

    const node = this.nodes.get(this.idealNodes[0].tag || this.idealNodes[0].host)
    if (!node) throw Error('No nodes avalible')

    const player = new this.Player(node, data, this)
    this.players.set(data.guild, player)

    return player
  }

  /**
   * Fetch tracks based on query and a source
   * @param {String} query Query string you want to search
   * @param {String} source Media source
   */
  async fetchTracks(query, source) {
    const node = this.idealNodes[0]

    if (!/^https?:\/\//.test(query)) {
      query = `${source || 'yt'}search:${query}`
    }

    const params = new URLSearchParams({ identifier: query })

    return await fetch(`http://${node.host}:${node.port}/loadtracks?${params}`, {
      headers: {
        Authorization: node.password
      }
    }).then(res => res.json())
      .catch(error => { throw new Error('Fail to fetch tracks', error) })
  }

  /**
   * Send to discord WebSocket packets
   * @param {Object} data Discord packet data
   */
  sendWS(data) {
    const guild = this.client.guilds.cache.get(data.d.guild_id)
    if (!guild) return

    return guild.shard.send(data)
  }
}
