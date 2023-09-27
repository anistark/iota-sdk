// Copyright 2021-2023 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

import {
    Client,
    initLogger,
    Utils,
    UnlockCondition,
    Ed25519Address,
    SenderFeature,
    MetadataFeature,
    Wallet,
    AddressUnlockCondition,
    AliasAddress,
    INativeToken,
} from '@iota/sdk';
import {
    prepareMetadata
} from './utils';

require('dotenv').config({ path: '.env' });

// Run with command:
// yarn run-example ./how_tos/outputs/unlock-conditions.ts

const amount = 100000;
const gas = 10000;
const toEVMAddress = '0x48e28C1681BBb92a2E5874113bc740cC11A0FD7a';
const chainAddress = 'rms1pr75wa5xuepg2hew44vnr28wz5h6n6x99zptk2g68sp2wuu2karywgrztx3';
const tokenId = '0x082a1d58d3d725f9d3af50699c2cfa022274b199a9f4060b2331bf059e285bd2730100000000';
const tokenAmount = 100;

// Build ouputs with all unlock conditions
async function run() {
    initLogger();

    const client = new Client({});

    if (!process.env.STRONGHOLD_PASSWORD) {
        throw new Error(
            '.env STRONGHOLD_PASSWORD is undefined, see .env.example',
        );
    }

    const wallet = new Wallet({
        storagePath: process.env.WALLET_DB_PATH,
    });

    const account = await wallet.getAccount('Alice');

    // Sync new outputs from the node.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _syncBalance = await account.sync();

    // After syncing the balance can also be computed with the local data
    const balance = await account.getBalance();
    for (let b = 0; b < balance.nativeTokens.length; b++) {
        if (balance.nativeTokens[b].tokenId === tokenId) {
            console.log('Balance::', balance.nativeTokens[b]);
            break;
        }
    }

    const bigAmount: bigint = BigInt(amount);
    const bigGas: bigint = BigInt(gas);
    // console.log('amounts:', bigAmount, bigGas);

    try {
        const addresses = await account.addresses();
        // console.log('address selected:', addresses[0].address);
        const hexAddress = Utils.bech32ToHex(
            addresses[0].address,
        );

        const aliasHexAddress = Utils.bech32ToHex(
            chainAddress,
        );
        const addressUnlockCondition: UnlockCondition = new AddressUnlockCondition(new AliasAddress(aliasHexAddress))

        const addressFeature = new SenderFeature(new Ed25519Address(hexAddress));
        // console.log('addressFeature:', addressFeature);

        const metadata = await prepareMetadata(
            toEVMAddress,
            bigAmount,
            bigGas
        );
        // console.log('metadata:', metadata);
        const metadataFeature = new MetadataFeature(metadata);
        // console.log('metadataFeature:', metadataFeature);

        // Basic Output with Metadata
        const basicOutput = await client.buildBasicOutput({
            amount: amount.toString(),
            nativeTokens: [({id: tokenId, amount: BigInt(tokenAmount)})],
            unlockConditions: [
                addressUnlockCondition
            ],
            features: [
                addressFeature,
                metadataFeature,
            ],
        });
        console.log('basicOutput:', JSON.stringify(basicOutput, null, 2));

        // Send Output
        await wallet.setStrongholdPassword(process.env.STRONGHOLD_PASSWORD);
        console.log('Sending Transaction...');
        const transaction = await account.sendOutputs([basicOutput]);
        console.log(`Transaction sent: ${transaction.transactionId}`);

        console.log('Waiting until included in block...');
        const blockId = await account.retryTransactionUntilIncluded(
            transaction.transactionId,
        );
        console.log(`Block sent: ${process.env.EXPLORER_URL}/block/${blockId}`);

        // Right now this token even though sent to L2 evm won't really show up anywhere.
        // The foundry owner needs to register it and then the ERC20 wrapper would work only for foundry owner.
        // Ref: https://wiki.iota.org/wasp-evm/reference/core-contracts/evm#registererc20nativetoken
    } catch (error) {
        console.error('Error: ', error);
    }
}

run().then(() => process.exit());
