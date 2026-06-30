const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('echo "or12341234" | sudo -S docker logs printer-gateway --tail 100', (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect({
  host: '10.100.102.2',
  port: 22,
  username: 'or',
  password: 'or12341234'
});
