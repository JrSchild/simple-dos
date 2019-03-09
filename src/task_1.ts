const addN = (n: number) => (i: number) => n + i;

const addEight = addN(8);
console.log(addEight(7));
console.log(addEight(100));