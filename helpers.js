module.exports = {
  extractCommand: function (bot, message) {
    const content = message.content.replace('  ', ' ')
    const messageArray = content.split(' ')
    return {
      cmd: messageArray[1],
      args: messageArray.slice(2)
    }
  },
  getRole: async function (bot, data) {
    try {
      const url = `/guilds/${data.guildId}/roles/${data.roleId}`
      console.log(url)
      return (await bot.api.get(url)).data
    } catch (e) {
      console.error(e.message)
    }
  },
  getRoles: async function (bot, data) {
    try {
      return (await bot.api.get(`/guilds/${data.guildId}/roles`)).data
    } catch (e) {
      console.error(e.message)
    }
  }
}
