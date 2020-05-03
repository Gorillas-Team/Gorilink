module.exports = class Queue extends Array {
  constructor () {
    super()
  }

  get duration () {
    return this.reduce((acc, val) => acc + val.info.length, 0)
  }

  get empty () {
    return this.length < 1
  }

  first () {
    return this[0]
  }

  add (prop) { return this.push({ ...prop, index: this.length + 1 }) }

  removeFirst () { return this.shift() }

  remove (index) { return this.filter(track => track.index != index) }
}
