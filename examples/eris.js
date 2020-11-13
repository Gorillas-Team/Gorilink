// Importing eris Client
const { Client } = require('eris')
// Importing GorilinkManager
const { GorilinkManager } = require('../src')

// Your lavalink node config
const nodes = [
  {
    tag: 'Node 1', // optional
    host: 'localhost',
    port: 2333,
    password: 'youshallnotpass'
  }
]

// Instantiating eris client
const client = new Client('YOUR_TOKEN_HERE')

// Creating GorilinkManager
client.music = new GorilinkManager(client, nodes, {
  sendWS: (data) => {
    const guild = client.guilds.get(data.d.guild_id)
    if (!guild) return

    return guild.shard.sendWS(data.op, data.d)
  }
})
  // Listens events
  .on('nodeConnect', node => {
    console.log(`${node.tag || node.host} - Lavalink connected with success.`)
  })
  .on('trackStart', (player, track) => {
    player.textChannel.createMessage(`Now playing \`${track.title}\``)
  })

client.on('ready', async () => {
  client.music.start(client.user.id)
  console.log('Online on the client', client.user.username)
})

client.on('rawWS', packet => client.music.packetUpdate(packet))

client.on('messageCreate', async (message) => {
  const prefix = '!'
  const args = message.content.slice(prefix.length).trim().split(/ +/g)
  const cmd = args.shift().toLowerCase()

  if (cmd === 'play') {
    // Tries to get the voice channel
    const memberChannel = message.member.voiceState.channelID

    // Checks if the member is on a voice channel
    if(!memberChannel) return message.channel.createMessage('You are not on a voice channel')

    // Spawning lavalink player
    const player = await client.music.join({
      guild: message.guildID,
      voiceChannel: memberChannel,
      textChannel: message.channel
    })

    // Getting tracks
    const { tracks } = await client.music.fetchTracks(args.join(' '))

    // Adding in queue
    player.queue.add(tracks[0])

    message.channel.createMessage('Added in queue: ' + tracks[0].title)

    // Playing
    if (!player.playing) return player.play()
  }
})

// Logging the bot
client.connect()