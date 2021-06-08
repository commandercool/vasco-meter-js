const http = require("http");
const https = require("https");

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
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    if (body != "") {
      console.log(body);
      const json = JSON.parse(body);
      res.statusCode = 200;
      if (json.challenge) {
        res.setHeader("Content-Type", "text/plain");
        res.end(json.challenge);
      } else {
        if (json.event.reaction == "vasco") {
          var user = json.event.item_user;
          options.path = options.path + '?user=' + user;
          const req = https.request(options, (res) => {
            console.log(`statusCode from slack api: ${res.statusCode}`);
            let userData = "";  
            res.on("data", (d) => {
              userData += d;
            });
            res.on("end", () => {
              const userJson = JSON.parse(body);
              var username = userJson.user.real_name_normalized;
              console.log(`User ${username} has received vasco reaction!`);
            });
          });
          req.on("error", (error) => {
            console.error(error);
          });

          req.end();

          console.log(`User ${user} has received vasco reaction!`);
          res.end("Got it, thanks!");
        }
      }
    } else {
      res.end();
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});