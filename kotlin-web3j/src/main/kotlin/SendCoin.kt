import org.web3j.crypto.*
import org.web3j.protocol.Web3j
import org.web3j.protocol.core.DefaultBlockParameterName
import org.web3j.protocol.http.HttpService
import org.web3j.tx.gas.StaticGasProvider
import org.web3j.utils.Convert
import org.web3j.utils.Numeric
import java.math.BigInteger

fun main(args: Array<String>) {
    // init
    val safeAddr = System.getenv("SAFEADDR")
    Utils.myAssert(safeAddr != null, "ENV var SAFEADDR missing")
    val privKey = System.getenv("PRIVKEY")
    Utils.myAssert(privKey != null, "ENV var PRIVKEY missing")

    val exampleRecipient = "0x30B125d5Fc58c1b8E3cCB2F1C71a1Cc847f024eE"
    val amountToBeSent = Convert.toWei("1", Convert.Unit.ETHER).toBigInteger()
    val gasProvider = StaticGasProvider(
        BigInteger.valueOf(100_000_000_000L),
        BigInteger.valueOf(300_000)) // TODO: how should this be determined?

    val credentials = Credentials.create(privKey)
    println("loaded private key for address: ${credentials.address}")

    val web3 = Web3j.build(HttpService("https://rpc.tau1.artis.network"))
    val safe = GnosisSafe.load(safeAddr, web3, credentials, gasProvider)

    val ecKeyPair = ECKeyPair.create(Numeric.hexStringToByteArray(privKey))

    // checks
    Utils.myAssert(safe.NAME().send() == "Gnosis Safe", "Safe NAME() did not return 'Gnosis Safe'")
    val safeBal = web3.ethGetBalance(safeAddr, DefaultBlockParameterName.LATEST).send().balance
    Utils.myAssert(safeBal >= amountToBeSent, "Safe account low on funds")
    Utils.myAssert(safe.owners.send().contains(credentials.address), "not owner of this Safe account")
    Utils.myAssert(safe.threshold.send().equals(BigInteger.valueOf(1)), "signature threshold of Safe account != 1")

    // ======= step 1 (encode contract call) can be skipped as we're just transferring native coins

    // ======= step 2: create the data structure for the Safe tx

    // don't know how to elegantly create this as object
    val to: String = exampleRecipient
    val value: BigInteger = amountToBeSent
    val data: ByteArray = ByteArray(0)
    val operation: BigInteger = BigInteger.valueOf(0)
    val safeTxGas: BigInteger = BigInteger.valueOf(50_000) // TODO: how should this be determined?
    val baseGas: BigInteger = BigInteger.valueOf(300_000) // TODO: how should this be determined?
    val gasPrice: BigInteger = BigInteger.valueOf(0)
    val gasToken: String = "0x0000000000000000000000000000000000000000"
    val refundReceiver: String = "0x0000000000000000000000000000000000000000"
    val _nonce: BigInteger = safe.nonce().send()
    println("safeNonce: ${_nonce}")

    // =======  step 3: generate signature and add it to the data structure

    val safeTxHash = safe.getTransactionHash(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, _nonce).send()
    println("safeTxHash: ${Numeric.toHexString(safeTxHash)}")
    Utils.myAssert(Numeric.toHexString(safeTxHash).length == 66, "safeTxHash has wrong length")

    val sig = Sign.signMessage(safeTxHash, ecKeyPair, false)
    // Kotlin conventiently has a + operator for concatenating ByteArrays
    val sigByteArr = sig.r + sig.s + sig.v
    println("signature: ${Numeric.toHexString(sigByteArr)}")

    // ======= step 4: encode a call of execTransaction() with the signed Safe tx object

    // returns the abi-encoded hex string
    val ethTxData = safe.execTransaction(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, sigByteArr).encodeFunctionCall()
    println("encoded function: ${ethTxData}")
    
    // ======= step 5: create the Ethereum transaction object

    val ethNonce = web3.ethGetTransactionCount(credentials.address, DefaultBlockParameterName.LATEST).send().transactionCount
    println("ethNonce: ${ethNonce}")

    val ethTxObj = RawTransaction.createTransaction(ethNonce, gasProvider.gasPrice, safeTxGas + baseGas, safeAddr, ethTxData)
    val signedEthTx = TransactionEncoder.signMessage(ethTxObj, credentials)
    println("signedEthTx: ${Numeric.toHexString(signedEthTx)}")

    // ======= step 7: send/execute the Ethereum tx

    val txHash = web3.ethSendRawTransaction(Numeric.toHexString(signedEthTx)).send().transactionHash
    println("txHash: ${txHash}")
    println("waiting for receipt...")
    val receipt = Utils.getReceiptFor(web3, txHash)
    println("====== tx " + (if (receipt.status == "0x1") "succeeded" else "failed") + " ======")
    println("receipt: ${Utils.getReceiptFor(web3, txHash).toString()}")
}
