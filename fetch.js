const fs = require('fs');
const axios = require('axios');

const dir = 'raw-analytics';

let data = [];

fs.readdirSync(dir).forEach(file => {
  const path = dir + "/" + file;
  const json = JSON.parse(fs.readFileSync(path, 'utf-8'));

  let table = json.components.find(c => c.id == "explorer-table").dataTable;

  // data.components[2].table.dataTable.rowCluster
  // data.components[2].table.dataTable.metric

  let headers = table.metric;
  // console.log(headers); //conceptName

  table.rowCluster.forEach(row => {
    let id = Number(row.label);
    let url = row.rowKey[0].displayKey;

    if(
      // !url.match(/^\/1112\/main\/(?!category|author|\?|wp|tag|mauthors).*?$/gmi) ||
      !url.match(/^\/1112\/main\/\d\d\d\d\/\d\d\/.*?$/gmi) ||
      url.match(/preview\=true/gmi)
    ) return false;

    let rows = row.row[0].rowValue.map(({dataValue: value}, index) => {
      if([0, 1, 3].includes(index)){
        let n = Number(value.replace(/[^\d]/gmi, ''));
        // if(isNaN(n)) console.log(value, n);
        return n;
      }

      if([2].includes(index)){
        let n = 0;
        value.split(":").map(Number).forEach((v, i) => n += v * Math.pow(60, 2 - i));
        // console.log(value, n);
        return n;
      }

      if([4, 5].includes(index)){
        return Number(value.substr(0, value.length - 1));
      }

      if([6].includes(index)){
        return Number(value.substr(1));
      }

      // 0"analytics.pageviews"
      // 1"analytics.uniquePageviews"
      // 2"analytics.avgPageDuration"
      // 3"analytics.entrances"
      // 4"analytics.bounceRate"
      // 5"analytics.exitRate"
      // 6"analytics.pageValue"

    });
    data.push({ url, rows });
  });
});

data = data.sort((a, b) => a.url.localeCompare(b.url));

// data = [data[0], data[1], data[2], data[3]]

let slugReg = /^\/1112\/main\/\d\d\d\d\/\d\d\/(.*?)$/gmi;

let fetched = [];
let doneCount = 0;
let total = data.length;

let done = false;

function loop(){
  console.log(`${data.length} left. ${fetched.length} fetched`);

  let datum = data.shift();
  if(datum) scrape(datum);

  fs.writeFileSync("data/posts.json", JSON.stringify(fetched));

  if(doneCount == total){
    done = true;
    console.log("done");

    fs.writeFileSync("data/posts.json", JSON.stringify(fetched));
  }
}

for(let i = 0; i < 15; i++) loop();

function cleanText(text){
  return text.replace(/\<.*?\>|\n/gmi, '').trim();
}

function scrape(datum){
  slugReg.lastIndex = 0;
  let slug = slugReg.exec(datum.url.split("?")[0])[1].replace(/[^a-z0-9\-]/gmi, '').trim();
  // console.log(`Fetching ${slug}`);
  datum.slug = slug;
  let restUrl = `http://theguidon.com/1112/main/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;
  axios.get(restUrl).then(({data}) => {
    let wp = data[0];

    if(wp && wp.status == "publish"){

      let title = cleanText(wp.title.rendered);
      let date = wp.date;
      let text = cleanText(wp.content.rendered);
      let excerpt = cleanText(wp.excerpt.rendered);
      let categories = wp.categories;
      let link = wp.link;
      let featuredMedia = wp.featured_media;
      let hasFeaturedMedia = featuredMedia != 0;

      datum.content = {
        title, link, date,
        text, excerpt, categories,
        featuredMedia, hasFeaturedMedia,
      };

      fetched.push(datum);

      // console.log(title);
    }
    doneCount++;
    loop();
  })
  .catch(e => {
    console.log("error", slug);
    scrape(datum);
  });
}
