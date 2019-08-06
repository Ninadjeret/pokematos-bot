module.exports = {
    extractCommand: function (bot, message) {
        let content = message.content.replace('  ', ' ');
        let messageArray = content.split(' ');
        return {
            cmd: messageArray[1],
            args: messageArray.slice(2)
        };
    }
}
