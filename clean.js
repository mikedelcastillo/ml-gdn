(async () => {


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

  let slugReg = /^\/1112\/main\/\d\d\d\d\/\d\d\/(.*?)$/gmi;


  for(let i = 0; i < data.length; i++){
    let datum = data[i];

    slugReg.lastIndex = 0;
    let slug = slugReg.exec(datum.url.split("?")[0])[1].replace(/\//gmi, '');
    datum.slug = slug;
    let restUrl = `http://theguidon.com/1112/main/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;
    let response = await axios.get(restUrl);
    datum.exists = true;

    try{
      let wp = response.data[0];

      if(wp.status != "publish") throw new Error("Not published");

      let title = wp.title.rendered;
      let date = wp.date;
      let text = wp.content.rendered;
      let excerpt = wp.excerpt.rendered;
      let categories = wp.categories;

      datum.content = {
        title, date, text, excerpt, categories,
      };

    } catch(e){
      console.log(e);
      datum.exists = false;
    }

    // console.log(datum.exists);
    let percent = ((i+1)/data.length*100).toFixed(2);
    console.log(`${i+1} of ${data.length}. ${percent}% done`);
  }

  fs.writeFileSync("data/gdn.json", JSON.stringify(data));

})();
