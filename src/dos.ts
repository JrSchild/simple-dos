const _ = require('lodash');
const net = require('net');
const async = require('async');
const { promisify } = require('util');
const asyncFilter = promisify(async.filterLimit.bind(async));
const { resolve } = require('dns').promises;
const argv = require('yargs')
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

const CHECK_PORT_TIMEOUT = 1500;
const CHECK_PORT_ASYNC = 50;

interface Address {
  ip: string;
  family: number;
  ports: number[];
}

// Resolve the host for both IPv4 and IPv6. Swallow errors because it will throw an error if there are no results.
const resolveIPAddresses = async (hostname: string): Promise<Address[]> => {
  const ipv4Addresses: string[] = await resolve(hostname, 'A').catch(() => [])
  const ipv6Addresses: string[] = await resolve(hostname, 'AAAA').catch(() => [])

  return [
    ...ipv4Addresses.map(address => ({ ip: address, family: 4, ports: [] })),
    ...ipv6Addresses.map(address => ({ ip: address, family: 6, ports: [] })),
  ];
};

// Check if a port on a specific address is open. Set the timeout to 1.5 seconds.
const checkPort = async (addres: Address, port: number): Promise<any> => {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let isOpen = false;

    socket.setTimeout(CHECK_PORT_TIMEOUT);
    socket.on('connect', () => {
      isOpen = true;
      socket.end();
    });
    socket.on('timeout', () => socket.destroy());
    socket.on('error', () => {
      isOpen = false
    });
    socket.on('close', () => resolve(isOpen));
    socket.connect(port, addres.ip);
  });
};

// For each address, retrieve a list of open ports.
const checkPorts = async (ipAddresses: Address[]): Promise<void> => {
  for (const address of ipAddresses) {
    console.log(`Determining open ports for ${address.ip}`);

    // Create an array of ports to check
    const ports: number[] = _.range(argv.ports.lower, argv.ports.upper);

    // For each port, see if a connection can be established.
    address.ports = await asyncFilter(ports, CHECK_PORT_ASYNC, (port: number, callback) => {
      checkPort(address, port).then(isOpen => callback(null, isOpen));
    });
  }
};

async function start() {
  console.log(`Resolving '${hostname}'`);

  const ipAddresses: Address[] = await resolveIPAddresses(hostname);
  if (!ipAddresses.length) {
    throw new Error(`Could not resolve ${hostname}`);
  }

  console.log('Found the following ip addresses:\n', ipAddresses.map(address => address.ip));

  await checkPorts(ipAddresses);

  console.log(ipAddresses)
}

start().catch(err => {
  console.error('An error occured during startup');
  console.error(err);
});