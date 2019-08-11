module.exports = {
  extractCommand: function (bot, message) {
    const content = message.content.replace('  ', ' ')
    const messageArray = content.split(' ')
    return {
      cmd: messageArray[1],
      args: messageArray.slice(2)
    }
  }
}
