import config from './config/development'
import helpers from './helpers'

export default {
  messageHandler: messageHandler,
  messageReactionRemoveHandler: messageReactionRemoveHandler,
  messageReactionAddHandler: messageReactionAddHandler,
  guildMemberAddHandler: guildMemberAddHandler
}

async function messageHandler (bot, message) {
  console.log('messageHandler')
  if (message.author.bot) return
  if (message.channel.type === 'dm') return

  const guildConfig = bot.configs.get(message.guild.id)
  const isMessageToBot = !!(message.mentions.users.find(val => val.id === config.bot.id))
  const isAdmin = (message.member.hasPermission('ADMINISTRATOR'))

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
          text: attachment.url,
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
    channel.send(welcomeMessage.replace('{member}', member))
  }
}