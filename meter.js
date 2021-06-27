// Before running two env variables should be set:
// SLACK_TOKEN - token that is used to call slack api
// BOT_TOKEN - token provided by bot (used to check that requests were not forged)
const http = require("http");
const https = require("https");
const MongoClient = require("mongodb").MongoClient;

const uri = "mongodb://localhost:27017?retryWrites=true&writeConcern=majority";

var vascos;

const mongoCli = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function connectMongo() {
  mongoCli.connect();
  vascos = mongoCli.db("meter").collection("vascos");
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

  req.on("end", () => {
    if (req.url == "/" && body != "") {
      console.log(`Incoming event: ${body}`);
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        console.log("Error parsing incoming event");
        res.end();
        return;
      }
      // we can receive challenge if this is
      // the first time we are using new url
      // to register our app in slack
      if (json.challenge) {
        res.setHeader("Content-Type", "text/plain");
        res.end(json.challenge);
      } else {
        // real event processing goes here
        // check token first to make sure that event
        // comes from the bot
        if (json.token != process.env.BOT_TOKEN) {
          console.log("WARN: Forged request was discarded because if invalid token!");
          res.end();
          return;
        }
        if (json.event.reaction == "vasco") {
          let user = json.event.item_user;
          let reactionUser = json.event.user;
          // do not increment stats when user reaction to his own post
          if (user == reactionUser) {
            console.log("Self reactions are not counted, discarding event");
            res.end();
            return;
          }

          options.path = "/api/users.info?user=" + user;

          // fetch user info of the poster of the item that
          // has received a new reaction
          const req = https.request(options, (res) => {
            let userData = "";
            res.on("data", (d) => {
              userData += d;
            });

            res.on("end", () => {
              let userJson;
              try {
                userJson = JSON.parse(userData);
              } catch (e) {
                console.log(`Error parsing user data ${userData}`);
                res.end();
                return;
              }
              if (userJson.error) {
                console.log(`Error from slack: ${userData}`);
              } else {
                let username = userJson.user.profile.real_name_normalized;
                console.log(
                  `User ${username} has received vasco reaction - reaction event: ${json.event.type}!`
                );
                updateStats(user, username, json.event.type);
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
    } else if (req.url == "/stats") {
      let slashParam = Object.fromEntries(
        body.split('&')
         .map(s => s.split('='))
         .map(pair => pair.map(decodeURIComponent)));
      if (slashParam.text == "top") {
        vascos
          .find()
          .sort({"count": -1})
          .limit(3)
          .toArray()
          .then((stats) => {
            console.log("Current stats are: ", JSON.stringify(stats));
            var blocks = [];
            let titleBlock = {"type": "section", "text": {"type": "mrkdwn", "text": ":trophy: *Current stats are:*"}};
            blocks.push(titleBlock);
            stats.forEach(stat => {
              let block = {};
              block.type = "section";
              block.text = {};
              block.text.type = "mrkdwn";
              block.text.text = `${stat.name}: ${stat.count} x :vasco:`;
              blocks.push(block);
            });
            let mrkdwn = {"blocks": blocks};
            let strStats = JSON.stringify(mrkdwn);
            res.setHeader("Content-Type", "application/json");
            res.end(strStats);
          });
      } else {
        vascos
          .findOne({userId: slashParam.user_id})
          .then((user) => {
            console.log("Current user stats are: ", JSON.stringify(user));
            res.end();
          });
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

function updateStats(userId, username, event) {
  vascos.findOne({ userId: userId }, function (err, result) {
    if (!result) {
      result = { name: username, count: 0, userId: userId };
    }
    if (event == "reaction_removed" && result.count > 0) {
      result.count -= 1;
    } else {
      result.count += 1;
    }
    console.log(`Updating user stats for: ${JSON.stringify(result)}`);
    vascos.updateOne({ name: username }, { $set: result }, { upsert: true });
  });
}
