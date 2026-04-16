from typing import TypedDict, List, Optional, Literal


class ContractAccount(TypedDict):
    accountId: str
    accountType: str
    createdAt: int
    l2Key: str
    makerFeeRate: str
    status: str
    takerFeeRate: str
    unrealizePnlPriceType: str
    updatedAt: int
    userId: str
    vipMakerFeeRate: str
    vipTakerFeeRate: str


class ContractWallet(TypedDict):
    accountId: str
    balance: str
    pendingDepositAmount: str
    pendingTransferInAmount: str
    pendingTransferOutAmount: str
    pendingWithdrawAmount: str
    token: str


class ExperienceMoney(TypedDict):
    accountId: str
    availableAmount: str
    recycledAmount: str
    token: str
    totalAmount: str
    totalNumber: str


class Fill(TypedDict):
    symbol: str
    side: Literal["BUY", "SELL"]
    orderId: str
    fee: str
    liquidity: str
    accountId: str
    createdAt: int
    isOpen: bool
    size: str
    price: str
    quoteAmount: str
    id: str
    updatedAt: int


class OpenSlParams(TypedDict):
    triggerPrice: str
    triggerPriceType: str
    triggerSize: str


class OpenTpParams(TypedDict):
    triggerPrice: str
    triggerPriceType: str
    triggerSize: str


class Order(TypedDict):
    accountId: str
    cancelReason: str
    clientId: str
    clientOrderId: str
    createdAt: int
    cumSuccessFillFee: str
    cumSuccessFillSize: str
    cumSuccessFillValue: str
    cumSuccessLiquidateFee: str
    expiresAt: int
    id: str
    isDeleverage: bool
    isLiquidate: bool
    isPositionTpsl: bool
    isSetOpenSl: bool
    isSetOpenTp: bool
    limitFee: str
    openSlParams: OpenSlParams
    openTpParams: OpenTpParams
    price: str
    reduceOnly: bool
    remainingSize: str
    side: Literal["BUY", "SELL"]
    size: str
    status: str
    symbol: str
    timeInForce: str
    triggerPrice: str
    triggerPriceType: str
    type: str
    updatedAt: int


class Position(TypedDict):
    accountId: str
    customImr: str
    entryPrice: str
    exitPrice: str
    fundingFee: str
    openValue: str
    realizedPnl: str
    side: Literal["LONG", "SHORT"]
    size: str
    sumClose: str
    sumOpen: str
    symbol: str
    totalCumCloseFee: str
    totalCumCloseSize: str
    totalCumCloseValue: str
    totalCumFundingFee: str
    totalCumOpenFee: str
    totalCumOpenSize: str
    totalCumOpenValue: str
    updatedAt: int


class AccountData(TypedDict):
    contractAccounts: List[ContractAccount]
    contractWallets: List[ContractWallet]
    deleverages: None
    experienceMoney: List[ExperienceMoney]
    fills: List[Fill]
    orders: List[Order]
    positionClosedTransactions: None
    positions: List[Position]
    spotAccounts: None
    spotWallets: None
    transfers: None
