const { writeFileSync, existsSync } = require('fs');
if (!existsSync('src/data/seededEvents.json')) {
  writeFileSync('src/data/seededEvents.json', '[]');
}
