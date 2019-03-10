### Dott Assignments

A simple denial of service attack tool written in Node.js.

Usage:
```
ts-node dos.ts <hostname> [-d] [-m SYS] [-p 8200-8400]
```

Example:
```
ts-node dos.ts google.com -d
```

Options:
- `-d` For a dry run. Does not actually start the flood.
- `-m` Which method to use. Choices: `SYS`, `TCP` or `UDP`. Defaults to `SYS`.
- `-p` A range of ports to attack. Defaults to `1-65535`
