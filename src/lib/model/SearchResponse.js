const Track = require('./Track')

class SearchResponse {
  /**
   * @param {ISearchResult} data
   */
  constructor(data) {
    this.tracks = data.tracks.map(track => new Track(track))
    this.loadType = data.loadType
    this.playlistInfo = data.playlistInfo
  }
}

module.exports = SearchResponse