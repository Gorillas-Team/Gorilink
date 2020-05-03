module.exports = class extends Map {
  first(count) {
    if (!count) return this.values().next().value
    if (typeof count !== 'number') throw new TypeError('The count must be a number.')
    if (!Number.isInteger(count) || count < 1) throw new RangeError('The count must be an integer greater than 0.')

    count = Math.min(this.size, count)

    const arr = new Array(count)
    const iter = this.values()

    for (let i = 0; i < count; i++) arr[i] = iter.next().value

    return arr
  }

  reduce(fn, initialValue) {
    let accumulator
    if (initialValue) {
      accumulator = initialValue
      for (const [key, val] of this) accumulator = fn(accumulator, val, key, this)
    } else {
      let first = true
      for (const [key, val] of this) {
        if (first) {
          accumulator = val
          first = false
          continue
        }
        accumulator = fn(accumulator, val, key, this)
      }
    }
    return accumulator
  }
}
