import { PAYSTACK_SECRET_KEY } from "@env/index";
import { Injectable } from "@nestjs/common";
import { Paystack } from "paystack-sdk";
import { CreateCustomer } from "paystack-sdk/dist/customer/interface";
import { CreateDedicatedVirtualAccount, DedicatedAccountCreatedResponse } from "paystack-sdk/dist/dedicated/interface";
import { CreateCharge, ResolveAccountNumber } from "./type";
import { GetTransactionResponse, TransactionInitialized } from "paystack-sdk/dist/transaction/interface";
import { redis_client } from "@cache/index";
import axios from "axios";
import { CreateRecipient } from "paystack-sdk/dist/recipient/interface";
import { InitiateTransfer, TransferInitiated } from "paystack-sdk/dist/transfer/interface";
import { BadRequest } from "paystack-sdk/dist/interface";

@Injectable()
export class PaymentSercvice {

     private PROVIDER_BASE_URL = "https://api.paystack.co";

     private CIRCUIT_BREAKER_OPEN_STATE_REDIS_KEY = "PAYMENT_BANK_TRANSFER_CIRCUIT_BREAKER_OPEN_STATE";

     private CIRCUIT_BREAKER_RECENT_FAILURES_REDIS_KEY = "PAYMENT_BANK_TRANSFER_CIRCUIT_BREAKER_RECENT_FAILURES";

     private CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
    
    private http_client = axios.create({
        baseURL: this.PROVIDER_BASE_URL,
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
    })

    private provider = new Paystack( PAYSTACK_SECRET_KEY );

    async create_customer(payload: CreateCustomer ){

        const customer = await this.provider.customer.create( payload );

        return customer;

    }

    async create_virtual_account( payload: CreateDedicatedVirtualAccount ){

        const virtual_account = await this.provider.dedicated.create(payload);

        return virtual_account as DedicatedAccountCreatedResponse;

    }

    async create_charge( payload: CreateCharge ){

        const transaction = await this.provider.transaction.initialize( payload );

        return transaction as TransactionInitialized;

    }

    async resolve_account_number( payload: ResolveAccountNumber ){

        const response = await this.provider.verification.resolveAccount( payload );

        return response;

    }

    async list_banks(){

        const REDIS_KEY = `PAYSTACK-BANKS`

        const banks = await redis_client.get(REDIS_KEY);

        if( banks ) return JSON.parse( banks );

        try {

            const response = await this.http_client.get(`/bank`);

            const banks = response.data.data;

            if( banks ) await redis_client.set(REDIS_KEY, JSON.stringify(banks));

            return banks;

        }
        catch(e){

            console.log(e);

        }
    }

    async create_recipient( payload: CreateRecipient ){

        const recipient = await this.provider.recipient.create(payload);

        return recipient;

    }

    async initiate_transfer( payload: InitiateTransfer ){

        const CIRCUIT_BREAKER_IS_OPEN = await redis_client.get(this.CIRCUIT_BREAKER_OPEN_STATE_REDIS_KEY);

        if( CIRCUIT_BREAKER_IS_OPEN ){
            return {
                status: false,
                message: "Circuit breaker is open"
            }
        }

        const response = await this.provider.transfer.initiate( payload );

        if( !response.status ){
            
            const _recent_failures = await redis_client.get(this.CIRCUIT_BREAKER_RECENT_FAILURES_REDIS_KEY);

            let recent_failures = parseInt(_recent_failures ?? '0');

            redis_client.setex(this.CIRCUIT_BREAKER_RECENT_FAILURES_REDIS_KEY, 300, ++recent_failures);

            const CIRCUIT_BREAKER_IS_NOT_OPENED_ALREADY = !(await redis_client.get(this.CIRCUIT_BREAKER_OPEN_STATE_REDIS_KEY));

            if( recent_failures >= this.CIRCUIT_BREAKER_FAILURE_THRESHOLD && CIRCUIT_BREAKER_IS_NOT_OPENED_ALREADY )
                redis_client.setex(this.CIRCUIT_BREAKER_OPEN_STATE_REDIS_KEY, 300, '1');

        }

        else redis_client.del(this.CIRCUIT_BREAKER_RECENT_FAILURES_REDIS_KEY)

        return response as TransferInitiated | BadRequest;

    }


    async fetch_transfer( transfer_code: string ){

        const transfer = await this.provider.transfer.fetch(transfer_code);

        return transfer as TransferInitiated | BadRequest;
        
    }

    async fetch_transaction(reference: string){
        const transaction = await this.provider.transaction.verify(reference);
        return transaction as GetTransactionResponse | BadRequest
    }

    

    

}