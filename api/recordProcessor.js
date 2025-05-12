const config = require('./config');

function processAPIRecords(releases) {
  return releases.map(item => {
    const release = item.basic_information || item;
    const formats = release.formats ? 
      release.formats.map(f => f.name).join(', ') : 
      'Unknown';
      
    return {
      id: release.id,
      title: release.title,
      artist: release.artists ? release.artists.map(a => a.name).join(', ') : 'Unknown Artist',
      thumbnailUrl: release.thumb || release.cover_image,
      releaseUrl: `https://www.discogs.com/release/${release.id}`,
      haveCount: 0,
      wantCount: 0,
      numForSale: 0,
      medianPrice: 'Unknown',
      currency: config.getCurrencySymbol(config.DEFAULT_CURRENCY),
      fullImageUrl: release.cover_image || release.thumb || '',
      year: release.year || 'Unknown',
      format: formats,
      catno: release.catno || 'Unknown',
      label: release.labels ? release.labels.map(l => l.name).join(', ') : 'Unknown'
    };
  });
}

module.exports = {
  processAPIRecords
};