const fs = require('fs');

let data = fs.readFileSync('raw-analytics/1.json');

fs.writeFileSync('preview.html', `<script>const data = ${data};</script>`);
