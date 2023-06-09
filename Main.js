const { Keys } = require("casper-js-sdk");
const keypair = Keys.Ed25519.new();
const { publicKey, privateKey } = keypair;

// Create a hexadecimal representation of the public key and account hash.
const publicKeyHex = publicKey.toHex();
const accountHashHex = publicKey.toAccountHashStr();

// Secret Key from a file
const { Keys } = require("casper-js-sdk");
const keypair = Keys.Ed25519.loadKeyPairFromPrivateFile("./secret_key.pem");

// Using the keypair created above, you can sign a deploy that transfers CSPR.

// Replace the NODE_ADDRESS and corresponding RPC port with an active node on the network. 
//You can find active online peers for Mainnet on cspr.live and for Testnet 
// on testnet.cspr.live. The RPC port is usually 7777, 
//but it depends on the network's configuration settings.

const { CasperClient, DeployUtil } = require("casper-js-sdk");

const casperClient = new CasperClient("http://NODE_ADDRESS:7777/rpc");
const receipientPublicKeyHex = "01e8c84f4fbb58d37991ef373c08043a45c44cd7f499453fa2bd3e141cc0113b3c";

const amount = 2.5e9; // Minimum transfer: 2.5 CSPR
let deployParams = new DeployUtil.DeployParams(
    keypair.publicKey,
    "casper", // or "casper-test" for Testnet
);

const session = DeployUtil.ExecutableDeployItem.newTransferWithOptionalTransferId(amount, recipientPublicKeyHex);

const payment = DeployUtil.standardPayment(0.1e9); // Gas payment in motes: 0.1 CSPR
const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
const signedDeploy = DeployUtil.signDeploy(deploy, keypair);

console.log(await casperClient.putDeploy(signedDeploy));

// WASM FILE SMART CONTRACT 

const { CasperClient, Contracts, RuntimeArgs, CLValueBuilder, CLPublicKey } = require("casper-js-sdk");
const fs = require("fs");

const casperClient = new CasperClient("http://NODE_ADDRESS:7777/rpc");
const contract = new Contracts.Contract(casperClient);

const contractWasm = new Uint8Array(fs.readFileSync("./casper-node/target/wasm32-unknown-unknown/release/delegate.wasm").buffer);

const runtimeArguments = RuntimeArgs.fromMap({
    amount: CLValueBuilder.u512(500e9), // Minimum delegation amount: 500 CSPR
    delegator: keypair.publicKey,
    validator: CLPublicKey.fromHex("01e8c84f4fbb58d37991ef373c08043a45c44cd7f499453fa2bd3e141cc0113b3c"),
});

const deploy = contract.install(
    contractWasm,
    runtimeArguments,
    "5000000000", // Gas payment (5 CSPR)
    keypair.publicKey,
    "casper", // or "casper-test" for testnet
    [keypair],
);

(async () => {
    console.log(await casperClient.putDeploy(deploy));
})();

// ALL ABOUT PUBLIC KEYS 

const fs = require("fs");
const path = require("path");
const { Keys } = require("casper-js-sdk");

const createAccountKeys = () => {
    // Generating keys
    const edKeyPair = Keys.Ed25519.new();
    const { publicKey, privateKey } = edKeyPair;

    // Create a hexadecimal representation of the public key
    const accountAddress = publicKey.toHex();

    // Get the account hash (Uint8Array) from the public key
    const accountHash = publicKey.toAccountHash();

    // Store keys as PEM files
    const publicKeyInPem = edKeyPair.exportPublicKeyInPem();
    const privateKeyInPem = edKeyPair.exportPrivateKeyInPem();

    const folder = path.join("./", "casper_keys");

    if (!fs.existsSync(folder)) {
        const tempDir = fs.mkdirSync(folder);
    }

    fs.writeFileSync(folder + "/" + accountAddress + "_public.pem", publicKeyInPem);
    fs.writeFileSync(folder + "/" + accountAddress + "_private.pem", privateKeyInPem);

    return accountAddress;
};

const newAccountAddress = createAccountKeys();

// SENDING A TRANSFER 
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const casperClientSDK = require("casper-js-sdk");

const { Keys, CasperClient, CLPublicKey, DeployUtil } = require("casper-js-sdk");

const RPC_API = "http://159.65.203.12:7777/rpc";
const STATUS_API = "http://159.65.203.12:8888";

const sendTransfer = async ({ from, to, amount }) => {
    const casperClient = new CasperClient(RPC_API);

    const folder = path.join("./", "casper_keys");

    // Read keys from the structure created in #Generating keys
    const signKeyPair = Keys.Ed25519.parseKeyFiles(folder + "/" + from + "_public.pem", folder + "/" + from + "_private.pem");

    // networkName can be taken from the status api
    const response = await axios.get(STATUS_API + "/status");

    let networkName = null;

    if (response.status == 200) {
        networkName = response.data.chainspec_name;
    }

    // For native-transfers the payment price is fixed
    const paymentAmount = 100000000;

    // transfer_id field in the request to tag the transaction and to correlate it to your back-end storage
    const id = 187821;

    // gasPrice for native transfers can be set to 1
    const gasPrice = 1;

    // Time that the deploy will remain valid for, in milliseconds
    // The default value is 1800000 ms (30 minutes)
    const ttl = 1800000;

    let deployParams = new DeployUtil.DeployParams(signKeyPair.publicKey, networkName, gasPrice, ttl);

    // We create a hex representation of the public key with an added prefix
    const toPublicKey = CLPublicKey.fromHex(to);

    const session = DeployUtil.ExecutableDeployItem.newTransfer(amount, toPublicKey, null, id);

    const payment = DeployUtil.standardPayment(paymentAmount);
    const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    const signedDeploy = DeployUtil.signDeploy(deploy, signKeyPair);

    // Here we are sending the signed deploy
    return await casperClient.putDeploy(signedDeploy);
};

sendTransfer({
    // Put here the public key of the sender's main purse. Note that it needs to have a balance greater than 2.5 CSPR
    from: "<sender-public-key>",

    // Put here the public key of the recipient's main purse. This account doesn't need to exist. If the key is correctly formatted, the network will create the account when the deploy is sent
    to: "<recipient-public-key>",

    // Minimal amount is 2.5 CSPR (1 CSPR = 1,000,000,000 motes)
    amount: 25000000000,
});

// At any moment, you can serialize the deploy from this example to JSON to accomplish whatever you want 
// (store it, send it, etc.)

// Here is the code you can use to serialize the deploy

const jsonFromDeploy = DeployUtil.deployToJson(signedDeploy); 

// Then, you can reconstruct the deploy object using this function:

const deployFromJson = DeployUtil.deployFromJson(jsonFromDeploy);
