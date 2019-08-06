const Discord = require('discord.js')
const fs = require('fs')
const helpers = require('./helpers.js')
const path = require('path')
const axios = require('axios')
const winston = require('winston')
const { combine, timestamp, printf } = winston.format;


const bot = new Discord.Client()
bot.configs = new Discord.Collection()
const config = require('./config.json')
const api = axios.create({
  baseURL: config.api.baseUrl + '/bot',
  timeout: 10000,
  headers: {'Authorization': 'Bearer ' + config.api.token}
});
/*
    ============================================================================
    Configuration
    ============================================================================
 */
bot.commands = new Discord.Collection()
bot.help = {
  'name': [],
  'usage': new Discord.Collection(),
  'description': new Discord.Collection()
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
          return `[${timestamp}] [${path.basename(__filename, '.js')}/${level}]: ${message}`;
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
          return `[${timestamp}] [${path.basename(__filename, '.js')}/${level}]: ${message}`;
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

  let jsfiles = files.filter(f => f.split('.').pop() === 'js')
  if (jsfiles.length <= 0) {
    winston.info('No commands to load !')
    return
  }

  winston.info(`Loading ${jsfiles.length} commands !`)
  jsfiles.forEach((f, i) => {
    let props = require(`./commands/${f}`)
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
    console.log(`Logged in as ${bot.user.tag}!`);
    api.get(`/guilds`)
        .then(function (response) {
            let guilds = response.data;
            guilds.forEach(async guild => {
                await bot.configs.set(guild.discord_id, guild);
            })
            console.log(bot.configs);
        })
});


/*
    ============================================================================
    Lors d'un message
    ============================================================================
 */
bot.on('message', message => {
    if (message.author.bot) return
    if (message.channel.type === 'dm') return

    let isMessageToBot = (message.mentions.users.find(val => val.id === config.bot.id)) ? true : false;
    let isAdmin = (message.member.hasPermission("ADMINISTRATOR"));

    //Gestion des commands
    if( isMessageToBot && isAdmin ) {
        let command = helpers.extractCommand(bot, message);
        console.log(command)
        let cmd = bot.commands.get(command.cmd)
        if (cmd) cmd.run(bot, message, command.args)
    }

    //Gestion des captures de raid
    else {
        console.log(message.guild.id)
        let guildConfig = bot.configs.get(parseInt(message.guild.id));
        console.log(guildConfig);
        //if (message.content.startsWith()  )
        if (message.content === 'ping') {
            message.reply('pong');
        }
    }

});


bot.login(config.bot.token)
