module.exports = (config, env) => {
  // For Chrome extensions, source maps must be inline to work properly
  // https://stackoverflow.com/questions/15097945/do-source-maps-work-for-chrome-extensions
  return { ...config, devtool: 'inline-source-map' }
}
