module.require('discord.js')
const config = require('../config/development')

module.exports.run = async (bot, message, args, api) => {
  if (args.length === 0) {
    message.reply('Arf, sans token je ne peux rien faire. Merci de saisir un token après setup')
    return
  }
  message.reply('C\'est parti ! (ca va prendre quelques instants...)')
  api.post('/guilds', {
    guild_id: message.guild.id,
    name: message.guild.name,
    guild_token: args[0]
  })
    .then(function (response) {
      message.reply('Installation effectuée. Le bot est maintenant opérationnel. Tu peux te rendre sur ' + config.mapUrl + ' pour paramétrer le bot selon tes besoins. Attention, pour y avoir accès, tu dois disposer d\'unr role d\'Administrateur sur ce Discord')
    })
    .catch(function (error) {
      if (error.response) {
        message.reply(error.response.data)
      } else {
        message.reply('Une erreur s\'est produite, mais je ne sais pas laquelle...')
      }
    })
}

module.exports.help = {
  name: 'setup',
  usage: 'setup <token>',
  description: 'Configure le bot'
}
