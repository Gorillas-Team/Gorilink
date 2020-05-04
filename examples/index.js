const { Client } = require('discord.js')
const { GorilinkManager } = require('../src')
const config = {
  token: 'your-token',
  prefix: '!',
  nodes: [
    {
      host: 'localhost',
      port: 2333,
      password: 'youshallnotpass'
    }
  ]
}

const client = new Client()

client.on('ready', async () => {
  client.music = new GorilinkManager(client, config.nodes)
    .on('nodeConnect', node => {
      console.log(`${node.tag || node.host} - Lavalink connected with success.`)
    })
    .on('trackStart', event => {
      event.player.textChannel.send(`Now playing \`${res.track.info.title}\``)
    })

  console.log('Online on the client', client.user.username)
})

client.on('message', async (message) => {
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g)
  const cmd = args.shift().toLowerCase()

  if (cmd === 'play') {
    const player = await client.music.join({
      guild: message.guild.id,
      voiceChannel: message.member.voice.channel.id,
      textChannel: message.channel
    })

    const { tracks } = await client.music.fetchTracks(args.join(' '))

    player.queue.add(tracks[0])

    message.channel.send('Added in queue: ' + tracks[0].info.title)

    if (!player.playing) return player.play()
  }
})

client.login(config.token)
