declare module 'gorilink' {
  import { Client as DiscordJSClient } from 'discord.js'
  import { Client as ErisClient } from 'eris'
  import { EventEmitter } from 'events'
  import Collection from '@discordjs/collection'
  import * as WebSocket from 'ws'

  export class GorilinkManager extends EventEmitter {
    constructor(client: DiscordJSClient | ErisClient | typeof EventEmitter | any, nodes: INodeOptions[], options?: IGorilinkOptions)

    public client: DiscordJSClient | ErisClient | typeof EventEmitter | any
    public nodes: Collection<string, GorilinkNode>
    public players: Collection<string, GorilinkPlayer>
    public voiceStates: Collection<string, IVoiceStateUpdate>
    public voiceServers: Collection<string, IVoiceServerUpdate>
    public user: string
    public shards: number
    public Player: GorilinkPlayer

    public on(event: 'nodeConnect' | 'nodeReconnect', listener: (node: GorilinkNode) => void): this
    public on(event: 'nodeClose', listener: (event: any, node: GorilinkNode) => void): this
    public on(event: 'nodeError', listener: (node: GorilinkNode, err: any) => void): this
    public on(event: 'queueEnd', listener: (player: GorilinkPlayer) => void): this
    public on(event: 'trackStart' | 'trackEnd', listener: (player: GorilinkPlayer, track: Track) => void): this
    public on(event: 'trackStuck' | 'trackError', listener: (player: GorilinkPlayer, track: Track, data: any) => void): this
    public on(event: 'socketClosed', listener: (player: GorilinkPlayer, data: any) => void): this

    public once(event: 'nodeConnect' | 'nodeReconnect', listener: (node: GorilinkNode) => void): this
    public once(event: 'nodeClose', listener: (event: any, node: GorilinkNode) => void): this
    public once(event: 'nodeError', listener: (node: GorilinkNode, err: any) => void): this
    public once(event: 'queueEnd', listener: (player: GorilinkPlayer) => void): this
    public once(event: 'trackStart' | 'trackEnd', listener: (player: GorilinkPlayer, track: Track) => void): this
    public once(event: 'trackStuck' | 'trackError', listener: (player: GorilinkPlayer, track: Track, data: any) => void): this
    public once(event: 'socketClosed', listener: (player: GorilinkPlayer, data: any) => void): this

    public join(data: IJoinData, options?: IJoinOptions): GorilinkPlayer

    public leave(guild: string): GorilinkPlayer

    public packetUpdate(packet: any): void

    public idealNodes: GorilinkNode[]

    public fetchTracks(query: string, source?: string): SearchResponse

    public request(node: GorilinkNode, endpoint: string, params: string): object

    public start(id: string): void
  }

  export class GorilinkPlayer extends EventEmitter {
    constructor(node: GorilinkNode, options: IPlayerOptions, manager: GorilinkManager)

    public manager: GorilinkManager
    public node: GorilinkNode
    public guild: any
    public voiceChannel: any
    public textChannel: any
    public state: IPlayerState
    public playing: boolean
    public timestamp: number
    public paused: boolean
    public track: ITrack
    public voiceUpdateState: any
    public looped: number
    public position: number
    public queue: Queue

    public play(track: ITrack, options?: IPlayOptions): void

    public stop(): void

    public pause(pause: boolean): void

    public volume(volume: number): void

    public seek(position: number): void

    public loop(op: number): number

    public setEQ(bands: IBand[]): void

    public destroy(): GorilinkPlayer
  }

  export class GorilinkNode {
    constructor(manager: GorilinkManager, options?: INodeOptions)

    public manager: GorilinkManager
    public tag: string
    public host: string
    public port: number
    public password: string
    public ws: WebSocket
    public reconnectInterval: number
    public resumeKey: string
    public _resumeTimeout: number
    public _queue: []
    public stats: INodeStats
    public connected: boolean

    public reconnect(): void

    public destroy(): boolean
  }

  export class Queue {
    public duration(): number

    public empty(): boolean

    public first(): ITrack

    public add(prop: ITrack): number

    public removeFirst(): ITrack

    public remove(): ITrack
  }

  export class Track {
    public uri: string
    public title: string
    public author: string
    public duration: number
    public identifier: string
    public isStream: boolean
    public isSeekable: boolean
    public track: string
    constructor(data: ITrackInfo)
  }

  export class SearchResponse {
    public tracks: Track[]
    public loadType: string
    public playlistInfo: IPlaylistInfo
    constructor(data: ISearchResult)
  }

  export interface INodeOptions {
    tag?: string
    host: string
    port: number
    password: string
    resumeKey?: string
    resumeTimeout?: number
    reconnectInterval?: number
  }

  export interface IGorilinkOptions {
    user?: string
    shards?: number
    Player?: GorilinkPlayer
    sendWS: (data: any) => void
  }

  export interface IVoiceStateUpdate {
    token: string
    guild_id: string
    endpoint: string
  }

  export interface IVoiceServerUpdate {
    token: string
    guild_id: string
    endpoint: string
  }

  export interface IJoinData {
    guild: string
    voiceChannel: string
  }

  export interface IJoinOptions {
    selfMute: boolean
    selfDeaf: boolean
  }

  export interface ISearchResult {
    playlistInfo: IPlaylistInfo
    loadType: string
    tracks: ITrack[]
  }

  export interface IPlaylistInfo {
    selectedTrack: number
    name: string
  }

  export interface ITrack {
    track: string
    info: ITrackInfo
  }

  export interface ITrackInfo {
    identifier: string
    isSeekable: boolean
    author: string
    length: number
    isStream: boolean
    position: number
    title: string
    uri: string
  }

  export interface IPlayerOptions {
    guild: any
    voiceChannel: any
    textChannel?: any
  }

  export interface IPlayerState {
    volume: number
    equalizer: IBand[]
  }

  export interface IBand {
    band: number
    gain: number
  }

  export interface IPlayOptions {
    startTime?: number
    endTime?: number
    noReplace?: boolean
  }

  export interface INodeStats {
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: INodeMemoryStats;
    cpu: INodeCPUStats;
    frameStats: INodeFrameStats;
  }

  export interface INodeMemoryStats {
    free: number
    used: number
    allocated: number
    reservable: number
  }

  export interface INodeCPUStats {
    cores: number
    systemLoad: number
    lavalinkLoad: number
  }

  export interface INodeFrameStats {
    sent?: number
    nulled?: number
    deficit?: number
  }
}
