const { resolve } = require('dns').promises;
const argv = require('yargs')
  .demandCommand(1)
  .boolean('d')
  .alias('d', 'dry-run')
  .describe('d', 'dry run: do not actually perform the attack')
  .argv;

const hostname: string = argv._[0];

interface Address {
  ip: string;
  family: number;
}

async function start() {
  console.log(`Resolving '${hostname}'`);

  // Resolve the host for both IPv4 and IPv6. Swallow errors because it will throw an error if there are no results.
  const ipv4Addresses: string[] = await resolve(hostname, 'A').catch(() => [])
  const ipv6Addresses: string[] = await resolve(hostname, 'AAAA').catch(() => [])

  const ipAddresses: Address[] = [
    ...ipv4Addresses.map(address => ({ ip: address, family: 4 })),
    ...ipv6Addresses.map(address => ({ ip: address, family: 6 })),
  ];

  if (!ipAddresses.length) {
    throw new Error(`Could not resolve ${hostname}`);
  }

  console.log('Found the following ip addresses:\n', ipAddresses.map(address => address.ip));
  console.log('Determining open ports per IP');
}

start().catch(err => {
  console.error('An error occured during startup');
  console.error(err);
});