/**
 * Config file
 * @typedef {Object} The config object
 * @property {string} api.baseUrl The API URL
 * @property {string} api.token The API authentification token
 * @property {string} bot.id The bot ID
 * @property {string} bot.token The bot token
 * @property {string} mapUrl The map URL
 * @property {string} syncUrlPort The sync port
 */
import config from './config/development'

import Discord from 'discord.js'
import fs from 'fs'
import winston from 'winston'
import axios from 'axios'
import path from 'path'
import helpers from './helpers.js'

const { combine, timestamp, printf } = winston.format

const bot = new Discord.Client()
bot.configs = new Discord.Collection()
const api = axios.create({
  baseURL: config.api.baseUrl + '/bot',
  timeout: 20000,
  headers: { Authorization: 'Bearer ' + config.api.token }
})
/*
    ============================================================================
    Configuration
    ============================================================================
 */
bot.commands = new Discord.Collection()
bot.help = {
  name: [],
  usage: new Discord.Collection(),
  description: new Discord.Collection()
}

/*
    ----------------------------------------------------------------------------
    Winston Configuraiton
    ----------------------------------------------------------------------------
 */
winston.configure({
  transports: [
    new winston.transports.Console({
      format: combine(
        winston.format.colorize(),
        timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        printf(({ level, message, timestamp }) => {
          return `[${timestamp}] [${path.basename(__filename, '.js')}/${level}]: ${message}`
        })
      )
    }),
    new winston.transports.File({
      filename: 'logs/current.log',
      format: combine(
        timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        printf(({ level, message, timestamp }) => {
          return `[${timestamp}] [${path.basename(__filename, '.js')}/${level}]: ${message}`
        })
      )
    })
  ]
})

/*
    ----------------------------------------------------------------------------
    Chargement des commandes
    ----------------------------------------------------------------------------
 */
fs.readdir('./commands/', (err, files) => {
  if (err) winston.error(err)

  const jsfiles = files.filter(f => f.split('.').pop() === 'js')
  if (jsfiles.length <= 0) {
    winston.info('No commands to load !')
    return
  }

  winston.info(`Loading ${jsfiles.length} commands !`)
  jsfiles.forEach((f, i) => {
    const props = require(`./commands/${f}`)
    winston.info(`${i + 1}: ${f} loaded!`)
    bot.commands.set(props.help.name, props)
    bot.help.name.push(props.help.name)
    bot.help.usage.set(props.help.name, props.help.usage)
    bot.help.description.set(props.help.name, props.help.description)
  })
})

/*
    ============================================================================
    AU chargement
    ============================================================================
 */
bot.on('ready', () => {
  bot.user.setActivity('Pokemon Go')
  console.log(`Logged in as ${bot.user.tag}!`)
  api.get(`/guilds`)
    .then(function (response) {
      const guilds = response.data
      guilds.forEach(async guild => {
        await bot.configs.set(guild.discord_id, guild)
      })
    })
})

/*
    ============================================================================
    Lors d'un nouveau membre
    ============================================================================
 */
bot.on('guildMemberAdd', member => {
  const guildConfig = bot.configs.get(member.guild.id)
  if (guildConfig.settings.welcome_active) {
    const channel = member.guild.channels.find(val => val.id === guildConfig.settings.welcome_channel_discord_id)
    if (!channel) return
    const welcomeMessage = guildConfig.settings.welcome_message
    channel.send(welcomeMessage.replace('{member}', member))
  }
})

/*
    ============================================================================
    Lors d'un message
    ============================================================================
 */
bot.on('message', message => {
  if (message.author.bot) return
  if (message.channel.type === 'dm') return

  const guildConfig = bot.configs.get(message.guild.id)
  const isMessageToBot = !!(message.mentions.users.find(val => val.id === config.bot.id))
  const isAdmin = (message.member.hasPermission('ADMINISTRATOR'))

  /*
        ----------------------------------------------------------------------------
        Commandes
        ----------------------------------------------------------------------------
     */
  if (isMessageToBot && isAdmin) {
    const command = helpers.extractCommand(bot, message)
    console.log(command)
    const cmd = bot.commands.get(command.cmd)
    if (cmd) cmd.run(bot, message, command.args, api)
  } else { // Gestion des captures de raid
    /*
            ----------------------------------------------------------------------------
            Annonce d'un raid texte
            ----------------------------------------------------------------------------
         */
    if (guildConfig.settings.raidreporting_text_active && guildConfig.settings.raidreporting_text_prefixes.length > 0) {
      guildConfig.settings.raidreporting_text_prefixes.forEach((prefix, i) => {
        if (message.content.startsWith(prefix)) {
          api.post('/raids', {
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

    /*
            ----------------------------------------------------------------------------
            Annonce d'un raid Image
            ----------------------------------------------------------------------------
         */
    if (guildConfig.settings.raidreporting_images_active) {
      const attachment = message.attachments.first()
      if (attachment && attachment.url) {
        api.post('/raids', {
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
})

/*
    ============================================================================
    Lors de l'ajout d'une réaction
    ============================================================================
 */
bot.on('messageReactionAdd', (reaction, user) => {
  console.log('messageReactionAdd')
  if (user.bot) return
  if (reaction.emoji.name !== '✅') return
  const guild = reaction.message.guild
  api.get('/guilds/' + reaction.message.guild.id + '/roles')
    .then(function (response) {
      const roles = response.data
      const role = roles.find(element => element.message_discord_id === reaction.message.id)
      if (role && !guild.members.get(user.id).roles.has(role.discord_id)) {
        // Si 'role' est défini et que l'utilisateur n'a pas le rôle, lui attribuer
        console.log('Attribution du role @' + role.name + ' à l\'utilisateur ' + (guild.members.get(user.id).nickname || user.username))
        const roleToAdd = guild.roles.get(role.discord_id)
        guild.members.get(user.id).addRole(roleToAdd).catch(console.error)
      }
    })
    .catch(function (error) {
      console.log(error)
    })
})

/*
    ============================================================================
    Lors de la suppression d'une réaction
    ============================================================================
 */
bot.on('messageReactionRemove', (reaction, user) => {
  console.log('messageReactionRemove')
  if (user.bot) return
  if (reaction.emoji.name !== '✅') return
  const guild = reaction.message.guild
  api.get('/guilds/' + reaction.message.guild.id + '/roles')
    .then(function (response) {
      const roles = response.data
      const role = roles.find(element => element.message_discord_id === reaction.message.id)
      if (role && guild.members.get(user.id).roles.has(discord_id.id)) {
        // Si 'role' est defini et que l'utilisateur a le rôle, lui retirer
        console.log('Supression du role @' + role.name + ' de l\'utilisateur ' + (guild.members.get(user.id).nickname || user.username))
        const roleToRemove = guild.roles.get(role.discord_id)
        guild.members.get(user.id).removeRole(role).catch(console.error)
      }
    })
    .catch(function (error) {
      console.log(error)
    })
})

bot.login(config.bot.token)
