declare module 'gorilink' {
  import { EventEmitter } from 'events'
  import Collection from '@discordjs/collection'
  import * as WebSocket from 'ws'

  export class GorilinkManager extends EventEmitter {
    constructor(client: any, nodes: INodeOptions[], options?: IGorilinkOptions)
    public readonly client: any
    public readonly nodes: Collection<string, LavalinkNode>
    public readonly players: Collection<string, GorilinkPlayer>
    public readonly voiceStates: Collection<string, IVoiceStateUpdate>
    public readonly voiceServers: Collection<string, IVoiceServerUpdate>
    public readonly user: string
    public readonly shards: number
    public readonly Player: GorilinkPlayer

    public on(event: 'nodeConnect' | 'nodeReconnect', listener: (node: LavalinkNode) => void): this
    public on(event: 'nodeClose', listener: ({ event: any, node: LavalinkNode }) => void): this
    public on(event: 'nodeError', listener: ({ node: LavalinkNode, err: any }) => void): this
    public on(event: 'trackStart' | 'trackEnd', listener: ({ player: GorilinkPlayer, track: ITrack }) => void): this
    public on(event: 'trackStuck' | 'trackError', listener: ({ player: GorilinkPlayer, track: ITrack, data: any}) => void): this
    public on(event: 'socketClosed', listener: ({ player: GorilinkPlayer, data: any }) => void): this

    public once(event: 'nodeConnect' | 'nodeReconnect', listener: (node: LavalinkNode) => void): this
    public once(event: 'nodeClose', listener: ({ event: any, node: LavalinkNode }) => void): this
    public once(event: 'nodeError', listener: ({ node: LavalinkNode, err: any }) => void): this
    public once(event: 'trackStart' | 'trackEnd', listener: ({ player: GorilinkPlayer, track: ITrack }) => void): this
    public once(event: 'trackStuck' | 'trackError', listener: ({ player: GorilinkPlayer, track: ITrack, data: any}) => void): this
    public once(event: 'socketClosed', listener: ({ player: GorilinkPlayer, data: any }) => void): this

    public join(data: IJoingData, options?: IJoingOptions): GorilinkPlayer
    public leave(guild: string): GorilinkPlayer
    public idealNodes(): LavalinkNode
    public fetchTracks(query: string, source?: string): ISearchResult
  }

  export class GorilinkPlayer extends EventEmitter {
    constructor(node: LavalinkNode, options: IPlayerOptions, manager: GorilinkManager)
    public readonly manager: GorilinkManager
    public readonly node: LavalinkNode
    public readonly guild: any
    public readonly voiceChannel: any
    public readonly textChannel: any
    public readonly state: IPlayerState
    public readonly playing: boolean
    public readonly timestamp: number
    public readonly paused: boolean
    public readonly track: ITrack
    public readonly voiceUpdateState: any
    public readonly looped: number
    public readonly position: number
    public readonly queue: Queue

    public play(track: ITrack, options?: IPlayOptions): void
    public stop(): void
    public pause(pause: boolean): void
    public volume(volume: number): void
    public seek(position: number): void
    public loop(op: number): number
    public setEQ(bands: IBand[]): void
    public destroy(): GorilinkPlayer
  }

  export class LavalinkNode {
    constructor(manager: GorilinkManager, options?: INodeOptions)
    public readonly manager: GorilinkManager
    public readonly tag: string
    public readonly host: string
    public readonly port: number
    public readonly password: string
    public readonly ws: WebSocket
    public readonly reconnectInterval: number
    public readonly resumeKey: string
    public readonly _resumeTimeout: number
    public readonly _queue: []
    public readonly stats: INodeStats
    public readonly connected: boolean

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

  export interface INodeOptions {
    readonly tag?: string
    readonly host: string
    readonly port: number
    readonly password: string
    readonly resumeKey?: string
    readonly resumeTimeout?: number
    readonly reconnectInterval?: number
  }

  export interface IGorilinkOptions {
    readonly user?: string
    readonly shards?: number
    readonly Player?: GorilinkPlayer
  }

  export interface IVoiceStateUpdate {
    readonly token: string
    readonly guild_id: string
    readonly endpoint: string
  }

  export interface IVoiceServerUpdate {
    readonly token: string
    readonly guild_id: string
    readonly endpoint: string
  }

  export interface IJoingData {
    readonly guild: string
    readonly voiceChannel: string
  }

  export interface IJoingOptions {
    readonly selfMute: boolean
    readonly selfDeaf: boolean
  }

  export interface ISearchResult {
    readonly playlistInfo: IPlaylistInfo
    readonly loadType: string
    readonly tracks: ITrack[]
  }

  export interface IPlaylistInfo {
    readonly selectedTrack: number
    readonly name: string
  }

  export interface ITrack {
    readonly track: string
    readonly info: ITrackInfo
  }

  export interface ITrackInfo {
    readonly identifier: string
    readonly isSeekable: boolean
    readonly author: string
    readonly length: number
    readonly isStream: boolean
    readonly position: number
    readonly title: string
    readonly uri: string
  }

  export interface IPlayerOptions {
    readonly guild: any
    readonly voiceChannel: any
    readonly textChannel?: any
  }

  export interface IPlayerState {
    readonly volume: number
    readonly equalizer: IBand[]
  }

  export interface IBand {
    readonly band: number
    readonly gain: number
  }

  export interface IPlayOptions {
    readonly startTime?: number
    readonly endTime?: number
    readonly noReplace?: boolean
  }

  export interface INodeStats {
    readonly players: number;
    readonly playingPlayers: number;
    readonly uptime: number;
    readonly memory: INodeMemoryStats;
    readonly cpu: INodeCPUStats;
    readonly frameStats: INodeFrameStats;
  }

  export interface INodeMemoryStats {
    readonly free: number
    readonly used: number
    readonly allocated: number
    readonly reservable: number
  }

  export interface INodeCPUStats {
    readonly cores: number
    readonly systemLoad: number
    readonly lavalinkLoad: number
  }

  export interface INodeFrameStats {
    readonly sent?: number
    readonly nulled?: number
    readonly deficit?: number
  }
}