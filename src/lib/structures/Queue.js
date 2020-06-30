/**
 * Represents a play queue
 * @extends Array
 */
class Queue extends Array {
  constructor () { super() }

  /**
   * Gets duration of the Queue
   * @returns {Number} Total Queue duration
   */
  get duration () { return this.reduce((acc, val) => acc + val.info.length, 0) }

  /**
   * Checks whether the queue is empty
   * @returns {Boolean}
   */
  get empty () { return this.length < 1 }

  /**
   * Gets the first item in the Queue
   * @returns {Object} First item
   */
  first () { return this[0] }

  /**
   * Add an item to the Queue
   * @param {Object} prop Track object
   * @returns {Number} Queue length
   */
  add (prop) { return this.push({ ...prop, index: this.length + 1 }) }

  /**
   * Remove the first item from the Queue
   * @returns {Object} Item removed
   */
  removeFirst () { return this.shift() }

  /**
   * Remove an item from the queue by the index
   * @param {Number} index Position to be removed
   * @returns {Object} Next item by index
   */
  remove (index) { return this.splice(index, 1)[0] }
}

module.exports = Queue