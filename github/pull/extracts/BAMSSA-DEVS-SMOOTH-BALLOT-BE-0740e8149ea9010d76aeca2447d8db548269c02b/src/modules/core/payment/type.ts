import { InitializeTransaction } from "paystack-sdk/dist/transaction/interface";
import { ResolveAccount } from "paystack-sdk/dist/verification/interface";

export type CreateCharge = InitializeTransaction;

export type ResolveAccountNumber = ResolveAccount;