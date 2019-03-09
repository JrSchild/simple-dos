import { resolveIPAddresses, checkPorts } from './helpers';
import { Address } from './types';
import * as yargs from 'yargs';

const argv = yargs
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
      throw new Error('Invalid port range')
    }

    return { lower, upper };
  })
  .argv;

const hostname: string = argv._[0];

async function start() {
  console.log(`Resolving '${hostname}'`);

  const ipAddresses: Address[] = await resolveIPAddresses(hostname);
  if (!ipAddresses.length) {
    throw new Error(`Could not resolve ${hostname}`);
  }

  console.log('Found the following ip addresses:\n', ipAddresses.map(address => address.ip));

  await checkPorts(ipAddresses, argv.ports.lower, argv.ports.upper);

  console.log(ipAddresses)
}

start().catch(err => {
  console.error('An error occured during startup');
  console.error(err);
});