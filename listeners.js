import config from './config/development'
import helpers from './helpers'

export default {
  messageHandler: messageHandler,
  messageReactionRemoveHandler: messageReactionRemoveHandler,
  messageReactionAddHandler: messageReactionAddHandler,
  guildMemberAddHandler: guildMemberAddHandler,
  guildRoleAdd: guildRoleAdd,
  guildRoleUpdate: guildRoleUpdate,
  guildRoleDelete: guildRoleDelete
}

async function messageHandler (bot, message) {
  console.log('messageHandler')
  if (message.author.bot) return
  if (message.channel.type === 'dm') return

  const guildConfig = bot.configs.get(message.guild.id)
  const isMessageToBot = !!(message.mentions.users.find(val => val.id === config.bot.id))
  const isAdmin = (message.member.hasPermission('ADMINISTRATOR'))

  console.log(bot.configs)

  if (isMessageToBot && isAdmin) {
    const command = helpers.extractCommand(bot, message)
    console.log(command)
    const cmd = bot.commands.get(command.cmd)
    if (cmd) await cmd.run(bot, message, command.args, bot.api)
  } else { // Gestion des captures de raid
    // ============================================================================
    // Annonce d'un raid texte
    // ============================================================================
    if (guildConfig.settings.raidreporting_text_active && guildConfig.settings.raidreporting_text_prefixes.length > 0) {
      guildConfig.settings.raidreporting_text_prefixes.forEach((prefix, i) => {
        if (message.content.startsWith(prefix)) {
          bot.api.post('/raids', {
            text: message.content,
            user_name: message.author.username,
            user_discord_id: message.author.id,
            guild_discord_id: message.guild.id,
            message_discord_id: message.id,
            channel_discord_id: message.channel.id
          })
            .then(function (response) {
              console.log(response)
            })
            .catch(function (error) {
              console.log(error)
            })
        }
      })
    }

    // ============================================================================
    // Annonce d'un raid Image
    // ============================================================================
    if (guildConfig.settings.raidreporting_images_active) {
      const attachment = message.attachments.first()
      if (attachment && attachment.url) {
        bot.api.post('/raids', {
          url: attachment.url,
          user_name: message.author.username,
          user_discord_id: message.author.id,
          guild_discord_id: message.guild.id,
          message_discord_id: message.id,
          channel_discord_id: message.channel.id
        })
          .then(function (response) {
            console.log(response)
          })
          .catch(function (error) {
            console.log(error)
          })
      }
    }

    // ============================================================================
    // COntrole des mentions autorisées
    // ============================================================================
    const userRolesIds = message.member.roles.keyArray();
    const mentions = message.mentions.roles
    const roles = await helpers.getRoles(bot, { guildId: message.guild.id })
    let isAuthorized = true
    for( const mention of mentions ) {
      let role = roles.find(function(element) {
        return element.discord_id == mention[0] ;
      });
      if( role.category.restricted ) {
        isAuthorized = false
        let findChannel = false
        let findRole = false
        for( const permission of role.category.permissions ) {
          if( permission.channels.find( item => item == message.channel.id) ) findChannel = true
          console.log(userRolesIds.filter(value => permission.roles.includes(value)))
          console.log(userRolesIds.filter(value => permission.roles.includes(value)).length)
          if( userRolesIds.filter(value => permission.roles.includes(value)).length > 0 ) findRole = true
        }
        isAuthorized = findChannel && findRole
      }
    }

    if( !isAuthorized ) {
        message.channel.send('Ahum, merci de ne pas mentionner ce role ici')
        message.delete()
    }

    // if (message.content.startsWith()  )
    if (message.content === 'ping') {
      message.reply('pong')
    }
  }
}

async function messageReactionRemoveHandler (bot, reaction, user) {
  console.log('messageReactionRemoveHandler')
  if (user.bot) return
  if (reaction.emoji.name !== '✅') return

  const guild = reaction.message.guild
  const member = guild.members.get(user.id)
  const roles = await helpers.getRoles(bot, { guildId: guild.id })
  const role = roles.find(element => element.message_discord_id === reaction.message.id)
  if (!role) return
  if (member.roles.has(role.discord_id)) {
    // Si 'role' est defini et que l'utilisateur a le rôle, lui retirer
    bot.winston.info(`Supression du role @${role.name} de l'utilisateur ${member.nickname || user.username}`)
    member.removeRole(role.discord_id).catch(console.error)
  }
}

async function messageReactionAddHandler (bot, reaction, user) {
  console.log('messageReactionAddHandler')
  if (user.bot) return
  if (reaction.emoji.name !== '✅') return
  const guild = reaction.message.guild
  const member = guild.members.get(user.id)
  const roles = await helpers.getRoles(bot, { guildId: guild.id })
  const role = roles.find(element => element.message_discord_id === reaction.message.id)
  if (!role) return
  if (!member.roles.has(role.discord_id)) {
    // Si 'role' est défini et que l'utilisateur n'a pas le rôle, lui attribuer
    bot.winston.info(`Attribution du role @${role.name} à l'utilisateur ${member.nickname || user.username}`)
    member.addRole(role.discord_id).catch(console.error)
  }
}

async function guildMemberAddHandler (bot, member) {
  console.log('guildMemberAddHandler')
  const guildConfig = bot.configs.get(member.guild.id)
  if (guildConfig.settings.welcome_active) {
    const channel = member.guild.channels.find(val => val.id === guildConfig.settings.welcome_channel_discord_id)
    if (!channel) return
    const welcomeMessage = guildConfig.settings.welcome_message
    channel.send(welcomeMessage.replace('{utilisateur}', member))
  }
}

async function guildRoleAdd (bot, role) {
  console.log('guildRoleAdd')
  if( role.name == '@everyone' ) return
  let guildId = role.guild.id
  bot.api.post('/guilds/'+guildId+'/roles', {
    discord_id: role.id,
    name: role.name,
    color: role.color,
  })
    .then(function (response) {
      console.log(response)
    })
    .catch(function (error) {
      console.log(error)
    })
}

async function guildRoleUpdate (bot, oldRole, newRole) {
  console.log('guildRoleUpdate')
  if( newRole.name == '@everyone' ) return
  let guildId = newRole.guild.id
  bot.api.put('/guilds/'+guildId+'/roles/'+newRole.id, {
    name: newRole.name,
    color: newRole.color,
  })
    .then(function (response) {
      console.log(response)
    })
    .catch(function (error) {
      console.log(error)
    })
}

async function guildRoleDelete (bot, role) {
  console.log('guildRoleDelete')
  if( role.name == '@everyone' ) return
  let guildId = role.guild.id
  bot.api.delete('/guilds/'+guildId+'/roles/'+role.id)
    .then(function (response) {
      console.log(response)
    })
    .catch(function (error) {
      console.log(error)
    })
}
