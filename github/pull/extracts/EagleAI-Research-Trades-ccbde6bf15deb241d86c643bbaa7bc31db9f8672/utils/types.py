from typing import Any, List, Literal, Optional, TypedDict


class IOrder(TypedDict):
    uuid: str
    user_id: str
    key: str
    passphrase: str
    secret: str
    seed: str
    symbol: str
    side: str
    size: float
    type: str
    tp: Optional[float]
    sl: Optional[float]
    retries: int


class IDepth(TypedDict):
    a: List[List[str]]
    b: List[List[str]]
    s: str
    u: int


class IOrderDetail(TypedDict):
    decimalStr: float
    name: str
    stepSize: int


class IOrderResponseFailed(TypedDict):
    code: int
    msg: str
    key: str
    detail: IOrderDetail
    timeCost: int


class IOrderResponseData(TypedDict):
    id: int
    clientId: int
    clientOrderId: int
    accountId: int
    symbol: str
    side: str
    price: str
    averagePrice: str
    limitFee: str
    fee: str
    liquidateFee: str
    triggerPrice: str
    size: str
    type: str
    createdAt: int
    updatedTime: int
    expiresAt: int
    status: str
    timeInForce: str
    reduceOnly: bool
    isPositionTpsl: bool
    orderId: str
    exitType: str
    cancelReason: str
    latestMatchFillPrice: str
    cumMatchFillSize: str
    cumMatchFillValue: str
    cumMatchFillFee: str
    cumSuccessFillSize: str
    cumSuccessFillValue: str
    cumSuccessFillFee: str
    triggerPriceType: str
    isOpenTpslOrder: bool
    isSetOpenTp: bool
    isSetOpenSl: bool
    openTpParam: str
    openSlParam: str


class IOrderResponseSuccessful(TypedDict):
    data: IOrderResponseData
    timecost: int


class IUser(TypedDict):
    user_id: int
    email: str
    first_name: str
    last_name: str
    username: str
    gold_tier_holder: bool
    subscription: str
    daily_api_call_limit: int
    created_at: str
    updated_at: str
    is_active: bool
    is_confirmed: bool
    is_vip: bool
    vested_amount: int
    iat: int
    exp: int


class ICredential(TypedDict):
    key: int
    name: str
    passphrase: str
    secret: str
    seed: str
    user_id: str

class IBinanceCredential(TypedDict):
    secret: str
    api_key: str

class IHistoricalOrders(TypedDict):
    orders: List[IOrderResponseData]
    totalSize: int


class ContractAccount(TypedDict):
    createdAt: int
    makerFeeRate: str
    minInitialMarginRate: str
    status: str
    takerFeeRate: str
    unrealizePnlPriceType: str
    vipMakerFeeRate: str
    vipTakerFeeRate: str


class Wallet(TypedDict):
    accountId: str
    balance: str
    pendingDepositAmount: str
    pendingTransferInAmount: str
    pendingTransferOutAmount: str
    pendingWithdrawAmount: str
    token: str
    userId: str


class Position(TypedDict):
    createdAt: int
    customInitialMarginRate: str
    entryPrice: str
    exitPrice: str
    fee: str
    fundingFee: str
    lightNumbers: str
    side: Literal["LONG", "SHORT"]
    size: str
    status: str
    symbol: str
    token: str
    updatedTime: int


class SubAccount(TypedDict):
    changePubKeyStatus: str
    l2Key: str
    nonce: int
    nonceVersion: int
    subAccountId: str


class SpotAccount(TypedDict):
    createdAt: int
    defaultSubAccountId: str
    ethAddress: str
    nonce: int
    status: str
    subAccounts: List[SubAccount]
    unrealizePnlPriceType: str
    updatedAt: int
    zkAccountId: str


class SpotWallet(TypedDict):
    accountId: str
    balance: str
    createdAt: int
    pendingDepositAmount: str
    pendingTransferInAmount: str
    pendingTransferOutAmount: str
    pendingWithdrawAmount: str
    subAccountId: str
    tokenId: str
    updatedAt: int
    userId: str


class OmniSwapAccount(TypedDict):
    feeRate: str
    id: str
    l2Key: str
    status: str


class IAccount(TypedDict):
    contractAccount: ContractAccount
    contractWallets: List[Wallet]
    ethereumAddress: str
    id: str
    l2Key: str
    omniSwapAccount: OmniSwapAccount
    omniSwapWallets: Optional[List[Any]]
    positions: List[Position]
    spotAccount: SpotAccount
    spotWallets: List[SpotWallet]


class IRiskLimitConfig(TypedDict):
    positionSteps: List[str]
    imrSteps: List[str]
    mmrSteps: List[str]


class IPerpetual(TypedDict):
    displayMaxLeverage: int
    displayMinLeverage: int
    fundingInterestRate: int
    incrementalInitialMarginRate: int
    incrementalMaintenanceMarginRate: int
    incrementalPositionValue: int
    initialMarginRate: int
    maintenanceMarginRate: int
    maxOrderSize: int
    maxPositionSize: int
    minOrderSize: int
    maxMarketPriceRange: int
    settleAssetId: str
    baseTokenId: str
    stepSize: int
    symbol: str
    symbolDisplayName: str
    tickSize: int
    maxMaintenanceMarginRate: int
    maxPositionValue: int
    tagIconUrl: str
    tag: str
    fundingMaxRate: int
    fundingMinRate: int
    riskLimitConfig: IRiskLimitConfig


class IPerpetualContract(TypedDict):
    perpetualContract: List[IPerpetual]


class IContractConfig(TypedDict):
    contractConfig: IPerpetualContract


class ISymbols(TypedDict):
    data: IContractConfig


class IBalance(TypedDict):
    availableBalance: int
    initialMargin: int
    maintenanceMargin: int
    realizedPnl: int
    totalEquityValue: int
    totalRisk: int
    totalValueWithoutDiscount: int
    unrealizedPnl: int
    walletBalance: int


class IAccountBalance(TypedDict):
    data: IBalance


class IPnl(TypedDict):
    closeSharedFundingFee: str
    closeSharedOpenFee: str
    closeSharedOpenValue: str
    createdAt: int
    exitPrice: str
    exitType: str
    fee: str
    id: str
    isDeleverage: bool
    isLiquidate: bool
    liquidateFee: str
    price: str
    side: str
    size: str
    symbol: str
    totalPnl: str
    type: str


class IHistoricalPnlData(TypedDict):
    historicalPnl: IPnl


class IHistoricalPnl(TypedDict):
    data: IHistoricalPnlData


class BreakoutBotRequest(TypedDict):
    user: int
    ctc_cost: str
    leverage: str
    execution_id: str
    timestamp: str
    symbol: str
    exchange: str
    name: str
    side: str
    type: str
    qty: str
    price: str
    source_decision: str
    order_logic: str  # v1 / v2 / v3 / v4c / v4r — added by breakout-executor

class GetBinanceOrderFilter(TypedDict):
    user_id: int
    order_id: int

class ServiceResponse(TypedDict):
    data: Any
    error: Optional[Exception]
    

