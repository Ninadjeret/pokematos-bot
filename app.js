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
import listeners from './listeners.js'

const { combine, timestamp, printf } = winston.format

const bot = new Discord.Client()
bot.configs = new Discord.Collection()
bot.api = axios.create({
  baseURL: config.api.baseUrl + '/bot',
  timeout: 20000,
  headers: { Authorization: 'Bearer ' + config.api.token }
})

// ============================================================================
// Configuration
// ============================================================================
bot.commands = new Discord.Collection()
bot.help = {
  name: [],
  usage: new Discord.Collection(),
  description: new Discord.Collection()
}

// ============================================================================
// Winston Configuration
// ============================================================================
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

// ============================================================================
// Chargement des commandes
// ============================================================================
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

// ============================================================================
// AU chargement
// ============================================================================
bot.on('ready', () => {
  bot.user.setActivity('Pokemon Go')
  console.log(`Logged in as ${bot.user.tag}!`)
  bot.api.get(`/guilds`)
    .then(function (response) {
      const guilds = response.data
      guilds.forEach(async guild => {
        await bot.configs.set(guild.discord_id, guild)
      })
    })
})

// ============================================================================
// Lors d'un nouveau membre
// ============================================================================
bot.on('guildMemberAdd', member => {
  listeners.guildMemberAddHandler(bot, member)
})

// ============================================================================
// Lors d'un message ' +
// ============================================================================
bot.on('message', async (message) => {
  listeners.messageHandler(bot, message)
  /* TODO: Finish the new permission work
  // Get the mentions
  const mentions = message.mentions.roles
  const roles = await helpers.getRoles(bot, { guildId: message.guild.id })

  const permissions = roles.map(role => {
    if (!role.category.restricted) return
    return role.category.permissions
  })
  let isAuthorized = true
  for (const permission of permissions) {
    if (isAuthorized && permission.channels.includes(message.channel.id) && mentions.filter(role => permission.roles.includes(role.id))) {
      isAuthorized = isAuthorized && permission.type === 'auth'
    }
  }
  if (!isAuthorized) {
    // Modérer le message
  } else {
    // Message valide
  }
  */
})

// ============================================================================
// Lors de l'ajout d'une réaction
// ============================================================================
bot.on('messageReactionAdd', (reaction, user) => {
  listeners.messageReactionAddHandler(bot, reaction, user)
})

// ============================================================================
// Lors de la suppression d'une réaction
// ============================================================================
bot.on('messageReactionRemove', (reaction, user) => {
  listeners.messageReactionRemoveHandler(bot, reaction, user)
})

bot.login(config.bot.token)
