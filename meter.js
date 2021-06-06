const http = require('http');

const hostname = '127.0.0.1';
const port = 8080;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    if(body != '') {
      console.log(body);
      const json = JSON.parse(body);
      res.statusCode = 200;
      if (json.challenge){
        res.setHeader('Content-Type', 'text/plain');
        res.end(json.challenge);
      } else {
        console.log(body); 
      }
    } else {
      res.end();
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
