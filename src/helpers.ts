import * as _ from 'lodash';
import * as net from 'net';
import * as async from 'async';
import { promisify } from 'util';
import { Address } from './types';
const asyncFilter = promisify(async.filterLimit.bind(async));
const { resolve } = require('dns').promises;

const CHECK_PORT_TIMEOUT = 1500;
const CHECK_PORT_ASYNC = 50;

// Resolve the host for both IPv4 and IPv6. Swallow errors because it will throw an error if there are no results.
const resolveIPAddresses = async (hostname: string): Promise<Address[]> => {
  const ipv4Addresses: string[] = await resolve(hostname, 'A').catch(() => [])
  const ipv6Addresses: string[] = await resolve(hostname, 'AAAA').catch(() => [])

  return [
    ...ipv4Addresses.map(address => ({ ip: address, family: 4, port: null })),
    ...ipv6Addresses.map(address => ({ ip: address, family: 6, port: null })),
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
const checkPorts = async (ipAddresses: Address[], lower: number, upper: number): Promise<Address[]> => {
  const ipPorts: Address[] = [];

  for (const address of ipAddresses) {
    console.log(`Determining open ports for ${address.ip}`);

    // Create an array of ports to check
    const portRange: number[] = _.range(lower, upper);

    // For each port, see if a connection can be established.
    const ports: number[] = await asyncFilter(portRange, CHECK_PORT_ASYNC, (port: number, callback) => {
      checkPort(address, port).then(isOpen => callback(null, isOpen));
    });

    // Push the port together with the address onto the ipPorts
    ipPorts.push(
      ...ports.map(port => ({ ...address, port }))
    );
  }

  return ipPorts;
};

export {
  resolveIPAddresses,
  checkPorts,
};
