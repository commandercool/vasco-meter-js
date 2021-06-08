const http = require("http");
const https = require("https");
const MongoClient = require("mongodb").MongoClient;

const uri =
  "mongodb://localhost:27017?retryWrites=true&writeConcern=majority";

var vascos;

const mongoCli = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function connectMongo() {
  mongoCli.connect();
  vascos = mongoCli.db('meter').collection('vascos');
}

const options = {
  hostname: "slack.com",
  port: 443,
  path: "/api/users.info",
  method: "GET",
  headers: {
    Authorization: "Bearer " + process.env.SLACK_TOKEN,
  },
};

const hostname = "0.0.0.0";
const port = 8080;

const server = http.createServer((req, res) => {
  res.statusCode = 200;

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  console.log(`Incoming event: ${body}`)

  req.on("end", () => {
    if (body != "") {
      const json = JSON.parse(body);
      // we can receive challenge if this is
      // the first time we are using new url
      // to register our app in slack
      if (json.challenge) {
        res.setHeader("Content-Type", "text/plain");
        res.end(json.challenge);
      } else {
        // real event processing goes here
        if (json.event.reaction == "vasco") {
          var user = json.event.item_user;
          options.path = "/api/users.info?user=" + user;

          // fetch user info of the poster of the item that
          // has received a new reaction
          const req = https.request(options, (res) => {

            let userData = "";
            res.on("data", (d) => {
              userData += d;
            });

            res.on("end", () => {
              const userJson = JSON.parse(userData);
              if (userJson.error) {
                console.log(`Error from slack: ${userData}`);
              } else {
                var username = userJson.user.profile.real_name_normalized;
                console.log(`User ${username} has received vasco reaction - reaction event: ${json.event.type}!`);
                updateStats(username, json.event.type);
              }
            });
          });

          req.on("error", (error) => {
            console.error(error);
          });

          req.end();

          res.end("Got it, thanks!");
        }
      }
    } else {
      res.end();
    }
  });
});

// Startup
connectMongo();

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

function updateStats(username, event) {
  vascos.findOne({"name": username}, function(err, result) {
    if (!result) {
      result = {"name": username, "count": 0};
    }
    if (event == 'reaction_removed' && result.count > 0) {
      result.count -= 1;
    } else {
      result.count += 1;
    }
    console.log(`Updating user stats for: ${JSON.stringify(result)}`);
    vascos.updateOne({"name": username}, {$set: result}, {"upsert" : true});
  });
}