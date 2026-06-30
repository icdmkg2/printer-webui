const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH: Connected to host.');
  
  const commands = [
    // Check firewall status
    'echo "or12341234" | sudo -S ufw status',
    // Allow mDNS UDP port 5353 if firewall is enabled
    'echo "or12341234" | sudo -S ufw allow 5353/udp',
    // Show new firewall status
    'echo "or12341234" | sudo -S ufw status verbose'
  ];

  executeCommands(commands);
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect({
  host: '10.100.102.2',
  port: 22,
  username: 'or',
  password: 'or12341234'
});

function executeCommands(cmds) {
  if (cmds.length === 0) {
    console.log('SSH: UFW check and rules applied.');
    conn.end();
    return;
  }

  const cmd = cmds.shift();
  console.log(`Executing: ${cmd}`);

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => {
      executeCommands(cmds);
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}
