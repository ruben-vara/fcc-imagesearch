// init project
const express = require('express');
const https = require('https');
const mongo = require('mongodb').MongoClient;
const app = express();
const gcseUri = 'https://www.googleapis.com/customsearch/v1?key='+process.env.KEY+'&cx='+process.env.CX+'&searchType=image&q=';
const mongoUri = 'mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.PORT+'/'+process.env.DB;

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(__dirname + '/views/index.html')
})

// manage the behaviour when searching images
app.get('/api/search/:s', (req, res) => {
  let word = req.params.s;
  let offset = req.query.offset;
  makeApiRequest(word, offset, res);
  let time = new Date();
  storeQuery(word, time);
});

// get the 10 latest entries in the db and output in json
app.get('/api/latest/search/', (req, res) => {
  searchDatabase(res);
});

// write the query and the date to the database
function storeQuery(word, queryTime) {
  let inputObj = [
    {
      term: word,
      time: queryTime
    }
  ];
  
  mongo.connect(mongoUri, (err, client) => {
    if (err) throw (err);
    console.log('connected to db');
    
    const db = client.db(process.env.DB);
    let queries = db.collection('image_queries');
    console.log('connected to collection "image_queries"');
    
    queries.insert(inputObj, (err, result) => {
      if (err) throw (err);
      console.log('data inserted in db');
    });
  });
}
// search for the query on Google Custom Search Engine using its API, and output the result
function makeApiRequest(word, offset, response) {
  let startIndex;
  (!offset || offset <= 0) ? startIndex = 1 : startIndex = Number(offset);
  let fullUri = gcseUri + word + '&start=' + startIndex;
  let tempStr = '';
  https.get(fullUri, (res) => {
    res.on('data', (res) => {
      tempStr += res;
    })
    .on('end', () => {
      let obj = JSON.parse(tempStr);
      let items = obj['items'];
      let resObj = [];
      items.forEach(item => {
        let tempObj = {
          url: item['link'],
          snippet: item['snippet'],
          thumbnail: item['image']['thumbnailLink'],
          context: item['image']['contextLink']
        };
        resObj.push(tempObj);
      });
      response.send(resObj);
    });
  });
}

// search for the 10 latest queries from the database, and output the result
function searchDatabase(response) {
  let result;
  
  mongo.connect(mongoUri, (err, client) => {
    if (err) throw (err);
    console.log('connected to db');
    
    const db = client.db(process.env.DB);
    let queries = db.collection('image_queries');
    console.log('connected to collection "image_queries"');
    
    queries.find(
      {},
      { projection: { _id: 0 } }
    ).sort({ time: -1 }).limit(10).toArray((err, docs) => {
      if(err) throw err;
      response.send(docs);
    });
  });
}

// listen for requests
const listener = app.listen("3000", () => {
  console.log(`Your app is listening on port ${listener.address().port}`)
})
