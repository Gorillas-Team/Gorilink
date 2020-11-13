<p align="center">
  <img src="https://i.imgur.com/U4niq5L.png" />
</p>
<p align="center">
  <a href="LICENSE.md"><img src="https://badgen.net/github/license/amio/badgen-service" /></a>
  <a href="https://www.npmjs.com/package/gorilink"><img src="https://badgen.net/npm/v/gorilink"></a>
</p>

##

<p align="center">
  <a href="https://nodei.co/npm/gorilink/"><img src="https://nodei.co/npm/gorilink.png?downloads=true&downloadRank=true&stars=true"></a>
</p>

## Table of contents

- [Documentation](https://gorillas-team.github.io/Gorilink/)
- [Installation](#installation)
- [About](#about)
- [Example](#example-usage-basic-bot)

# Installation
```
// Using npm
npm install gorilink

// Using yarn
yarn add gorilink
```

# About
To use you need a configured [Lavalink](https://github.com/Frederikam/Lavalink) instance.

- Performant
- 100% Compatible with Lavalink
- Easy to use
- Events Based
- 100% Customizable

## Example usage basic bot
```javascript
// Importing Discord.js Client
const { Client } = require('discord.js')
// Importing GorilinkManager
const { GorilinkManager } = require('gorilink')

// Your lavalink node config
const nodes = [
  {
    tag: 'Node 1', // optional
    host: 'localhost',
    port: 2333,
    password: 'youshallnotpass'
  }
]

// Instantiating discord.js client
const client = new Client()

client.music = new GorilinkManager(client, nodes, {
  sendWS: (data) => {
    const guild = client.guilds.cache.get(data.d.guild_id)
    if (!guild) return

    return guild.shard.send(data)
  }
})
  // Listens events
  .on('nodeConnect', node => {
    console.log(`${node.tag || node.host} - Lavalink connected with success.`)
  })
  .on('trackStart', (player, track) => {
    player.textChannel.send(`Now playing \`${track.title}\``)
  })

client.on('ready', async () => {
  // Starting GorilinkManager
  client.music.start(client.user.id)
  console.log('Online on the client', client.user.username)
})

client.on('raw', packet => client.music.packetUpdate(packet))

client.on('message', async (message) => {
  const prefix = '!'
  const args = message.content.slice(prefix.length).trim().split(/ +/g)
  const cmd = args.shift().toLowerCase()

  if (cmd === 'play') {
    // Tries to get the voice channel
    const memberChannel = message.member.voice.channel.id

    // Checks if the member is on a voice channel
    if(!memberChannel) return message.channel.send('You are not on a voice channel')

    // Spawning lavalink player
    const player = await client.music.join({
      guild: message.guild.id,
      voiceChannel: memberChannel,
      textChannel: message.channel
    })

    // Getting tracks
    const { tracks } = await client.music.fetchTracks(args.join(' '))

    // Adding in queue
    player.queue.add(tracks[0])

    message.channel.send('Added in queue: ' + tracks[0].title)

    // Playing
    if (!player.playing) return player.play()
  }
})

// Logging the bot
client.login('YOUR_TOKEN_HERE')
```

## Help
If you do not understand something in the documentation or have any questions, please join our [Gorillas's Team Discord server](https://discord.gg/t87qh4y)
