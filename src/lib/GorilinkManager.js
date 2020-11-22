const { EventEmitter } = require('events')
const GorilinkNode = require('./GorilinkNode')
const SearchResponse = require('./model/SearchResponse')
const GorilinkPlayer = require('./GorilinkPlayer')
const Collection = require('@discordjs/collection')

const fetch = require('node-fetch')

/**
 * Main library class in which all events and operations for nodes and players are managed
 * @extends EventEmitter
 */
class GorilinkManager extends EventEmitter {
  /**
   * The constructor of {@link GorilinkManager}
   * @param {Client} client Discord client
   * @param {GorilinkNode[]} nodes A Array of options that the {@link GorilinkManager} will connect
   * @param {object} options The options for the Manager
   */
  constructor(client, nodes, options = {}) {
    super()

    if (!client) throw new Error('Invalid client provide')

    /**
     * Discord Client
     */
    this.client = client

    /**
     * @private
     */
    this._nodes = nodes

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of {@link GorilinkNode}
     */
    this.nodes = new Collection()

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of {@link GorilinkPlayer}
     */
    this.players = new Collection()

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of [Voice States](https://discord.com/developers/docs/topics/gateway#voice-state-update)
     */
    this.voiceStates = new Collection()

    /**
     * A [**Collection**](https://github.com/discordjs/collection) of [Voice Servers](https://discord.com/developers/docs/topics/gateway#voice-server-update)
     */
    this.voiceServers = new Collection()

    /**
     * Discord Client user id
     */
    this.user = null

    /**
     * Total of Discord Client  shards
     */
    this.shards = options.shards || 0

    /**
     * A instance of Gorilink player used to create new players
     */
    this.Player = options.Player || GorilinkPlayer

    /**
     * Sets Discord WebSocket send method
     * @type {function}
     */
    this.sendWS = options.sendWS
  }

  /**
   * Creates a node instance
   * @param {object} options Options of the lavalink node
   * @returns {GorilinkNode} Lavalink node
   */
  createNode(options) {
    const node = new GorilinkNode(this, options)
    this.nodes.set(options.tag || options.host, node)

    node.connect()

    return node
  }

  /**
   * Joins on guild channel
   * @param {IJoinData} data Guild and voice channel data
   * @param {IJoinOptions} options Self mute and self deaf options
   * @returns {GorilinkPlayer} Guild player
   */
  join(data = {}, options = {}) {
    const player = this.players.get(data.guild.id || data.guild)
    if (player) return player

    this.sendWS({
      op: 4,
      d: {
        guild_id: data.guild.id || data.guild,
        channel_id: data.voiceChannel.id || data.voiceChannel,
        self_mute: options.selfMute || false,
        self_deaf: options.selfDeaf || false
      }
    })
    return this.spawnPlayer(data)
  }

  /**
   * Set user id
   * @param {string} id
   */
  start(id) {
    this.user = id
    for (const node of this._nodes) this.createNode(node)
  }

  /**
   * Leave from voice channel of the guild
   * @param {string} guild Guild id you want to leave
   * @returns {GorilinkPlayer} Deleted player
   */
  leave(guild) {
    this.sendWS({
      op: 4,
      d: {
        guild_id: guild.id || guild,
        channel_id: null,
        self_mute: false,
        self_deaf: false
      }
    })

    const player = this.players.get(guild)
    if (!player) return false

    player.removeAllListeners()
    player.send('destroy')

    return this.players.delete(guild)
  }

  /**
   * For handling voiceServerUpdate
   * @param {object} data The data directly from discord
   */
  voiceServersUpdate(data) {
    this.voiceServers.set(data.guild_id, data)
    return this._attemptConnection(data.guild_id)
  }

  /**
   * For handling voiceStateUpdate
   * @param {object} data The data directly from discord
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
   * Updates manager states
   * @param {} packet
   */
  packetUpdate(packet) {
    if (packet.t == 'VOICE_SERVER_UPDATE') this.voiceServersUpdate(packet.d)
    if (packet.t == 'VOICE_STATE_UPDATE') this.voiceStateUpdate(packet.d)
    if (packet.t == 'GUILD_CREATE') {
      for (const state of packet.d.voice_states) this.voiceStateUpdate({ ...state, guild_id: packet.d.id })
    }
  }

  /**
   * Handles the data of voiceServerUpdate & voiceStateUpdate to see if a connection
   * is possible with the data we have and if it is then make the connection to lavalink
   * @param {string} guildId The guild id that we're trying to attempt to connect to
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
        const bLoad = b.stats.cpu ? b.stats.cpu.systemLoad / b.stats.cpu.cores * 100 : 0
        return aLoad - bLoad
      })
  }

  /**
   * Creates a instance of {@link GorilinkPlayer}
   * @param {object} data Guild data
   */
  spawnPlayer(data) {
    const guild = data.guild.id || data.guild

    const has = this.nodes.get(guild)
    if (has) return has

    if(this.idealNodes.length === 0) throw Error('No nodes connected')

    const node = this.nodes.get(this.idealNodes[0].tag || this.idealNodes[0].host)
    if (!node) throw Error('No nodes avalible')

    const player = new this.Player(node, data, this)
    this.players.set(guild, player)

    return player
  }

  /**
   * Fetch tracks based on query and a source
   * @param {string} query Query string you want to search
   * @param {string} source Media source
   * @returns {Promise<SearchResponse>}
   */
  async fetchTracks (query, source) {
    const node = this.idealNodes[0]

    if (!/^https?:\/\//.test(query)) {
      query = `${source || 'yt'}search:${query}`
    }

    const params = new URLSearchParams({ identifier: query })
    const result = await this.request(node, 'loadtracks', params)

    return new SearchResponse(result)
  }

  /**
   * Send an request to lavalink endpoints
   * @param {GorilinkNode} node The node to send the request
   * @param {string} endpoint Request's endpoint
   * @param {string} params Parameters of the request
   * @returns {object}
   */
  request (node, endpoint, params) {
    return fetch(`http://${node.host}:${node.port}/${endpoint}?${params}`, {
      headers: {
        Authorization: node.password
      }
    }).then(res => res.json())
      .catch(error => {
        throw new Error('Fail to fetch tracks' + error)
      })
  }
}

module.exports = GorilinkManager