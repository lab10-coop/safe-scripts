/* vim: set tabstop=4 softtabstop=0 expandtab shiftwidth=4 smarttab */

/*
 * Example: send 1 native coin from the given Safe account.
 * Expects 2 ENV variables to be set:
 *   PRIVKEY: private key (without 0x prefix) for tx signing and sending
 *   SAFEADDR: address of a Safe account which the account represented by PRIVKEY is an owner of
 */

const assert = require('assert');
const Web3 = require('web3');
const safeAbi = require('../GnosisSafe.abi');
const ethUtil = require('ethereumjs-util');

const web3 = new Web3('https://rpc.tau1.artis.network', null, { transactionConfirmationBlocks: 2 });

const privKey = process.env.PRIVKEY;
assert(privKey !== undefined, 'ENV var PRIVKEY missing');

const safeAddr = process.env.SAFEADDR;
assert(safeAddr !== undefined, 'ENV var SAFEADDR missing');

const myAddr = web3.eth.accounts.privateKeyToAccount(`0x${privKey}`).address;
console.log(`loaded private key for address ${myAddr}`);

// hardcoded example values we use in this example
const exampleRecipient = '0x30B125d5Fc58c1b8E3cCB2F1C71a1Cc847f024eE';
const baseGas = 300000;
const amountToBeSent = web3.utils.toWei('1'); // 1 native coin

async function main() {
    // instantiate the Safe contract account
    const safe = new web3.eth.Contract(safeAbi, safeAddr) // address of an existing Safe account I'm owner of
    // check if I have instantiated a Safe account
    assert(await safe.methods.NAME().call() === 'Gnosis Safe');
    // A valid Gnosis Safe account always returns this string. Now I know that there's indeed a Safe account at that address.

    // check if the account has enough funds. Parsing as number is a bit dirty (rounding errors), but does the job for this example
    assert(Number.parseInt(await web3.eth.getBalance(safeAddr)) >= Number.parseInt(amountToBeSent), 'Safe account low on funds');

    // check if I'm an owner of this Safe
    assert((await safe.methods.getOwners().call()).indexOf(myAddr) >= 0, 'not owner of this Safe account');
    
    // check the signature threshold
    assert(await safe.methods.getThreshold().call() === '1', 'signature threshold of Safe account != 1'); // yeah, in JS this returns a string...
    
    // we're ready to go

    // ======= step 1 (encode contract call) can be skipped as we're just transferring native coins

    // ======= step 2: create the data structure for the Safe tx

    // first, we need to get the current nonce of the Safe account
    const safeNonce = await safe.methods.nonce().call();

    let safeTxObj = {
        to: exampleRecipient,
        value: amountToBeSent,
        data: "0x", // no data
        operation: 0, // call
        safeTxGas: 50000, // depends on the complexity of the tx. In this case, it's a simple transfer
        baseGas: baseGas,
        gasPrice: 0, // not needed
        gasToken: "0x0000000000000000000000000000000000000000", // not needed
        refundReceiver: "0x0000000000000000000000000000000000000000", // not needed
        nonce: safeNonce
    };
    console.log(`safeTxObj: ${JSON.stringify(safeTxObj, null, 2)}`);

    // =======  step 3: generate signature and add it to the data structure
    
    // convert object to array, which can be handed over as method arguments in a less verbose way (using the array destructuring operator)
    const safeTxArr = Object.values(safeTxObj);

    // get a "TransactionHash" for the Safe tx - that becomes the message to be signed
    const safeTxHash = await safe.methods.getTransactionHash(...safeTxArr).call();
    console.log(`safeTxHash: ${safeTxHash}`);

    // now we have a hash of the transaction object. That's the payload we need to generate a signature for
    const sigObj = ethUtil.ecsign(
        Buffer.from(ethUtil.stripHexPrefix(safeTxHash), "hex"), // the payload we want to sign
        Buffer.from(privKey, "hex"), // the private key we want to sign with
        0 // chainId. To be set to 0 for Safe tx.
    );
    console.log(`sigObj: r: ${sigObj.r.toString('hex')}, s: ${sigObj.s.toString('hex')}, v: ${sigObj.v.toString(16)}`);
    // now we construct a hex string representation of that signature object
    const sigString = `0x${sigObj.r.toString("hex")}${sigObj.s.toString("hex")}${sigObj.v.toString(16)}`;

    // ======= step 4: encode a call of execTransaction() with the signed Safe tx object

    // create a copy of the tx array with the last item (nonce) removed
    let signedSafeTxArr = safeTxArr.slice(0, safeTxArr.length-1)
    // and add the signature as last item
    signedSafeTxArr.push(sigString);

    console.log(`signedSafeTxArr: ${signedSafeTxArr}`);

    // now do a kind of "dry run" for that signed Safe tx object
    const ethTxData = safe.methods.execTransaction(...signedSafeTxArr).encodeABI()

    // ======= step 5: create the Ethereum transaction object

    // first, we need to check the current nonce of the sender account
    const ethNonce = await web3.eth.getTransactionCount(myAddr);

    // data structure for the tx. Note that the "data" field gets the encoded exec call with the signed Safe tx
    const ethTxObj = {
        to: safeAddr,
        data: ethTxData,
        value: 0,
        gas: safeTxObj.safeTxGas + safeTxObj.baseGas,
        gasPrice: 100000000000, // network dependent
        nonce: ethNonce
    };
    console.log(`ethTxObj: ${JSON.stringify(ethTxObj, null, 2)}`);

    // ======= step 6: sign the Ethereum tx
    const signedEthTx = await web3.eth.accounts.signTransaction(ethTxObj, privKey)

    console.log(`signedEthTx: ${JSON.stringify(signedEthTx, null, 2)}`);

    // ======= step 7: send/execute the Ethereum tx
    // TODO: check if sender has enough funds for gas
    console.log('sending tx...');
    const receipt = await web3.eth.sendSignedTransaction(signedEthTx.rawTransaction);

    console.log(`receipt: ${JSON.stringify(receipt, null, 2)}`);

    console.log(`====== tx ${receipt.status ? 'succeeded' : 'failed'} ======`);
}

main();
