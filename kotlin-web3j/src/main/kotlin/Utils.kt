import org.web3j.protocol.Web3j
import org.web3j.protocol.core.methods.response.EthGetTransactionReceipt
import org.web3j.protocol.core.methods.response.TransactionReceipt
import kotlin.system.exitProcess

class Utils {
    companion object {
        // since assert() doesn't work out of the box (requires JVM option "-ea", don't know where to set)...
        fun myAssert(testValue: Boolean, errMsg: String) {
            if (!testValue) {
                println(errMsg)
                exitProcess(1)
            }
        }

        // TODO: check if there's a more elegant way to wait for the receipt
        fun getReceiptFor(web3: Web3j, txHash: String): TransactionReceipt {
            while (true) {
                val transactionReceipt: EthGetTransactionReceipt = web3
                    .ethGetTransactionReceipt(txHash)
                    .send()
                if (transactionReceipt.result != null) {
                    return transactionReceipt.transactionReceipt.get()
                }
                Thread.sleep(1000)
            }
        }
    }
}