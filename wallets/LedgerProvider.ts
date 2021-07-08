import Web3ProviderEngine from 'web3-provider-engine'
import { LedgerSubprovider } from '@0x/subproviders/lib/src/subproviders/ledger' // https://github.com/0xProject/0x-monorepo/issues/1400
import { LedgerEthereumClient, PartialTxParams } from '@0x/subproviders/lib/src/types'
import CacheSubprovider from 'web3-provider-engine/subproviders/cache.js'
import { RPCSubprovider } from '@0x/subproviders/lib/src/subproviders/rpc_subprovider' // https://github.com/0xProject/0x-monorepo/issues/1400
import LWHwTransport from 'ledger-web-hw-transport'
import Eth from '@ledgerhq/hw-app-eth'
import { WindowPostMessageStream } from '@metamask/post-message-stream'
import LWClient from 'ledger-web-client'
import axios from 'axios'

class LedgerWebConnectorPatched extends LedgerSubprovider {
  _ledgerEthereumClientFactoryAsyncAccessible: () => Promise<LedgerEthereumClient>
  _clientFactory: () => LWClient
  constructor(opts) {
    super(opts)
    this._ledgerEthereumClientFactoryAsyncAccessible = opts.ledgerEthereumClientFactoryAsync
    this._clientFactory = opts.clientFactory
  }
  async getAccountsAsync() {
    await this._clientFactory().request('devices', 'requireApp', [
      {
        name: 'Ethereum',
      },
    ])
    const eth = await this._ledgerEthereumClientFactoryAsyncAccessible()
    let address
    try {
      const res = await eth.getAddress(`44'/60'/${0}'/0/0`, false, true)
      address = res.address
    } catch (e) {
      alert('getAddress error, is your device sleepy ?')
      throw new Error('getAddress error, is your device sleepy ?')
    }

    return [address]
  }
  async signTransactionAsync(txParams: PartialTxParams): Promise<string> {
    const client = this._clientFactory()
    const eth = await this._ledgerEthereumClientFactoryAsyncAccessible()
    const ethers = require('ethers')

    console.log(ethers)

    await client.request('devices', 'requireApp', [
      {
        name: 'Ethereum',
      },
    ])
    await client.request('devices', 'requireDeviceActionStart', [{}])

    console.log(ethers)

    // @ts-ignore
    const unsignedTx: ethers.utils.UnsignedTransaction = {
      to: txParams.to,
      data: txParams.data,
      chainId: 1,
    }

    if (txParams.nonce) {
      unsignedTx.nonce = parseInt(txParams.nonce, 16)
    }
    if (txParams.gas) {
      unsignedTx.gasLimit = ethers.BigNumber.from(txParams.gas)
    }
    if (txParams.gasPrice) {
      unsignedTx.gasPrice = ethers.BigNumber.from(txParams.gasPrice)
    }
    if (txParams.value) {
      unsignedTx.value = ethers.BigNumber.from(txParams.value)
    }

    const address = txParams.from
    // @ts-ignore
    const path: string = `44'/60'/0'/0/0`

    if (!unsignedTx.nonce) {
      const res = await axios.get(
        `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=GPGACJA64X1GQUSG4KIUTXUFUMQXISPISZ`
      )
      unsignedTx.nonce = parseInt(res.data.result, 16)
    }
    if (!unsignedTx.gasPrice) {
      const res = await axios.get(
        `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=GPGACJA64X1GQUSG4KIUTXUFUMQXISPISZ`
      )
      const gwei = ethers.BigNumber.from(10).pow(9)
      unsignedTx.gasPrice = ethers.BigNumber.from(res.data.result.FastGasPrice).mul(gwei)
    }

    const unsignedTxHex = ethers.utils.serializeTransaction(unsignedTx)

    try {
      await this._clientFactory().request('devices', 'requireApp', [
        {
          name: 'Ethereum',
        },
      ])
    } catch (e) {
      throw new Error('app not accessible')
    }

    await this._clientFactory().request('devices', 'requireDeviceActionStart', [{}])

    let result
    try {
      result = await eth.signTransaction(path, unsignedTxHex.slice(2))
    } catch (e) {
      await client.request('devices', 'requireDeviceActionEnd', [{}])
      console.log(e)
      // TODO : when ledger-web-hw-transport relay correctly the error, display correct
      // message
      throw new Error('build tx error : did you reject or is your device sleeping ?')
    }

    await client.request('devices', 'requireDeviceActionEnd', [{}])

    let v = result.v
    // @ts-ignore
    if (unsignedTx.chainId > 0) {
      // EIP155 support. check/recalc signature v value.
      let rv = parseInt(v, 16)
      // @ts-ignore
      let cv = unsignedTx.chainId * 2 + 35
      if (rv !== cv && (rv & cv) !== rv) {
        cv += 1 // add signature v bit.
      }
      v = cv.toString(16)
    }

    let signature = {
      r: `0x${result.r}`,
      s: `0x${result.s}`,
      v: parseInt(v, 16),
    }

    const signedTxHex = ethers.utils.serializeTransaction(unsignedTx, signature)

    return signedTxHex
  }
}

const engine = new Web3ProviderEngine();
let client
const clientFactory = () => {
  if (client) {
    return client
  }
  let name = 'https://ledger-web-lido.vercel.app/'

  if (process.env.NODE_ENV === 'development') {
    name = 'http://localhost:4002/'
  }

  client = new LWClient(
    new WindowPostMessageStream({
      name,
      target: 'ledger-web-parent',
      // todo when updating: https://github.com/MetaMask/post-message-stream/pull/23
      // targetOrigin: "*",
      targetWindow: window.parent || window,
    })
  )

  return client
}
let eth
const ledgerEthereumClientFactoryAsync = async () => {
  if (eth) {
    return eth
  }

  const client = clientFactory()

  eth = new Eth(new LWHwTransport(client))

  return eth
}
engine.addProvider(
  new LedgerWebConnectorPatched({
    networkId: 1,
    clientFactory,
    ledgerEthereumClientFactoryAsync,
  })
)
engine.addProvider(new CacheSubprovider())
engine.addProvider(new RPCSubprovider('https://mainnet.infura.io/v3/2e87c2891f3c431da2b024f83bd05571'))

engine.start()

export default engine;
