function generateRef(prefix = 'SL') {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${num}`
}

module.exports = { generateRef }
