node -e "
Web3 = require('web3');
web3 = new Web3('https://rpc.tau1.artis.network', null, { transactionConfirmationBlocks: 2 });
safeAbi = require('./GnosisSafe.abi');
proxyFactoryAbi = require('./ProxyFactory.abi');
ethUtil = require('ethereumjs-util');
proxyFactory = new web3.eth.Contract(proxyFactoryAbi, '0x5b296d86413ba8fc8ad42b139539d65f950bb82f');
" -i --experimental-repl-await
