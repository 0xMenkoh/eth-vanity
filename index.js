import cluster from 'cluster';
import os from 'os';
import fs from 'fs';
import keccak from 'keccak';
import secp256k1 from 'secp256k1';
import randomBytes from 'randombytes';
import humanizeDuration from 'humanize-duration';

// Config Part
const config = JSON.parse(fs.readFileSync('./config.json'));
let prefix = config.prefix;
let suffix = config.suffix;
let totalGenerated = 0;
let startTime = Date.now();

// Interval for the number of generated wallets
setInterval(() => {
    let elapsed = Date.now() - startTime;
    let rate = totalGenerated / elapsed * 1000;
    console.log(`> ${totalGenerated} address generated in ${elapsed / 1000}s (${rate.toFixed(0)} address/s) | ETA: ${timeForFiftyPercent()}`);
}, 2000);


// Privatekey to address
const privateToAddress = (privateKey) => {
    const pub = new Buffer(secp256k1.publicKeyCreate(privateKey, false).slice(1));
    return keccak('keccak256').update(pub).digest().slice(-20).toString('hex');
};

// Wallet from Random Privatekey
const getRandomWallet = () => {
    const privateKeyBytes = randomBytes(32);
    const address = '0x' + privateToAddress(privateKeyBytes).toString('hex');
    const privateKey = privateKeyBytes.toString('hex');
    return {
        address,
        privateKey
    };
};

// While loop to generate wallets
const loop = () => {
    const regex = new RegExp(`^0x${prefix}.+${suffix}$`);
    let i = 0;
    while (true) {
        const wallet = getRandomWallet();
        if (regex.test(wallet.address)) {
            console.log("[+] Successfully Generated Address: " + wallet.address);
            fs.appendFileSync('./eth_wallet_list.txt', wallet.address + ',' + wallet.privateKey + '\r\n');
        }
        if (i % 10000 === 0) {
            process.send('increment');
        };
        i++;
    }
}

// Number of permutations 
const permutations = () => {
    let length = prefix.length + suffix.length;
    return Math.pow(16, length)
}

// 50% chance of getting a wallet that matches the prefix and suffix
const probabilityFiftyPercent = () => {
    return Math.floor(Math.log(0.5) / Math.log(1 - 1 / permutations()));
}

// ETA  at current wallet/s rate for 50% chance to gen valid wallet
const timeForFiftyPercent = () => {
    let elapsed = Date.now() - startTime;
    let rate = totalGenerated / elapsed * 1000;
    const seconds = probabilityFiftyPercent() / rate;
    return humanizeDuration(Math.round(seconds) * 1000, {
        largest: 2
    });
}

// MAIN - Start lopp
if (cluster.isMaster) {
    let totalCPUs = config.cores || os.cpus().length;
    console.log(`CPUs Number: ${totalCPUs}`);
    for (let i = 0; i < totalCPUs; i++) {
        let worker = cluster.fork();
        worker.on("message", () => {
            totalGenerated += 10000;
        });
    }
} else {
    loop();
}